// Relatório do mês (o cliente salva em PDF pelo botão do navegador; sem custo de ferramenta).
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { currentProfile, supabaseAdmin } from '@/lib/supabase';
import { PLANS, type PlanId } from '@/lib/plans';
import PrintButton from './PrintButton';

const KIND: Record<string, string> = { story: 'Stories', post: 'Posts', reels: 'Reels' };

export default async function Relatorio({ searchParams }: { searchParams: Promise<{ mes?: string; companyId?: string }> }) {
  const sp = await searchParams;
  const me = await currentProfile();
  if (!me) redirect('/login');
  const cid = me.role === 'gestor' ? sp.companyId : me.company_id;
  if (!cid) redirect('/gestor');

  const now = new Date(Date.now() - 3 * 3600e3);
  const month = /^\d{4}-\d{2}$/.test(sp.mes ?? '') ? sp.mes! : `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
  const [y, m] = month.split('-').map(Number);
  const start = new Date(Date.UTC(y, m - 1, 1, 3)).toISOString();
  const end = new Date(Date.UTC(y, m, 1, 3)).toISOString();

  const db = supabaseAdmin();
  const [{ data: company }, { data: posts }, { data: clicks }] = await Promise.all([
    db.from('companies').select('name, plan').eq('id', cid).single(),
    db.from('posts').select('id, kind, status, title, scheduled_at, date_label, promo_item_ids').eq('company_id', cid).gte('scheduled_at', start).lt('scheduled_at', end),
    db.from('link_clicks').select('post_id, code').eq('company_id', cid).gte('created_at', start).lt('created_at', end),
  ]);
  if (!company) redirect('/painel');

  const published = (posts ?? []).filter((p) => ['agendado', 'publicado'].includes(p.status));
  const byKind = ['story', 'post', 'reels'].map((k) => ({ k, n: published.filter((p) => p.kind === k).length }));
  const byPost = new Map<string, number>();
  for (const c of clicks ?? []) if (c.post_id) byPost.set(c.post_id, (byPost.get(c.post_id) ?? 0) + 1);
  const top = [...byPost.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5)
    .map(([id, n]) => ({ n, post: (posts ?? []).find((p) => p.id === id) })).filter((x) => x.post);
  const bio = (clicks ?? []).filter((c) => c.code.startsWith('bio-')).length;
  const monthName = new Date(Date.UTC(y, m - 1, 15)).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric', timeZone: 'UTC' });

  return (
    <div className="pilha" style={{maxWidth: 820}}>
      <div className="no-print" style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
        <PrintButton />
      </div>
      <header>
        <p className="muted" style={{ margin: 0 }}>Relatório Postiva Design · Plano {PLANS[company.plan as PlanId].name}</p>
        <h1 style={{ margin: '4px 0 0' }}>{company.name} · {monthName}</h1>
      </header>

      <section className="grid" aria-label="Números do mês">
        {byKind.map(({ k, n }) => <div className="card" key={k}><span className="muted">{KIND[k]} publicados</span><div style={{ fontSize: 30, fontWeight: 600 }}>{n}</div></div>)}
        <div className="card"><span className="muted">Cliques no WhatsApp</span><div style={{ fontSize: 30, fontWeight: 600 }}>{clicks?.length ?? 0}</div><span className="muted" style={{ fontSize: 13 }}>{bio} pela bio</span></div>
      </section>

      <section className="card">
        <h2 style={{ marginTop: 0 }}>O que mais trouxe contato</h2>
        {top.length ? (
          <ol style={{ margin: 0, paddingLeft: 20, lineHeight: 1.8 }}>
            {top.map(({ n, post }) => <li key={post!.id}>{post!.title} <span className="muted">({KIND[post!.kind]}, {n} cliques)</span></li>)}
          </ol>
        ) : <p className="muted" style={{ margin: 0 }}>Ainda sem cliques registrados. Use o link da bio e os adesivos de link nos stories.</p>}
      </section>

      <section className="card">
        <h2 style={{ marginTop: 0 }}>Destaques</h2>
        <ul style={{ margin: 0, paddingLeft: 20, lineHeight: 1.8 }}>
          <li>{published.filter((p) => p.promo_item_ids?.length).length} peças de promoção</li>
          <li>{published.filter((p) => p.date_label).length} peças de datas comemorativas</li>
          <li>{(posts ?? []).filter((p) => p.status === 'aguardando').length} posts ainda esperando aprovação</li>
        </ul>
      </section>
      <p className="muted" style={{ fontSize: 13 }}>Alcance e seguidores: veja no Metricool ou nos insights do Instagram. No plano Pleno, a análise humanizada vem junto com este relatório.</p>
    </div>
  );
}
