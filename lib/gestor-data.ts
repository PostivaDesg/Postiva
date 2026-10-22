// Números do gestor: receita, custos (IA + horas de revisão + custos fixos) e margem por empresa no mês.
import { supabaseAdmin } from './supabase';
import { PLANS, type PlanId } from './plans';

const USD_BRL = Number(process.env.USD_BRL ?? 5.5);
export const HOURLY = Number(process.env.HOURLY_RATE_BRL ?? 50);
export const FIXED = Number(process.env.FIXED_COSTS_BRL ?? 0);

// Preço por milhão de tokens (US$): Sonnet 5.5 = 2 / 10, Haiku 5.5 = 0,10 / 0,50; cache = 5% / 10% da entrada
const tokenCost = (u: any) => {
  const haiku = String(u.model).includes('haiku');
  const [inp, out, cache] = haiku ? [0.10, 0.50, 0.01] : [2, 10, 0.10];
  return (u.input_tokens * inp + u.output_tokens * out + (u.cache_read_tokens ?? 0) * cache) / 1e6;
};

export async function companyEconomics() {
  const db = supabaseAdmin();
  const now = new Date();
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 3)).toISOString();
  const [{ data: companies }, { data: usage }, { data: reviews }, { data: clicks }] = await Promise.all([
    db.from('companies').select('*, subscriptions(status)').order('name'),
    db.from('ai_usage').select('company_id, input_tokens, output_tokens, cache_read_tokens, model').gte('created_at', monthStart),
    db.from('posts').select('company_id, review_seconds').gte('created_at', monthStart),
    db.from('link_clicks').select('company_id, created_at').gte('created_at', new Date(Date.now() - 30 * 864e5).toISOString()),
  ]);
  const statusOf = (c: any) => ((Array.isArray(c.subscriptions) ? c.subscriptions[0] : c.subscriptions)?.status as string | undefined) ?? 'sem assinatura';
  const paying = (companies ?? []).filter((c) => statusOf(c) === 'ativa');
  const fixedShare = paying.length ? FIXED / paying.length : 0;
  const rows = (companies ?? []).map((c) => {
    const status = statusOf(c);
    const revenue = status === 'ativa' ? PLANS[c.plan as PlanId]?.priceBRL ?? 0 : 0;
    const ai = (usage ?? []).filter((u) => u.company_id === c.id).reduce((s, u) => s + tokenCost(u), 0) * USD_BRL;
    const hours = (reviews ?? []).filter((r) => r.company_id === c.id).reduce((s, r) => s + (r.review_seconds ?? 0), 0) / 3600;
    const cost = ai + hours * HOURLY + (revenue ? fixedShare : 0);
    return {
      c, status, plan: PLANS[c.plan as PlanId]?.name ?? c.plan, revenue, ai, hours, cost, margin: revenue - cost,
      clicks: (clicks ?? []).filter((k) => k.company_id === c.id && k.created_at >= monthStart).length,
    };
  });
  const total = rows.reduce((s, r) => ({ revenue: s.revenue + r.revenue, margin: s.margin + r.margin, ai: s.ai + r.ai, clicks: s.clicks + r.clicks }), { revenue: 0, margin: 0, ai: 0, clicks: 0 });
  return { rows, total, paying: paying.length, trial: rows.filter((r) => r.status === 'teste').length, clicks30: clicks ?? [] };
}
