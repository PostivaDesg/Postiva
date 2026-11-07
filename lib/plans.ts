// Planos da Postiva Design: preço e cotas.
// Alterar aqui muda o que o sistema gera e cobra.

export type PlanId = 'basic' | 'intermediario' | 'avancado' | 'pleno';
export type PostKind = 'story' | 'post' | 'reels';

export interface Plan {
  id: PlanId;
  name: string;
  priceBRL: number | null; // null = a definir
  storiesPerDay: number;
  postsPerDay: number;
  reelsPerWeek: number;
  humanAnalysis: boolean;  // análise humanizada mensal (Pleno)
  changesPerWeek: number;  // refações com a IA que o cliente pode pedir por semana (somando todos os posts)
  badge?: string;          // selo mostrado ao cliente (ex.: Super promoção)
  extras?: string[];       // o que o plano tem a mais, mostrado ao cliente
}

export const PLANS: Record<PlanId, Plan> = {
  basic:         { id: 'basic',         name: 'Basic',         priceBRL: 400,  storiesPerDay: 3, postsPerDay: 0, reelsPerWeek: 1, humanAnalysis: false, changesPerWeek: 20 },
  intermediario: { id: 'intermediario', name: 'Intermediário', priceBRL: 500,  storiesPerDay: 5, postsPerDay: 1, reelsPerWeek: 1, humanAnalysis: false, changesPerWeek: 20, badge: 'Recomendado' },
  avancado:      { id: 'avancado',      name: 'Avançado',      priceBRL: 600,  storiesPerDay: 6, postsPerDay: 2, reelsPerWeek: 2, humanAnalysis: false, changesPerWeek: 20, badge: 'Super promoção' },
  pleno:         { id: 'pleno',         name: 'Pleno',         priceBRL: 1000, storiesPerDay: 6, postsPerDay: 2, reelsPerWeek: 2, humanAnalysis: true,  changesPerWeek: 20,
                   extras: ['Especialista em tráfego pago acompanhando a sua conta', 'Especialista ajudando nas artes'] },
};

/** Serviços extras, vendidos à parte (não entram na cota). */
export const ADDONS = {
  direct: {
    name: 'Respostas automáticas no direct',
    description: 'Atendimento automático das mensagens do Instagram com as informações da sua marca, 24h.',
    priceBRL: null as number | null, // a definir
  },
  arte_avulsa: {
    name: 'Arte avulsa',
    description: 'Peça extra fora da cota do mês.',
    priceBRL: null as number | null, // a definir
  },
} as const;

/** Quantas peças de cada tipo o plano libera numa semana (7 dias). */
export function weeklyQuota(plan: Plan): Record<PostKind, number> {
  return {
    story: plan.storiesPerDay * 7,
    post: plan.postsPerDay * 7,
    reels: plan.reelsPerWeek,
  };
}
