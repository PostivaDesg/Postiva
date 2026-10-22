// Cliente pede ajuste. O Claude refaz o post e ele volta para aprovação.
import { NextResponse } from 'next/server';
import { currentProfile, supabaseAdmin } from '@/lib/supabase';
import { PLANS, type PlanId } from '@/lib/plans';
import { revisePiece } from '@/lib/claude';
import { buildBrand } from '@/lib/brand';
import { photosBySubject } from '@/lib/art/assets';
import { pickStockPhotos } from '@/lib/art/stock';
import { recordFeedback } from '@/lib/learning';
import { withFiveHashtags } from '@/lib/hashtags';

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
  await recordFeedback(post.company_id, 'ajuste', { post_kind: post.kind, title: post.title, art_photo: post.art_photo, note });

  const { piece, usage } = await revisePiece(
    buildBrand(company, brand),
    {
      kind: post.kind, day: post.scheduled_at.slice(0, 10), time: post.scheduled_at.slice(11, 16),
      title: post.title, caption: post.caption, art_brief: post.art_brief, reason: post.reason ?? '',
      art_headline: post.art_headline ?? post.title, art_sub: post.art_sub, art_cta: post.art_cta, art_items: post.art_items,
      art_photo: post.art_photo ?? null,
    },
    note,
  );

  // "trocar a foto" (ou um tema novo de foto): próxima foto própria do rodízio ou outra foto de banco
  const wantsPhoto = /foto|imagem/i.test(note) || (piece.art_photo && piece.art_photo !== post.art_photo);
  let photoPatch: Record<string, unknown> = {};
  if (wantsPhoto) {
    const own = (await photosBySubject(post.company_id, [{ art_photo: piece.art_photo, art_product: piece.art_product }]))[0];
    const stock = own ? null : (await pickStockPhotos(post.company_id, [piece.art_photo ?? post.art_photo]))[0];
    photoPatch = { asset_id: own, stock_photo_url: stock ?? post.stock_photo_url };
  }

  await db.from('posts').update({
    title: piece.title, caption: withFiveHashtags(post.kind, piece.caption, company), art_brief: piece.art_brief, reason: piece.reason,
    art_headline: (piece.art_headline ?? post.art_headline ?? piece.title).slice(0, 90),
    art_sub: piece.art_sub ?? null, art_cta: piece.art_cta ?? null,
    art_items: Array.isArray(piece.art_items) ? piece.art_items.slice(0, 4) : post.art_items,
    status: 'aguardando', change_requests: post.change_requests + 1,
    art_version: (post.art_version ?? 1) + 1, // a imagem é gerada de novo com o texto novo
    art_photo: piece.art_photo ?? post.art_photo ?? null,
    ...photoPatch,
  }).eq('id', id);
  await db.from('ai_usage').insert({ company_id: post.company_id, ...usage });

  return NextResponse.json({ ok: true });
}
