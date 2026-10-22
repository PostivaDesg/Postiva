// Pedido rápido: "preciso de um post sobre X amanhã". Desconta da cota e passa pela sua fila.
import { NextResponse } from 'next/server';
import { currentProfile, supabaseAdmin } from '@/lib/supabase';
import { resolveCompany, monthlyRemaining } from '@/lib/quota';
import { generateQuick } from '@/lib/claude';
import { buildBrand } from '@/lib/brand';
import { newTrackingCode } from '@/lib/tracking';
import { notifyGestor } from '@/lib/notify';
import { withLayouts, artColumns } from '@/lib/layout-rows';
import { withFiveHashtags } from '@/lib/hashtags';
import type { PlanId, PostKind } from '@/lib/plans';

export const maxDuration = 120;

export async function POST(req: Request) {
  const me = await currentProfile();
  if (!me) return NextResponse.json({ error: 'Faça login.' }, { status: 401 });
  const b = await req.json() as { topic: string; kind: PostKind; day: string; companyId?: string };
  const cid = resolveCompany(me, b.companyId);
  if (!cid) return NextResponse.json({ error: 'Empresa não informada.' }, { status: 400 });
  if (!b.topic?.trim() || b.topic.length > 1000) return NextResponse.json({ error: 'Descreva o post em até 1000 caracteres.' }, { status: 400 });
  if (!['story', 'post', 'reels'].includes(b.kind)) return NextResponse.json({ error: 'Formato inválido.' }, { status: 400 });
  const today = new Date(Date.now() - 3 * 3600e3).toISOString().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(b.day) || b.day < today) return NextResponse.json({ error: 'Escolha uma data de hoje em diante.' }, { status: 400 });

  const db = supabaseAdmin();
  const { data: company } = await db.from('companies').select('*').eq('id', cid).single();
  const { data: brand } = await db.from('brand_profiles').select('*').eq('company_id', cid).single();
  const { data: sub } = await db.from('subscriptions').select('status').eq('company_id', cid).single();
  if (!company) return NextResponse.json({ error: 'Empresa não encontrada.' }, { status: 404 });
  if (sub && !['teste', 'ativa'].includes(sub.status)) return NextResponse.json({ error: 'Assinatura pausada.' }, { status: 402 });

  const left = await monthlyRemaining(cid, company.plan as PlanId, new Date(`${b.day}T12:00:00-03:00`));
  if (left[b.kind] <= 0) {
    return NextResponse.json({ error: `A cota de ${b.kind === 'reels' ? 'reels' : b.kind + 's'} deste mês acabou. Peça uma peça extra à equipe.` }, { status: 409 });
  }

  const { piece, usage } = await generateQuick(buildBrand(company, brand), { topic: b.topic, kind: b.kind, day: b.day });
  const [laid] = await withLayouts(company, [{ ...piece, kind: b.kind, day: b.day }]);
  const { data: post } = await db.from('posts').insert({
    company_id: cid, kind: b.kind, scheduled_at: `${b.day}T${piece.time ?? '12:00'}:00-03:00`,
    title: piece.title, caption: withFiveHashtags(b.kind, piece.caption, company), reason: piece.reason,
    ...artColumns(laid),
    status: 'rascunho', quick_request: b.topic, tracking_code: newTrackingCode(),
  }).select('id').single();
  await db.from('ai_usage').insert({ company_id: cid, ...usage });

  const urgent = b.day <= new Date(Date.now() - 3 * 3600e3 + 864e5).toISOString().slice(0, 10);
  await notifyGestor(cid, 'pedido', `${urgent ? 'URGENTE · ' : ''}${company.name} pediu um ${b.kind} para ${b.day.split('-').reverse().join('/')}: "${b.topic.slice(0, 120)}"`);
  return NextResponse.json({ ok: true, postId: post?.id });
}
