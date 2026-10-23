// Fila única: rascunhos de TODAS as empresas, do que vai ao ar primeiro para o último.
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { currentProfile, supabaseAdmin } from '@/lib/supabase';
import ReviewQueue from './ReviewQueue';
import { artUrl } from '@/lib/art/url';

export default async function Revisao() {
  const me = await currentProfile();
  if (me?.role !== 'gestor') redirect('/login');

  const { data } = await supabaseAdmin().from('posts')
    .select('id, kind, scheduled_at, title, caption, art_brief, reason, quick_request, promo_item_ids, art_version, art_url, video_path, companies(name)')
    .eq('status', 'rascunho').order('scheduled_at').limit(200);

  // reels com vídeo pronto: link assinado para tocar na própria fila
  const db = supabaseAdmin();
  const videos = new Map<string, string>();
  await Promise.all((data ?? []).filter((p) => p.kind === 'reels' && p.video_path).map(async (p) => {
    const { data: v } = await db.storage.from('videos').createSignedUrl(p.video_path as string, 3600);
    if (v?.signedUrl) videos.set(p.id, v.signedUrl);
  }));

  const items = (data ?? []).map((p) => {
    const rel = p.companies as unknown as { name: string } | { name: string }[] | null;
    return {
      id: p.id, kind: p.kind, scheduledAt: p.scheduled_at, title: p.title, caption: p.caption,
      artBrief: p.art_brief, reason: p.reason, quickRequest: p.quick_request,
      isPromo: !!p.promo_item_ids?.length,
      art: p.art_url ?? artUrl(p.id, p.art_version, false),
      video: videos.get(p.id) ?? null,
      company: (Array.isArray(rel) ? rel[0] : rel)?.name ?? '',
    };
  });

  return (
    <div className="pilha" style={{}}>
      <header className="cabecalho">
        <div><h1>Fila de revisão</h1>
          <p>{items.length ? `${items.length} ${items.length === 1 ? 'rascunho' : 'rascunhos'}, do que vai ao ar primeiro para o último. Edite direto no texto; "Liberar" manda para o cliente aprovar e "Descartar" devolve a peça para a cota.` : 'Nenhum rascunho para revisar.'}</p></div>
      </header>
      <ReviewQueue items={items} />
    </div>
  );
}
