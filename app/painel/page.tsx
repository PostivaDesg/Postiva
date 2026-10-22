// Início do cliente: a semana no Instagram (artes reais), resultados, uso do plano e avisos.
// Antes da primeira semana, mostra o passo a passo do que falta (com o que já foi feito marcado).
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { currentProfile, supabaseAdmin } from '@/lib/supabase';
import { PLANS, type PlanId } from '@/lib/plans';
import { trackedLink } from '@/lib/tracking';
import { artUrl } from '@/lib/art/url';
import BarChart from '@/components/BarChart';
import { KIND, STATUS, diaCurto, lastDays, ymd, tz } from '@/lib/ui';

export const dynamic = 'force-dynamic';

export default async function Inicio() {
  const me = await currentProfile();
  if (!me) redirect('/login');
  if (me.role === 'gestor') redirect('/gestor');
  const cid = me.company_id!;
  const db = supabaseAdmin();
  const now = new Date();
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 3)).toISOString();
  const days30 = lastDays(30);

  const [{ data: company }, { data: assets }, { data: posts }, { data: clicks }, { data: notes }] = await Promise.all([
    db.from('companies').select('*').eq('id', cid).single(),
    db.from('company_assets').select('kind').eq('company_id', cid),
    db.from('posts').select('id, kind, status, title, scheduled_at, art_version, art_url')
      .eq('company_id', cid).neq('status', 'rascunho').gte('scheduled_at', monthStart).order('scheduled_at'),
    db.from('link_clicks').select('post_id, code, created_at').eq('company_id', cid).gte('created_at', `${days30[0]}T03:00:00Z`),
    db.from('notifications').select('id, message, created_at').eq('company_id', cid).eq('audience', 'cliente').order('created_at', { ascending: false }).limit(5),
  ]);
  if (!company) redirect('/login');
  const plan = PLANS[company.plan as PlanId];
  const firstName = (me.full_name ?? '').split(' ')[0];

  // ---------- antes da primeira semana: o que falta ----------
  if (!company.setup_done) {
    const has = (k: string) => (assets ?? []).some((a) => a.kind === k);
    const steps = [
      { done: has('logo'), title: 'Envie o logo', text: 'PNG ou JPG, de preferência sem fundo.', href: '/minha-marca', cta: 'Enviar logo' },
      { done: (company.brand_colors ?? []).length > 0, title: 'Escolha as cores da marca', text: 'Até 4 cores. Elas aparecem em todas as artes.', href: '/minha-marca', cta: 'Escolher cores' },
      { done: ['loja', 'equipe', 'produto'].some(has), title: 'Mande fotos reais', text: 'Fachada, balcão, equipe e produtos deixam os posts com a cara da sua loja.', href: '/minha-marca', cta: 'Enviar fotos' },
      { done: has('referencia'), title: 'Mostre posts de que você gosta', text: '3 a 5 prints guiam o estilo do seu modelo.', href: '/minha-marca', cta: 'Enviar exemplos' },
      { done: company.template_status === 'aprovado', title: 'Aprove o seu modelo visual', text: 'Desenhamos um modelo exclusivo a partir do logo e dos exemplos.', href: '/minha-marca', cta: 'Ver o modelo' },
    ];
    const left = steps.filter((s) => !s.done).length;
    return (
      <div className="pilha">
        <header className="cabecalho">
          <div>
            <h1>{firstName ? `Olá, ${firstName}.` : 'Olá!'} Vamos montar o Instagram da {company.name}.</h1>
            <p>{left ? `Faltam ${left} ${left === 1 ? 'passo' : 'passos'} da sua parte. Depois disso, a primeira semana de posts chega aqui para você aprovar.` : 'Sua parte está pronta. A primeira semana de posts está sendo preparada e chega aqui para você aprovar.'}</p>
          </div>
        </header>
        <div className="duas">
          <section className="painel" aria-label="Passo a passo">
            <div className="painel-titulo"><h2>Para começar</h2><span className="muted">{steps.length - left} de {steps.length} feitos</span></div>
            <ol className="passos">
              {steps.map((s) => (
                <li key={s.title} className={s.done ? 'feito' : ''}>
                  <div><strong>{s.title}</strong><small>{s.text}</small></div>
                  {s.done ? <span className="status aprovado">Feito</span> : <Link className="btn pequeno" href={s.href}>{s.cta}</Link>}
                </li>
              ))}
            </ol>
          </section>
          <section className="painel" aria-label="Seu plano">
            <div className="painel-titulo"><h2>Plano {plan.name}</h2></div>
            <div className="pilha" style={{ gap: 14 }}>
              <p style={{ margin: 0 }}>Todo mês, com arte exclusiva da sua marca:</p>
              <ul className="avisos">
                {plan.storiesPerDay > 0 && <li>{plan.storiesPerDay} stories por dia</li>}
                {plan.postsPerDay > 0 && <li>{plan.postsPerDay} {plan.postsPerDay === 1 ? 'post' : 'posts'} no feed por dia</li>}
                {plan.reelsPerWeek > 0 && <li>{plan.reelsPerWeek} {plan.reelsPerWeek === 1 ? 'reels' : 'reels'} por semana</li>}
                <li>Datas comemorativas com arte própria</li>
                <li>Link de WhatsApp que conta quantos contatos cada post trouxe</li>
              </ul>
              <p className="muted" style={{ margin: 0, fontSize: 14 }}>Você aprova cada post antes de ir ao ar, ou pede um ajuste com um clique.</p>
            </div>
          </section>
        </div>
      </div>
    );
  }

  // ---------- dia a dia ----------
  const all = posts ?? [];
  const today = ymd(now);
  const in7 = ymd(new Date(now.getTime() + 7 * 864e5));
  const week = all.filter((p) => { const d = ymd(new Date(p.scheduled_at)); return d >= today && d < in7; });
  const pending = all.filter((p) => p.status === 'aguardando');
  const live = all.filter((p) => ['agendado', 'publicado'].includes(p.status));
  const monthClicks = (clicks ?? []).filter((c) => c.created_at >= monthStart);
  const perDay = days30.map((d) => ({ x: d.slice(8, 10) + '/' + d.slice(5, 7), y: (clicks ?? []).filter((c) => ymd(new Date(c.created_at)) === d).length }));
  const byPost = new Map<string, number>();
  for (const c of monthClicks) if (c.post_id) byPost.set(c.post_id, (byPost.get(c.post_id) ?? 0) + 1);
  const top = [...byPost.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([id, n]) => ({ n, p: all.find((p) => p.id === id) })).filter((x) => x.p);

  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const used = (k: string) => all.filter((p) => p.kind === k).length;
  const quotas = [
    { label: 'Stories', used: used('story'), total: plan.storiesPerDay * daysInMonth },
    { label: 'Posts', used: used('post'), total: plan.postsPerDay * daysInMonth },
    { label: 'Reels', used: used('reels'), total: plan.reelsPerWeek * Math.ceil(daysInMonth / 7) },
  ].filter((q) => q.total > 0);
  const hour = Number(new Date().toLocaleString('pt-BR', { timeZone: tz, hour: '2-digit', hour12: false }));
  const ola = hour < 12 ? 'Bom dia' : hour < 18 ? 'Boa tarde' : 'Boa noite';

  return (
    <div className="pilha">
      <header className="cabecalho">
        <div>
          <h1>{ola}{firstName ? `, ${firstName}` : ''}.</h1>
          <p>{pending.length
            ? `${pending.length} ${pending.length === 1 ? 'post espera' : 'posts esperam'} a sua aprovação para irem ao ar.`
            : 'Nada esperando você. Os próximos posts já estão no calendário.'}</p>
        </div>
        <div className="acoes">
          {pending.length > 0 && <Link className="btn" href="/painel/aprovar">Aprovar posts</Link>}
          <Link className="btn ghost" href="/pedido">Pedir um post</Link>
        </div>
      </header>

      <section className="numeros" aria-label="Números do mês">
        <div className="numero destaque"><span>Contatos no WhatsApp</span><b>{monthClicks.length}</b><small>neste mês, vindos do Instagram</small></div>
        <div className="numero"><span>No ar ou agendados</span><b>{live.length}</b><small>peças neste mês</small></div>
        <div className="numero"><span>Esperando você</span><b>{pending.length}</b><small>{pending.length ? 'aprovação pendente' : 'tudo aprovado'}</small></div>
        <div className="numero"><span>Plano</span><b style={{ fontSize: 24 }}>{plan.name}</b><small>{company.name}</small></div>
      </section>

      <section className="painel" aria-label="Próximos 7 dias">
        <div className="painel-titulo">
          <div><h2>Próximos 7 dias no seu Instagram</h2><p>As artes como vão aparecer. Toque para ver a legenda.</p></div>
          <Link href="/painel/calendario">Ver o mês todo</Link>
        </div>
        {week.length ? (
          <div className="filme">
            {week.map((p) => (
              <Link key={p.id} href={p.status === 'aguardando' ? `/painel/aprovar#p-${p.id}` : '/painel/calendario'} className="quadro">
                <figure className={p.kind === 'story' ? 'story' : ''}>
                  <img src={p.art_url ?? artUrl(p.id, p.art_version, false)} alt={`Arte: ${p.title}`} loading="lazy" />
                  <span className={`status ${p.status}`}>{STATUS[p.status] ?? p.status}</span>
                </figure>
                <strong>{p.title}</strong>
                <small>{KIND[p.kind]} · {new Date(p.scheduled_at).toLocaleString('pt-BR', { timeZone: tz, weekday: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit' })}</small>
              </Link>
            ))}
          </div>
        ) : (
          <div className="vazio">
            <h3>A próxima semana está sendo preparada</h3>
            <p>Os posts aparecem aqui assim que a equipe terminar a revisão. Se precisar de algo antes, faça um pedido rápido.</p>
            <Link className="btn ghost pequeno" href="/pedido">Pedir um post</Link>
          </div>
        )}
      </section>

      <div className="duas">
        <section className="painel" aria-label="Contatos por dia">
          <div className="painel-titulo"><div><h2>Contatos no WhatsApp por dia</h2><p>Últimos 30 dias. Cada clique no link do post ou da bio conta aqui.</p></div></div>
          {(clicks ?? []).length
            ? <BarChart data={perDay} label="Cliques no WhatsApp por dia, últimos 30 dias" />
            : <div className="vazio"><p>Ainda sem cliques. Coloque o link abaixo na bio do Instagram e use o adesivo de link nos stories: cada contato passa a ser contado.</p></div>}
          {top.length > 0 && (
            <div style={{ marginTop: 16 }}>
              <h3 style={{ marginBottom: 8 }}>Os posts que mais trouxeram contato</h3>
              <ul className="avisos">{top.map(({ n, p }) => <li key={p!.id}><span><strong>{p!.title}</strong> <span className="muted">· {n} {n === 1 ? 'contato' : 'contatos'}</span></span></li>)}</ul>
            </div>
          )}
          {company.bio_code && <p className="muted" style={{ fontSize: 13.5, margin: '14px 0 0' }}>Link para a bio: <strong style={{ color: 'var(--texto)', wordBreak: 'break-all' }}>{trackedLink(company.bio_code)}</strong></p>}
        </section>

        <div className="pilha">
          <section className="painel" aria-label="Uso do plano">
            <div className="painel-titulo"><h2>Uso do plano em {new Date().toLocaleDateString('pt-BR', { month: 'long', timeZone: tz })}</h2></div>
            <div className="pilha" style={{ gap: 14 }}>
              {quotas.map((q) => (
                <div className="medidor" key={q.label}>
                  <div><span>{q.label}</span><span className="muted">{q.used} de {q.total}</span></div>
                  <progress max={q.total} value={Math.min(q.used, q.total)} aria-label={`${q.label}: ${q.used} de ${q.total}`} />
                </div>
              ))}
            </div>
          </section>
          <section className="painel" aria-label="Avisos">
            <div className="painel-titulo"><h2>Avisos</h2></div>
            {notes?.length
              ? <ul className="avisos">{notes.map((n) => <li key={n.id}><span>{n.message} <span className="muted" style={{ fontSize: 12.5 }}>· {diaCurto(n.created_at)}</span></span></li>)}</ul>
              : <p className="muted" style={{ margin: 0 }}>Nenhum aviso novo. Avisamos aqui quando chegar post para aprovar ou quando um reels precisar do vídeo.</p>}
          </section>
        </div>
      </div>
    </div>
  );
}
