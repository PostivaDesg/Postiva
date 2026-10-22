// Calendário do mês: cada dia com os posts (cor = situação) e a lista detalhada embaixo.
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { currentProfile, supabaseAdmin } from '@/lib/supabase';
import { artUrl } from '@/lib/art/url';
import { KIND, STATUS, tz, ymd } from '@/lib/ui';

export const dynamic = 'force-dynamic';
const COR: Record<string, string> = { aguardando: 'var(--ambar)', ajuste: 'var(--ambar)', aprovado: 'var(--verde)', agendado: 'var(--verde)', publicado: 'var(--verde)' };

export default async function Calendario({ searchParams }: { searchParams: Promise<{ mes?: string }> }) {
  const sp = await searchParams;
  const me = await currentProfile();
  if (!me) redirect('/login');
  if (me.role === 'gestor') redirect('/gestor');
  const now = new Date(Date.now() - 3 * 3600e3);
  const mes = /^\d{4}-\d{2}$/.test(sp.mes ?? '') ? sp.mes! : `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
  const [y, m] = mes.split('-').map(Number);
  const start = new Date(Date.UTC(y, m - 1, 1, 3)), end = new Date(Date.UTC(y, m, 1, 3));
  const { data } = await supabaseAdmin().from('posts').select('id, kind, status, title, scheduled_at, art_version, art_url')
    .eq('company_id', me.company_id!).neq('status', 'rascunho').gte('scheduled_at', start.toISOString()).lt('scheduled_at', end.toISOString()).order('scheduled_at');
  const posts = data ?? [];
  const firstDow = (new Date(Date.UTC(y, m - 1, 1)).getUTCDay() + 6) % 7; // segunda = 0
  const nDays = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const cells = Array.from({ length: Math.ceil((firstDow + nDays) / 7) * 7 }, (_, i) => i - firstDow + 1);
  const today = ymd(new Date());
  const prev = m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, '0')}`;
  const next = m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, '0')}`;
  const nome = new Date(Date.UTC(y, m - 1, 15)).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric', timeZone: 'UTC' });

  return (
    <div className="pilha">
      <header className="cabecalho">
        <div><h1 style={{ textTransform: 'capitalize' }}>{nome}</h1><p>{posts.length} peças no mês. Cada bolinha é um post: verde já está aprovado, âmbar espera você.</p></div>
        <div className="acoes"><Link className="btn ghost pequeno" href={`?mes=${prev}`}>Mês anterior</Link><Link className="btn ghost pequeno" href={`?mes=${next}`}>Próximo mês</Link></div>
      </header>
      <section className="painel" aria-label="Calendário">
        <div className="calendario">
          {['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'].map((d) => <div className="dow" key={d}>{d}</div>)}
          {cells.map((d, i) => {
            if (d < 1 || d > nDays) return <div className="dia fora" key={i} aria-hidden="true" />;
            const key = `${mes}-${String(d).padStart(2, '0')}`;
            const doDia = posts.filter((p) => ymd(new Date(p.scheduled_at)) === key);
            return (
              <div className={`dia${key === today ? ' hoje' : ''}`} key={i} aria-label={`${d}: ${doDia.length} posts`}>
                <b>{d}</b>
                <div className="pontos">{doDia.map((p) => <i key={p.id} title={`${KIND[p.kind]}: ${p.title} (${STATUS[p.status] ?? p.status})`} style={{ background: COR[p.status] ?? 'var(--muted)' }} />)}</div>
              </div>
            );
          })}
        </div>
        <div className="legenda" style={{ marginTop: 14 }}><span><i style={{ background: 'var(--verde)' }} />Aprovado ou agendado</span><span><i style={{ background: 'var(--ambar)' }} />Esperando você</span></div>
      </section>
      <section className="painel" aria-label="Lista do mês">
        <div className="painel-titulo"><h2>Todos os posts do mês</h2></div>
        {posts.length ? (
          <div className="rolagem"><table className="tabela"><thead><tr><th></th><th>Quando</th><th>Formato</th><th>Post</th><th>Situação</th></tr></thead><tbody>
            {posts.map((p) => (
              <tr key={p.id}>
                <td style={{ width: 56 }}><img src={p.art_url ?? artUrl(p.id, p.art_version, false)} alt="" loading="lazy" style={{ width: 44, height: 55, objectFit: 'cover', borderRadius: 8, display: 'block' }} /></td>
                <td style={{ whiteSpace: 'nowrap' }}>{new Date(p.scheduled_at).toLocaleString('pt-BR', { timeZone: tz, weekday: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit' })}</td>
                <td>{KIND[p.kind]}</td>
                <td>{p.title}</td>
                <td><span className={`status ${p.status}`}>{STATUS[p.status] ?? p.status}</span></td>
              </tr>))}
          </tbody></table></div>
        ) : <div className="vazio"><p>Nenhum post neste mês ainda.</p></div>}
      </section>
    </div>
  );
}
