// Teste grátis de 7 dias: quanto falta e se já acabou.
export const TRIAL_DAYS = 7;

type Sub = { status?: string | null; trial_ends_at?: string | null; pago_ate?: string | null } | null | undefined;

/** Acesso vencido: teste grátis terminou, ou o período pago à mão (botão "+30 dias") acabou. */
export function trialExpired(sub: Sub, now = Date.now()) {
  if (sub?.pago_ate) return Date.parse(sub.pago_ate) <= now;
  return sub?.status === 'teste' && !!sub.trial_ends_at && Date.parse(sub.trial_ends_at) <= now;
}

/** Período pago manual: +30 dias a partir de hoje, ou do fim do período atual se ainda estiver valendo. */
export function novoPagoAte(atual?: string | null, dias = 30, now = Date.now()) {
  const base = atual && Date.parse(atual) > now ? Date.parse(atual) : now;
  return new Date(base + dias * 864e5).toISOString();
}

/** Dias que faltam do teste (arredonda para cima); null se não estiver em teste. */
export function trialDaysLeft(sub: Sub, now = Date.now()) {
  if (sub?.status !== 'teste' || !sub.trial_ends_at) return null;
  return Math.max(0, Math.ceil((Date.parse(sub.trial_ends_at) - now) / 864e5));
}

/** Chave em app_settings com o link de pagamento do Mercado Pago de cada plano (ex.: mp_link_basic). */
export const mpLinkKey = (plan: string) => `mp_link_${plan}`;
