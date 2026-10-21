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
  changesPerPost: number;  // ajustes que o cliente pode pedir em cada post
}

export const PLANS: Record<PlanId, Plan> = {
  basic:         { id: 'basic',         name: 'Basic',         priceBRL: 400,  storiesPerDay: 3, postsPerDay: 0, reelsPerWeek: 1, humanAnalysis: false, changesPerPost: 2 },
  intermediario: { id: 'intermediario', name: 'Intermediário', priceBRL: 600,  storiesPerDay: 5, postsPerDay: 1, reelsPerWeek: 1, humanAnalysis: false, changesPerPost: 2 },
  avancado:      { id: 'avancado',      name: 'Avançado',      priceBRL: 800,  storiesPerDay: 6, postsPerDay: 2, reelsPerWeek: 2, humanAnalysis: false, changesPerPost: 2 },
  pleno:         { id: 'pleno',         name: 'Pleno',         priceBRL: 1000, storiesPerDay: 6, postsPerDay: 2, reelsPerWeek: 2, humanAnalysis: true,  changesPerPost: 3 },
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
