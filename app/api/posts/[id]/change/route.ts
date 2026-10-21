// Cliente pede ajuste. O Claude refaz o post e ele volta para aprovação.
import { NextResponse } from 'next/server';
import { currentProfile, supabaseAdmin } from '@/lib/supabase';
import { PLANS, type PlanId } from '@/lib/plans';
import { revisePiece } from '@/lib/claude';
import { buildBrand } from '@/lib/brand';
import { pickPhotos } from '@/lib/art/assets';

export const maxDuration = 120;

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { note } = await req.json() as { note: string };
  const me = await currentProfile();
  if (!me) return NextResponse.json({ error: 'Faça login.' }, { status: 401 });
  if (!note?.trim()) return NextResponse.json({ error: 'Diga o que quer mudar.' }, { status: 400 });

  const db = supabaseAdmin();
  const { data: post } = await db.from('posts').select('*').eq('id', id).single();
  if (!post || (me.role !== 'gestor' && post.company_id !== me.company_id)) {
    return NextResponse.json({ error: 'Post não encontrado.' }, { status: 404 });
  }
  const { data: company } = await db.from('companies').select('*').eq('id', post.company_id).single();
  const { data: brand } = await db.from('brand_profiles').select('*').eq('company_id', post.company_id).single();
  const limit = PLANS[company.plan as PlanId].changesPerPost;
  if (post.change_requests >= limit) {
    return NextResponse.json({ error: `Seu plano inclui ${limit} ajustes por post. Fale com a equipe.` }, { status: 409 });
  }

  await db.from('posts').update({ status: 'ajuste', change_note: note }).eq('id', id);

  const { piece, usage } = await revisePiece(
    buildBrand(company, brand),
    {
      kind: post.kind, day: post.scheduled_at.slice(0, 10), time: post.scheduled_at.slice(11, 16),
      title: post.title, caption: post.caption, art_brief: post.art_brief, reason: post.reason ?? '',
      art_headline: post.art_headline ?? post.title, art_sub: post.art_sub, art_cta: post.art_cta, art_items: post.art_items,
    },
    note,
  );

  await db.from('posts').update({
    title: piece.title, caption: piece.caption, art_brief: piece.art_brief, reason: piece.reason,
    art_headline: (piece.art_headline ?? post.art_headline ?? piece.title).slice(0, 90),
    art_sub: piece.art_sub ?? null, art_cta: piece.art_cta ?? null,
    art_items: Array.isArray(piece.art_items) ? piece.art_items.slice(0, 4) : post.art_items,
    status: 'aguardando', change_requests: post.change_requests + 1,
    art_version: (post.art_version ?? 1) + 1, // a imagem é gerada de novo com o texto novo
    // "trocar a foto": usa a próxima foto do rodízio
    ...(/foto|imagem/i.test(note) ? { asset_id: (await pickPhotos(post.company_id, [post.layout ?? 'foto-cheia']))[0] } : {}),
  }).eq('id', id);
  await db.from('ai_usage').insert({ company_id: post.company_id, ...usage });

  return NextResponse.json({ ok: true });
}
