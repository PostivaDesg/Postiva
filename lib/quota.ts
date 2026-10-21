// Quanto ainda resta da cota do mês para uma empresa.
import { supabaseAdmin } from './supabase';
import { PLANS, type PlanId, type PostKind } from './plans';

export async function monthlyRemaining(companyId: string, plan: PlanId, ref = new Date()) {
  const p = PLANS[plan];
  // mês no horário de Brasília (o servidor roda em UTC)
  const br = new Date(ref.getTime() - 3 * 3600e3);
  const y = br.getUTCFullYear(), m = br.getUTCMonth();
  const start = new Date(Date.UTC(y, m, 1, 3));
  const end = new Date(Date.UTC(y, m + 1, 1, 3));
  const days = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  const total: Record<PostKind, number> = {
    story: p.storiesPerDay * days,
    post: p.postsPerDay * days,
    reels: p.reelsPerWeek * Math.ceil(days / 7),
  };
  const { data } = await supabaseAdmin().from('posts').select('kind')
    .eq('company_id', companyId).gte('scheduled_at', start.toISOString()).lt('scheduled_at', end.toISOString());
  for (const r of data ?? []) total[r.kind as PostKind] = Math.max(0, total[r.kind as PostKind] - 1);
  return total;
}

/** Empresa do usuário logado; o gestor pode agir em nome de qualquer empresa. */
export function resolveCompany(me: { role: string; company_id: string | null }, requested?: string | null) {
  if (me.role === 'gestor') return requested ?? null;
  return me.company_id;
}
