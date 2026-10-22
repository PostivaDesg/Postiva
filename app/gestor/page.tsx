// Visão geral do gestor: dinheiro do mês, produção da semana de cada empresa, alertas e contatos gerados.
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { currentProfile, supabaseAdmin } from '@/lib/supabase';
import { companyEconomics } from '@/lib/gestor-data';
import BarChart from '@/components/BarChart';
import { brl, mondayOf, addDays, lastDays, ymd, tz, diaCurto } from '@/lib/ui';

export const dynamic = 'force-dynamic';

const SEG = [
  { key: 'rascunho', label: 'Rascunho para revisar', cor: 'var(--azul)' },
  { key: 'aguardando', label: 'Com o cliente', cor: 'var(--ambar)' },
  { key: 'pronto', label: 'Aprovado ou agendado', cor: 'var(--verde)' },
];
const seg = (s: string) => (s === 'rascunho' ? 'rascunho' : s === 'aguardando' || s === 'ajuste' ? 'aguardando' : 'pronto');

export default async function Gestor() {
  const me = await currentProfile();
  if (me?.role !== 'gestor') redirect('/login');
  const db = supabaseAdmin();
  const mon = mondayOf();
  const days = Array.from({ length: 7 }, (_, i) => addDays(mon, i));
  const [eco, { data: weekPosts }, { data: alerts }, { count: fila }] = await Promise.all([
    companyEconomics(),
    db.from('posts').select('company_id, status, scheduled_at').gte('scheduled_at', `${days[0]}T03:00:00Z`).lt('scheduled_at', `${addDays(days[6], 1)}T03:00:00Z`),
    db.from('notifications').select('id, message, created_at, company_id').eq('audience', 'gestor').is('read_at', null).order('created_at', { ascending: false }).limit(8),
    db.from('posts').select('id', { count: 'exact', head: true }).eq('status', 'rascunho'),
  ]);

  const d30 = lastDays(30);
  const perDay = d30.map((d) => ({ x: d.slice(8, 10) + '/' + d.slice(5, 7), y: eco.clicks30.filter((c) => ymd(new Date(c.created_at)) === d).length }));
  const companies = eco.rows.map((r) => r.c);
  const waitingClient = new Set((weekPosts ?? []).filter((p) => p.status === 'aguardando').map((p) => p.company_id)).size;
  const noModel = companies.filter((c) => c.template_status !== 'aprovado');
  const today = ymd(new Date());
  const hour = Number(new Date().toLocaleString('pt-BR', { timeZone: tz, hour: '2-digit', hour12: false }));
  const first = (me.full_name ?? '').split(' ')[0];

  return (
    <div className="pilha">
      <header className="cabecalho">
        <div>
          <h1>{hour < 12 ? 'Bom dia' : hour < 18 ? 'Boa tarde' : 'Boa noite'}{first ? `, ${first}` : ''}.</h1>
          <p>{fila ? `${fila} ${fila === 1 ? 'rascunho espera' : 'rascunhos esperam'} a sua revisão` : 'A fila de revisão está vazia'}{waitingClient ? `, e ${waitingClient} ${waitingClient === 1 ? 'empresa tem' : 'empresas têm'} posts esperando o cliente aprovar.` : '.'}</p>
        </div>
        <div className="acoes">
          <Link className="btn" href="/gestor/revisao">Revisar rascunhos</Link>
          <Link className="btn ghost" href="/gestor/nova">Nova empresa</Link>
        </div>
      </header>

      <section className="numeros" aria-label="Resumo do mês">
        <div className="numero destaque"><span>Receita recorrente</span><b>{brl(eco.total.revenue)}</b><small>{eco.paying} {eco.paying === 1 ? 'cliente pagante' : 'clientes pagantes'}{eco.trial ? ` · ${eco.trial} em teste` : ''}</small></div>
        <div className="numero"><span>Margem estimada</span><b style={{ color: eco.total.margin < 0 ? 'var(--vermelho)' : undefined }}>{brl(eco.total.margin)}</b><small>neste mês</small></div>
        <div className="numero"><span>Custo de IA</span><b>{brl(eco.total.ai)}</b><small>todas as empresas, no mês</small></div>
        <div className="numero"><span>Contatos gerados</span><b>{eco.total.clicks}</b><small>cliques no WhatsApp no mês</small></div>
      </section>

      <section className="painel" aria-label="Produção da semana">
        <div className="painel-titulo">
          <div><h2>Produção da semana</h2><p>Peças de cada empresa por dia, de {diaCurto(`${days[0]}T12:00:00Z`)} a {diaCurto(`${days[6]}T12:00:00Z`)}.</p></div>
          <div className="legenda">{SEG.map((s) => <span key={s.key}><i style={{ background: s.cor }} />{s.label}</span>)}</div>
        </div>
        {companies.length ? (
          <div className="rolagem">
            <table className="quadro-semana">
              <thead><tr><th>Empresa</th>{days.map((d) => <th key={d} style={d === today ? { color: 'var(--fucsia)' } : undefined}>{new Date(`${d}T12:00:00Z`).toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', timeZone: 'UTC' })}</th>)}</tr></thead>
              <tbody>
                {companies.map((c) => (
                  <tr key={c.id}>
                    <td className="nome"><Link href={`/gestor/${c.id}`} style={{ color: 'var(--texto)' }}>{c.name}</Link></td>
                    {days.map((d) => {
                      const ps = (weekPosts ?? []).filter((p) => p.company_id === c.id && ymd(new Date(p.scheduled_at)) === d);
                      const counts = SEG.map((s) => ps.filter((p) => seg(p.status) === s.key).length);
                      const title = ps.length ? SEG.map((s, i) => counts[i] ? `${counts[i]} ${s.label.toLowerCase()}` : '').filter(Boolean).join(', ') : 'Nenhuma peça';
                      return (
                        <td key={d} title={title}>
                          {ps.length ? (<>
                            <div className="barra">{SEG.map((s, i) => counts[i] ? <i key={s.key} style={{ background: s.cor, flex: counts[i] }} /> : null)}</div>
                            <span className="q">{ps.length}</span>
                          </>) : <span className="muted">–</span>}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="vazio"><h3>Nenhuma empresa ainda</h3><p>Cadastre a primeira empresa para começar a gerar posts.</p><Link className="btn pequeno" href="/gestor/nova">Cadastrar empresa</Link></div>
        )}
      </section>

      <div className="duas">
        <section className="painel" aria-label="Contatos por dia">
          <div className="painel-titulo"><div><h2>Contatos gerados por dia</h2><p>Cliques no WhatsApp de todas as empresas, últimos 30 dias.</p></div></div>
          {eco.clicks30.length ? <BarChart data={perDay} label="Cliques no WhatsApp por dia, todas as empresas" />
            : <div className="vazio"><p>Os cliques aparecem quando os clientes usarem o link da bio e os adesivos de link dos stories.</p></div>}
        </section>
        <section className="painel" aria-label="Precisa de atenção">
          <div className="painel-titulo"><h2>Precisa de atenção</h2></div>
          {(alerts?.length || noModel.length) ? (
            <ul className="avisos">
              {noModel.map((c) => <li key={`m-${c.id}`}><span><strong>{c.name}</strong>: modelo visual ainda não aprovado. <Link href={`/minha-marca?companyId=${c.id}`}>Abrir Minha marca</Link></span></li>)}
              {(alerts ?? []).map((a) => <li key={a.id}><span>{a.message} <span className="muted" style={{ fontSize: 12.5 }}>· {diaCurto(a.created_at)}</span></span></li>)}
            </ul>
          ) : <p className="muted" style={{ margin: 0 }}>Nada pendente. Atrasos de aprovação, cota no fim e falhas de agendamento aparecem aqui.</p>}
        </section>
      </div>
    </div>
  );
}
