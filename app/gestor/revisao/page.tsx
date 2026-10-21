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
    .select('id, kind, scheduled_at, title, caption, art_brief, reason, quick_request, promo_item_ids, art_version, art_url, companies(name)')
    .eq('status', 'rascunho').order('scheduled_at').limit(200);

  const items = (data ?? []).map((p) => {
    const rel = p.companies as unknown as { name: string } | { name: string }[] | null;
    return {
      id: p.id, kind: p.kind, scheduledAt: p.scheduled_at, title: p.title, caption: p.caption,
      artBrief: p.art_brief, reason: p.reason, quickRequest: p.quick_request,
      isPromo: !!p.promo_item_ids?.length,
      art: p.art_url ?? artUrl(p.id, p.art_version, false),
      company: (Array.isArray(rel) ? rel[0] : rel)?.name ?? '',
    };
  });

  return (
    <main className="wrap" style={{ display: 'grid', gap: 16 }}>
      <Link href="/gestor">← Todas as empresas</Link>
      <h1 style={{ margin: 0 }}>Fila de revisão · {items.length} rascunhos</h1>
      <p className="muted" style={{ margin: 0 }}>Edite direto no card. "Liberar" manda para o cliente aprovar; "Descartar" devolve a peça para a cota.</p>
      <ReviewQueue items={items} />
    </main>
  );
}
