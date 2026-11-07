// Teste grátis de 7 dias: quanto falta e se já acabou.
export const TRIAL_DAYS = 7;

type Sub = { status?: string | null; trial_ends_at?: string | null } | null | undefined;

/** Teste vencido = assinatura ainda em 'teste' e a data de fim já passou. */
export function trialExpired(sub: Sub, now = Date.now()) {
  return sub?.status === 'teste' && !!sub.trial_ends_at && Date.parse(sub.trial_ends_at) <= now;
}

/** Dias que faltam do teste (arredonda para cima); null se não estiver em teste. */
export function trialDaysLeft(sub: Sub, now = Date.now()) {
  if (sub?.status !== 'teste' || !sub.trial_ends_at) return null;
  return Math.max(0, Math.ceil((Date.parse(sub.trial_ends_at) - now) / 864e5));
}

/** Chave em app_settings com o link de pagamento do Mercado Pago de cada plano (ex.: mp_link_basic). */
export const mpLinkKey = (plan: string) => `mp_link_${plan}`;
