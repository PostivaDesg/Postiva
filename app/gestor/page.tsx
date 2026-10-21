// Painel do gestor: alertas, fila, e margem de cada cliente no mês.
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { currentProfile, supabaseAdmin } from '@/lib/supabase';
import { PLANS, type PlanId } from '@/lib/plans';

// Ajuste no .env: câmbio, valor da sua hora e custos fixos mensais (Canva, Metricool, hospedagem…)
const USD_BRL = Number(process.env.USD_BRL ?? 5.5);
const HOURLY = Number(process.env.HOURLY_RATE_BRL ?? 50);
const FIXED = Number(process.env.FIXED_COSTS_BRL ?? 0);

const brl = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });

export default async function Gestor() {
  const me = await currentProfile();
  if (me?.role !== 'gestor') redirect('/login');

  const db = supabaseAdmin();
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

  const [{ data: companies }, { data: usage }, { data: reviews }, { data: clicks }, { data: alerts }, { count: queue }] = await Promise.all([
    db.from('companies').select('*, subscriptions(status)').order('name'),
    db.from('ai_usage').select('company_id, input_tokens, output_tokens, cache_read_tokens, model').gte('created_at', monthStart),
    db.from('posts').select('company_id, review_seconds').gte('created_at', monthStart),
    db.from('link_clicks').select('company_id').gte('created_at', monthStart),
    db.from('notifications').select('id, message, created_at').eq('audience', 'gestor').is('read_at', null).order('created_at', { ascending: false }).limit(12),
    db.from('posts').select('id', { count: 'exact', head: true }).eq('status', 'rascunho'),
  ]);

  const statusOf = (c: any) => (Array.isArray(c.subscriptions) ? c.subscriptions[0] : c.subscriptions)?.status as string | undefined;
  const paying = (companies ?? []).filter((c) => statusOf(c) === 'ativa');
  const fixedShare = paying.length ? FIXED / paying.length : 0;

  // Preço por milhão de tokens (US$): Sonnet 5.5 = 2 / 10, Haiku 5.5 = 0,10 / 0,50; cache = 5% / 10% da entrada
  const tokenCost = (u: any) => {
    const haiku = String(u.model).includes('haiku');
    const [inp, out, cache] = haiku ? [0.10, 0.50, 0.01] : [2, 10, 0.10];
    return (u.input_tokens * inp + u.output_tokens * out + (u.cache_read_tokens ?? 0) * cache) / 1e6;
  };

  const rows = (companies ?? []).map((c) => {
    const revenue = statusOf(c) === 'ativa' ? PLANS[c.plan as PlanId].priceBRL ?? 0 : 0;
    const ai = (usage ?? []).filter((u) => u.company_id === c.id).reduce((s, u) => s + tokenCost(u), 0) * USD_BRL;
    const hours = (reviews ?? []).filter((r) => r.company_id === c.id).reduce((s, r) => s + r.review_seconds, 0) / 3600;
    const cost = ai + hours * HOURLY + (revenue ? fixedShare : 0);
    return {
      c, status: statusOf(c) ?? '-', revenue, ai, hours, cost, margin: revenue - cost,
      clicks: (clicks ?? []).filter((k) => k.company_id === c.id).length,
    };
  });
  const total = rows.reduce((s, r) => ({ revenue: s.revenue + r.revenue, margin: s.margin + r.margin }), { revenue: 0, margin: 0 });

  return (
    <main className="wrap" style={{ display: 'grid', gap: 20 }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'end', flexWrap: 'wrap', gap: 12 }}>
        <div><p className="muted" style={{ margin: 0 }}>Área do gestor</p><h1 style={{ margin: 0 }}>Todas as empresas</h1></div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Link className="btn" href="/gestor/revisao" style={{ display: 'inline-flex', alignItems: 'center', textDecoration: 'none' }}>Fila de revisão ({queue ?? 0})</Link>
          <Link className="btn ghost" href="/gestor/nova" style={{ display: 'inline-flex', alignItems: 'center', textDecoration: 'none' }}>+ Nova empresa</Link>
          <Link className="btn ghost" href="/gestor/diagnostico" style={{ display: 'inline-flex', alignItems: 'center', textDecoration: 'none' }}>Diagnóstico</Link>
        </div>
      </header>

      <section className="grid" aria-label="Resumo do mês">
        <div className="card"><span className="muted">Receita recorrente</span><div style={{ fontSize: 26, fontWeight: 600 }}>{brl(total.revenue)}</div></div>
        <div className="card"><span className="muted">Margem estimada no mês</span><div style={{ fontSize: 26, fontWeight: 600 }}>{brl(total.margin)}</div></div>
        <div className="card"><span className="muted">Clientes pagantes</span><div style={{ fontSize: 26, fontWeight: 600 }}>{paying.length}</div></div>
      </section>

      {!!alerts?.length && (
        <section className="card" aria-label="Alertas">
          <h2 style={{ marginTop: 0 }}>Alertas</h2>
          <ul style={{ margin: 0, paddingLeft: 18, lineHeight: 1.7 }}>
            {alerts.map((a) => <li key={a.id}>{a.message}</li>)}
          </ul>
        </section>
      )}

      <section className="card" style={{ overflowX: 'auto' }} aria-label="Empresas">
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 900, fontSize: 14 }}>
          <thead><tr style={{ textAlign: 'left' }}>
            <th>Empresa</th><th>Plano</th><th>Pagamento</th><th>Receita</th><th>IA</th><th>Revisão</th><th>Margem</th><th>Cliques no WhatsApp</th><th></th>
          </tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.c.id} style={{ borderTop: '1px solid #EEF1F5' }}>
                <td style={{ padding: '10px 0' }}>{r.c.name}{!r.c.setup_done && <span className="muted"> · configurando</span>}</td>
                <td>{PLANS[r.c.plan as PlanId].name}</td>
                <td>{r.status}</td>
                <td>{brl(r.revenue)}</td>
                <td>{brl(r.ai)}</td>
                <td>{r.hours.toFixed(1)} h</td>
                <td style={{ fontWeight: 600, color: r.margin < 0 ? '#A1281F' : undefined }}>{brl(r.margin)}</td>
                <td>{r.clicks}</td>
                <td><Link href={`/gestor/${r.c.id}`}>Configurar</Link></td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="muted" style={{ fontSize: 13 }}>Margem = receita − IA − (horas de revisão × R$ {HOURLY}/h) − parte dos custos fixos ({brl(FIXED)} divididos entre os pagantes).</p>
      </section>
    </main>
  );
}
