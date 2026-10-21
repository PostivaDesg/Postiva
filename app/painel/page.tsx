// Painel do cliente: cota do mês + posts da semana com aprovação.
import { redirect } from 'next/navigation';
import { currentProfile, supabaseUser, supabaseAdmin } from '@/lib/supabase';
import { PLANS, type PlanId } from '@/lib/plans';
import PostCard from './PostCard';
import { trackedLink } from '@/lib/tracking';
import { artUrl } from '@/lib/art/url';
import ApproveAll from './ApproveAll';
import VideoUpload from './VideoUpload';

const KIND = { story: 'Story', post: 'Post', reels: 'Reels' } as const;

export default async function Painel() {
  const me = await currentProfile();
  if (!me) redirect('/login');
  if (me.role === 'gestor') redirect('/gestor');

  const db = supabaseAdmin();
  const { data: company } = await db.from('companies').select('*').eq('id', me.company_id!).single();
  if (!company?.setup_done) {
    return <main className="wrap"><h1>Estamos preparando sua marca</h1><p className="muted">A equipe Postiva Design está configurando tudo. Você recebe um aviso no WhatsApp quando a primeira semana estiver pronta.</p></main>;
  }
  const plan = PLANS[company.plan as PlanId];

  // Lido com a sessão do cliente: o RLS garante que só vem a empresa dele
  const sb = await supabaseUser();
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const { data: posts } = await sb.from('posts').select('*').gte('scheduled_at', monthStart).order('scheduled_at');

  const pending = (posts ?? []).filter((p) => p.status === 'aguardando');
  const { data: notes } = await sb.from('notifications').select('id, message').eq('audience', 'cliente')
    .order('created_at', { ascending: false }).limit(5);
  const { data: clickRows } = await sb.from('link_clicks').select('post_id').gte('created_at', monthStart);
  const clicks = clickRows ?? [];
  const byPost = new Map<string, number>();
  for (const c of clicks) if (c.post_id) byPost.set(c.post_id, (byPost.get(c.post_id) ?? 0) + 1);
  const topPosts = [...byPost.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3)
    .map(([id, n]) => `${(posts ?? []).find((p) => p.id === id)?.title ?? 'post'} (${n})`);
  const used = (k: string) => (posts ?? []).filter((p) => p.kind === k).length;
  const days = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const quotas = [
    { label: 'Stories', used: used('story'), total: plan.storiesPerDay * days },
    { label: 'Posts', used: used('post'), total: plan.postsPerDay * days },
    { label: 'Reels', used: used('reels'), total: plan.reelsPerWeek * Math.ceil(days / 7) },
  ].filter((q) => q.total > 0);

  return (
    <main className="wrap" style={{ display: 'grid', gap: 24 }}>
      <header>
        <p className="muted" style={{ margin: 0 }}>{company.name} · Plano {plan.name}</p>
        <h1 style={{ margin: '4px 0 0' }}>{pending.length ? `${pending.length} posts esperando você` : 'Tudo em dia por aqui'}</h1>
        <nav style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }} aria-label="Ações">
          <a className="btn" href="/promocoes" style={{ display: 'inline-flex', alignItems: 'center', textDecoration: 'none' }}>Criar promoção</a>
          <a className="btn ghost" href="/pedido" style={{ display: 'inline-flex', alignItems: 'center', textDecoration: 'none' }}>Pedido rápido</a>
          <a className="btn ghost" href="/minha-marca" style={{ display: 'inline-flex', alignItems: 'center', textDecoration: 'none' }}>Minha marca</a>
          <a className="btn ghost" href="/relatorio" style={{ display: 'inline-flex', alignItems: 'center', textDecoration: 'none' }}>Relatório do mês</a>
          <a className="btn ghost" href="/conta" style={{ display: 'inline-flex', alignItems: 'center', textDecoration: 'none' }}>Minha conta</a>
        </nav>
      </header>

      {!!notes?.length && (
        <section className="card" aria-label="Avisos">
          <h2 style={{ marginTop: 0 }}>Avisos</h2>
          <ul style={{ margin: 0, paddingLeft: 18, lineHeight: 1.7 }}>{notes.map((n) => <li key={n.id}>{n.message}</li>)}</ul>
        </section>
      )}

      <section className="card" aria-label="Resultados">
        <h2 style={{ marginTop: 0 }}>Pedidos vindos do Instagram</h2>
        <p style={{ margin: 0, fontSize: 28, fontWeight: 600 }}>{clicks.length} <span className="muted" style={{ fontSize: 15, fontWeight: 400 }}>cliques no WhatsApp este mês</span></p>
        {topPosts.length > 0 && <p className="muted" style={{ marginBottom: 0 }}>Os que mais trouxeram contato: {topPosts.join(' · ')}</p>}
        {company.bio_code && <p className="muted" style={{ fontSize: 13, marginBottom: 0 }}>Link para a bio do Instagram: {trackedLink(company.bio_code)}</p>}
      </section>

      <section className="grid" aria-label="Uso do plano">
        {quotas.map((q) => (
          <div className="card" key={q.label}>
            <strong>{q.label}</strong>
            <div style={{ fontSize: 24, fontWeight: 600, margin: '6px 0' }}>{q.used} <span className="muted" style={{ fontSize: 14 }}>de {q.total} no mês</span></div>
          </div>
        ))}
      </section>

      {(posts ?? []).some((p) => p.kind === 'reels' && !p.video_path && ['aguardando', 'aprovado'].includes(p.status)) && (
        <section className="card" aria-label="Reels esperando vídeo" style={{ display: 'grid', gap: 14 }}>
          <h2 style={{ margin: 0 }}>Reels esperando o vídeo</h2>
          <p className="muted" style={{ margin: 0 }}>Grave seguindo o roteiro da legenda e envie aqui. Depois de aprovado, ele é agendado sozinho.</p>
          {(posts ?? []).filter((p) => p.kind === 'reels' && !p.video_path && ['aguardando', 'aprovado'].includes(p.status))
            .map((p) => <VideoUpload key={p.id} postId={p.id} title={p.title} />)}
        </section>
      )}

      <section aria-label="Para aprovar" style={{ display: 'grid', gap: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <h2 style={{ margin: 0 }}>Para aprovar</h2>
          {pending.length > 1 && <ApproveAll count={pending.length} />}
        </div>
        {pending.length === 0 && <p className="muted">Nenhum post pendente.</p>}
        <div className="grid">
          {pending.map((p) => (
            <PostCard key={p.id} id={p.id} kind={KIND[p.kind as keyof typeof KIND]} when={new Date(p.scheduled_at).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', weekday: 'short', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
              title={p.title} caption={p.caption} reason={p.reason} artUrl={p.art_url ?? artUrl(p.id, p.art_version, false)} />
          ))}
        </div>
      </section>

      <section aria-label="Calendário" className="card">
        <h2 style={{ marginTop: 0 }}>Calendário do mês</h2>
        <ul style={{ margin: 0, paddingLeft: 18, lineHeight: 1.8 }}>
          {(posts ?? []).map((p) => (
            <li key={p.id}>{new Date(p.scheduled_at).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })} · {KIND[p.kind as keyof typeof KIND]} · {p.title} · <span className="muted">{p.status}</span></li>
          ))}
        </ul>
      </section>
    </main>
  );
}
