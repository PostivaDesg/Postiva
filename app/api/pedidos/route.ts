// Pedido rápido / urgente: "preciso de um post sobre X hoje". Dentro da cota, a arte é gerada e entregue direto
// para o cliente aprovar, sem passar pela revisão da equipe (a equipe só recebe um aviso).
import { NextResponse } from 'next/server';
import { currentProfile, supabaseAdmin } from '@/lib/supabase';
import { resolveCompany, monthlyRemaining } from '@/lib/quota';
import { generateQuick } from '@/lib/claude';
import { brandWithLearning } from '@/lib/learning';
import { newTrackingCode } from '@/lib/tracking';
import { notifyGestor } from '@/lib/notify';
import { withLayouts, artColumns } from '@/lib/layout-rows';
import { withFiveHashtags } from '@/lib/hashtags';
import type { PlanId, PostKind } from '@/lib/plans';
import { pickWithVision } from '@/lib/art/pick';
import { buildReel } from '@/lib/reels';

export const maxDuration = 300;

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

  const { piece, usage } = await generateQuick(await brandWithLearning(company, brand), { topic: b.topic, kind: b.kind, day: b.day });
  const [laid] = await withLayouts(company, [{ ...piece, kind: b.kind, day: b.day }]);
  const { data: post } = await db.from('posts').insert({
    company_id: cid, kind: b.kind, scheduled_at: `${b.day}T${piece.time ?? '12:00'}:00-03:00`,
    title: piece.title, caption: withFiveHashtags(b.kind, piece.caption, company), reason: piece.reason,
    ...artColumns(laid),
    status: 'rascunho', quick_request: b.topic, tracking_code: newTrackingCode(),
  }).select('*').single();
  await db.from('ai_usage').insert({ company_id: cid, ...usage });
  if (!post) return NextResponse.json({ error: 'Não consegui salvar o pedido. Tente de novo.' }, { status: 500 });

  // foto escolhida pelo Claude olhando as candidatas (mesma qualidade da semana)
  const [pick] = await pickWithVision(company, [{
    id: post.id, kind: post.kind, layout: post.layout ?? 'foto-faixa', date_label: post.date_label,
    headline: post.art_headline ?? post.title, caption: post.caption, art_photo: post.art_photo, art_product: post.art_product,
  }]).catch(() => [null]);
  if (pick?.asset_id || pick?.stock_photo_url) {
    await db.from('posts').update({ layout: pick.layout, asset_id: pick.asset_id, stock_photo_url: pick.stock_photo_url, bg_photo_url: pick.bg_photo_url ?? null, art_version: (post.art_version ?? 1) + 1 }).eq('id', post.id);
  }
  if (b.kind === 'reels') await buildReel(post.id).catch((e) => console.error('[reels]', e));

  // pedido do cliente vai direto para ele aprovar; pedido feito pelo gestor fica como rascunho na fila dele
  const direct = me.role !== 'gestor';
  if (direct) await db.from('posts').update({ status: 'aguardando' }).eq('id', post.id);
  const urgent = b.day <= new Date(Date.now() - 3 * 3600e3 + 864e5).toISOString().slice(0, 10);
  await notifyGestor(cid, 'pedido', `${urgent ? 'URGENTE · ' : ''}${company.name} pediu um ${b.kind} para ${b.day.split('-').reverse().join('/')}: "${b.topic.slice(0, 120)}"${direct ? ' (já entregue ao cliente)' : ''}`);
  return NextResponse.json({ ok: true, postId: post.id, delivered: direct });
}
