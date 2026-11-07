// Aviso de fim do teste grátis: cobre o painel e mostra os planos para o cliente escolher e pagar.
import { PLANS, type PlanId } from '@/lib/plans';
import { escolherPlano } from '@/app/actions/assinatura';
import SignOut from './SignOut';

const brl = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });

function itens(id: PlanId) {
  const p = PLANS[id];
  const l = [`${p.storiesPerDay} stories por dia`];
  if (p.postsPerDay) l.push(`${p.postsPerDay} ${p.postsPerDay === 1 ? 'post' : 'posts'} no feed por dia`);
  l.push(`${p.reelsPerWeek} reels por semana`);
  l.push('Aprovação pelo celular e agendamento automático');
  if (p.humanAnalysis) l.push('Análise mensal com especialista');
  return l;
}

export default function AvisoPlanos({ atual, escolhido }: { atual?: string | null; escolhido?: string | null }) {
  const ids = (Object.keys(PLANS) as PlanId[]).filter((id) => PLANS[id].priceBRL != null);
  const esc = escolhido && PLANS[escolhido as PlanId];
  return (
    <div className="aviso-inativa" role="alertdialog" aria-modal="true" aria-labelledby="aviso-planos-titulo">
      <div className="aviso-inativa-caixa aviso-planos">
        <span className="aviso-inativa-icone" aria-hidden="true">!</span>
        <h2 id="aviso-planos-titulo">Seu teste grátis de 7 dias terminou</h2>
        <p>Para continuar recebendo as artes e os agendamentos do seu Instagram, escolha um plano e faça o pagamento.</p>
        {esc && (
          <p className="aviso-inativa-nota">Você escolheu o plano {esc.name}. Assim que o pagamento for confirmado, sua conta volta a funcionar.
            Se ainda não recebeu o link de pagamento, a equipe da Postiva vai te enviar.</p>
        )}
        <div className="planos-grade">
          {ids.map((id) => {
            const p = PLANS[id];
            const destaque = id === (escolhido ?? atual);
            return (
              <form key={id} action={escolherPlano} className={`plano-card${destaque ? ' destaque' : ''}`}>
                <input type="hidden" name="plan" value={id} />
                <strong className="plano-nome">{p.name}</strong>
                <span className="plano-preco">{brl(p.priceBRL!)}<small>/mês</small></span>
                <ul>{itens(id).map((t) => <li key={t}>{t}</li>)}</ul>
                <button className={destaque ? 'btn' : 'btn ghost'}>{escolhido === id ? 'Ir para o pagamento' : 'Escolher este plano'}</button>
              </form>
            );
          })}
        </div>
        <p className="muted" style={{ fontSize: 13.5 }}>Pagamento seguro pelo Mercado Pago. Dúvidas? Fale com a equipe da Postiva.</p>
        <div className="aviso-inativa-sair"><SignOut /></div>
      </div>
    </div>
  );
}
