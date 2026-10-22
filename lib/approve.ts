// Aprovação e agendamento.
//  - approvePost: botão "Aprovar", "Aprovar todos" e aprovação automática opcional.
//  - schedulePostNow: agenda no Metricool um post já aprovado (ex.: reels depois que o vídeo chegou).
// Stories e posts têm arte gerada pelo site e vão direto. Reels precisam do vídeo: a arte vira a capa.
import { supabaseAdmin } from './supabase';
import { schedulePost } from './metricool';
import { artUrl } from './art/url';
import { notifyClient, notifyGestor } from './notify';
import { recordFeedback } from './learning';

export async function schedulePostNow(postId: string) {
  const db = supabaseAdmin();
  const { data: post } = await db.from('posts').select('*, companies(metricool_blog_id, name)').eq('id', postId).single();
  if (!post) return 'inexistente';
  const rel = post.companies as any;
  const company = Array.isArray(rel) ? rel[0] : rel;
  if (!company?.metricool_blog_id) return 'aprovado'; // sem Metricool configurado: o alerta avisa o gestor

  let mediaUrl = post.art_url ?? artUrl(post.id, post.art_version);
  if (post.kind === 'reels') {
    if (!post.video_path) return 'aprovado';
    const { data } = await db.storage.from('videos').createSignedUrl(post.video_path, 7 * 86400); // 7 dias
    if (!data?.signedUrl) return 'aprovado';
    mediaUrl = data.signedUrl;
  }
  try {
    const coverUrl = post.kind === 'reels' ? artUrl(post.id, post.art_version) : null; // a arte gerada vira a capa do reels
    const r = await schedulePost({ blogId: company.metricool_blog_id, kind: post.kind, publishAt: post.scheduled_at, caption: post.caption, mediaUrl, coverUrl });
    await db.from('posts').update({ status: 'agendado', metricool_post_id: r.id ?? r.data?.id ?? null }).eq('id', postId);
    return 'agendado';
  } catch (e) {
    console.error('[metricool]', e);
    await notifyGestor(post.company_id, 'agendamento', `${company.name}: falha ao agendar "${post.title}" no Metricool. Confira a conexão do Instagram.`, `falha-${postId}`);
    return 'aprovado';
  }
}

/** manual=false na aprovação automática (não é sinal de que o cliente gostou). */
export async function approvePost(postId: string, manual = true) {
  const db = supabaseAdmin();
  const { data: post } = await db.from('posts').select('id, status, kind, video_path, company_id, title, art_photo').eq('id', postId).single();
  if (!post || post.status !== 'aguardando') return { ok: false as const, status: post?.status ?? 'inexistente' };
  await db.from('posts').update({ status: 'aprovado' }).eq('id', postId);
  if (manual) await recordFeedback(post.company_id, 'aprovado', { post_kind: post.kind, title: post.title, art_photo: post.art_photo });
  if (post.kind === 'reels' && !post.video_path) {
    await notifyClient(post.company_id, 'aprovar', `Reels "${post.title}" aprovado. Envie o vídeo no painel para ele ser agendado.`, `video-${postId}`);
    return { ok: true as const, status: 'aguardando vídeo' };
  }
  return { ok: true as const, status: await schedulePostNow(postId) };
}
