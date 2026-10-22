// Cliente pede para refazer (com o motivo). O Claude refaz texto e foto e devolve direto para o cliente,
// sem passar pela revisão da equipe. O motivo vira aprendizado da empresa (lib/learning.ts).
import { NextResponse } from 'next/server';
import { buildReel } from '@/lib/reels';
import { currentProfile, supabaseAdmin } from '@/lib/supabase';
import { PLANS, type PlanId } from '@/lib/plans';
import { revisePiece } from '@/lib/claude';
import { buildBrand } from '@/lib/brand';
import { photosBySubject } from '@/lib/art/assets';
import { pickStockPhotos } from '@/lib/art/stock';
import { recordFeedback } from '@/lib/learning';
import { pickWithVision } from '@/lib/art/pick';
import { withFiveHashtags } from '@/lib/hashtags';

export const maxDuration = 300;

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { note } = await req.json() as { note: string };
  const me = await currentProfile();
  if (!me) return NextResponse.json({ error: 'Faça login.' }, { status: 401 });
  if (!note?.trim() || note.trim().length < 4) return NextResponse.json({ error: 'Conte o que você não gostou: é assim que a IA aprende o gosto da sua empresa.' }, { status: 400 });

  const db = supabaseAdmin();
  const { data: post } = await db.from('posts').select('*').eq('id', id).single();
  if (!post || (me.role !== 'gestor' && post.company_id !== me.company_id)) {
    return NextResponse.json({ error: 'Post não encontrado.' }, { status: 404 });
  }
  const { data: company } = await db.from('companies').select('*').eq('id', post.company_id).single();
  const { data: brand } = await db.from('brand_profiles').select('*').eq('company_id', post.company_id).single();
  // limite por semana (segunda a domingo, horário de Brasília), somando todos os posts da empresa
  const limit = PLANS[company.plan as PlanId].changesPerWeek;
  const now = new Date(Date.now() - 3 * 3600e3);
  const monday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - ((now.getUTCDay() + 6) % 7), 3));
  const { count } = await db.from('feedback').select('id', { count: 'exact', head: true })
    .eq('company_id', post.company_id).eq('kind', 'ajuste').gte('created_at', monday.toISOString());
  if (me.role !== 'gestor' && (count ?? 0) >= limit) {
    return NextResponse.json({ error: `Você já usou as ${limit} refações desta semana. Elas renovam na segunda-feira; se precisar antes, fale com a equipe.` }, { status: 409 });
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
    // o Claude olha as fotos candidatas e escolhe a que combina com o texto novo
    const [pick] = await pickWithVision(company, [{
      id: post.id, kind: post.kind, layout: post.layout ?? 'foto-faixa', date_label: post.date_label,
      headline: piece.art_headline ?? post.art_headline ?? piece.title, caption: piece.caption,
      art_photo: piece.art_photo ?? post.art_photo, art_product: piece.art_product ?? post.art_product,
    }]).catch(() => [null]);
    if (pick?.asset_id || pick?.stock_photo_url) photoPatch = { layout: pick.layout, asset_id: pick.asset_id, stock_photo_url: pick.stock_photo_url, bg_photo_url: pick.bg_photo_url ?? null };
    else {
      const own = (await photosBySubject(post.company_id, [{ art_photo: piece.art_photo, art_product: piece.art_product }]))[0];
      const stock = own ? null : (await pickStockPhotos(post.company_id, [piece.art_photo ?? post.art_photo]))[0];
      photoPatch = { asset_id: own, stock_photo_url: stock ?? post.stock_photo_url };
    }
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
    // reels com vídeo automático: novas cenas e o vídeo é montado de novo (vídeo enviado pelo cliente fica)
    ...(post.kind === 'reels' && (post.video_auto || !post.video_path)
      ? { video_path: null, video_auto: false, reel_scenes: Array.isArray(piece.reel_scenes) ? piece.reel_scenes.slice(0, 4) : post.reel_scenes }
      : {}),
  }).eq('id', id);
  if (post.kind === 'reels' && (post.video_auto || !post.video_path)) await buildReel(id).catch((e) => console.error('[reels]', e));
  await db.from('ai_usage').insert({ company_id: post.company_id, ...usage });

  return NextResponse.json({ ok: true });
}
