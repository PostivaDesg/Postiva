// Planos e valores da Postiva (consulta do gestor). Os números vêm de lib/plans.ts, o mesmo arquivo que o
// sistema usa para cobrar, montar a semana e mostrar os planos no cadastro e no aviso de fim do teste.
import { redirect } from 'next/navigation';
import { currentProfile } from '@/lib/supabase';
import { PLANS, ADDONS, weeklyQuota, type PlanId } from '@/lib/plans';
import { brl } from '@/lib/ui';

export const dynamic = 'force-dynamic';

export default async function Planos() {
  const me = await currentProfile();
  if (me?.role !== 'gestor') redirect('/login');
  const ids = Object.keys(PLANS) as PlanId[];
  const linhas: { label: string; v: (id: PlanId) => string }[] = [
    { label: 'Valor por mês', v: (id) => (PLANS[id].priceBRL == null ? 'A definir' : brl(PLANS[id].priceBRL!)) },
    { label: 'Stories por dia', v: (id) => String(PLANS[id].storiesPerDay) },
    { label: 'Posts no feed por dia', v: (id) => String(PLANS[id].postsPerDay) },
    { label: 'Reels por semana', v: (id) => String(PLANS[id].reelsPerWeek) },
    { label: 'Peças por semana', v: (id) => { const q = weeklyQuota(PLANS[id]); return String(q.story + q.post + q.reels); } },
    { label: 'Peças por mês (≈ 4,3 semanas)', v: (id) => { const q = weeklyQuota(PLANS[id]); return String(Math.round((q.story + q.post + q.reels) * 4.3)); } },
    { label: 'Valor por peça (mês)', v: (id) => { const p = PLANS[id]; const q = weeklyQuota(p); const n = (q.story + q.post + q.reels) * 4.3; return p.priceBRL == null || !n ? '–' : (p.priceBRL / n).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }); } },
    { label: 'Refações por semana', v: (id) => String(PLANS[id].changesPerWeek) },
    { label: 'Análise mensal com especialista', v: (id) => (PLANS[id].humanAnalysis ? 'Sim' : 'Não') },
    { label: 'Especialista em tráfego e ajuda na arte', v: (id) => (PLANS[id].extras?.length ? 'Sim' : 'Não') },
    { label: 'Selo', v: (id) => PLANS[id].badge ?? '–' },
  ];
  return (
    <div className="pilha">
      <header className="cabecalho">
        <div><h1>Planos e valores</h1>
          <p>O que cada plano entrega e quanto custa. Estes são os valores que aparecem para o cliente no cadastro e no aviso de fim do teste.</p></div>
      </header>
      <section className="painel rolagem" aria-label="Comparação dos planos">
        <table className="tabela" style={{ minWidth: 640 }}>
          <thead><tr><th></th>{ids.map((id) => <th key={id} className="num">{PLANS[id].name}</th>)}</tr></thead>
          <tbody>
            {linhas.map((l) => (
              <tr key={l.label}><td><strong>{l.label}</strong></td>{ids.map((id) => <td key={id} className="num">{l.v(id)}</td>)}</tr>
            ))}
          </tbody>
        </table>
      </section>
      <section className="painel" aria-label="Serviços extras">
        <div className="painel-titulo"><h2>Serviços extras</h2></div>
        <ul className="avisos">
          {Object.values(ADDONS).map((a) => <li key={a.name}><span><strong>{a.name}</strong>: {a.description} · {a.priceBRL == null ? 'valor a definir' : brl(a.priceBRL)}</span></li>)}
        </ul>
        <p className="muted" style={{ fontSize: 13.5, margin: '12px 0 0' }}>Teste grátis: 7 dias. Pagamento manual: botão "+30 dias" na lista de Empresas. Para mudar um valor, peça ao Claude (fica em lib/plans.ts).</p>
      </section>
    </div>
  );
}
