// Cobrança recorrente pelo Asaas (Pix e cartão).
// Docs: https://docs.asaas.com  ·  Pix Automático: https://docs.asaas.com/docs/pix-automatico
// Use o sandbox até tudo funcionar: ASAAS_BASE_URL=https://api-sandbox.asaas.com/v3
import { BRAND } from './brand-config';

const BASE = process.env.ASAAS_BASE_URL ?? 'https://api-sandbox.asaas.com/v3';

async function asaas<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      access_token: (process.env.ASAAS_API_KEY ?? process.env.ASSAS_API_KEY)!, // aceita também o nome com a grafia "ASSAS"
      ...(init.headers ?? {}),
    },
  });
  if (!res.ok) throw new Error(`Asaas ${path}: ${res.status} ${await res.text()}`);
  return res.json() as Promise<T>;
}

export function createCustomer(c: { name: string; cpfCnpj: string; email: string; mobilePhone?: string }) {
  return asaas<{ id: string }>('/customers', { method: 'POST', body: JSON.stringify(c) });
}

/**
 * Cria a assinatura mensal.
 * billingType PIX: no Asaas, a primeira cobrança vai com QR Code e o banco do cliente pede
 * autorização para os débitos seguintes (Pix Automático), quando a conta Asaas tem o recurso liberado.
 * Confira na doc acima os campos exatos de Pix Automático antes de ir para produção.
 */
export function createSubscription(s: {
  customer: string;
  billingType: 'PIX' | 'CREDIT_CARD';
  value: number;
  nextDueDate: string; // AAAA-MM-DD (fim do teste de 7 dias)
  description: string;
  externalReference: string; // company_id
}) {
  return asaas<{ id: string }>('/subscriptions', {
    method: 'POST',
    body: JSON.stringify({ ...s, cycle: 'MONTHLY' }),
  });
}

/** Troca de plano: atualiza o valor das próximas cobranças. */
export function updateSubscriptionValue(subscriptionId: string, value: number) {
  return asaas<{ id: string }>(`/subscriptions/${subscriptionId}`, {
    method: 'PUT',
    body: JSON.stringify({ value, updatePendingPayments: true }),
  });
}

/**
 * Nota fiscal automática a cada pagamento da assinatura.
 * Antes, configure a emissão de NFS-e na sua conta Asaas (dados da prefeitura e certificado).
 * Docs: https://docs.asaas.com/docs/emitir-notas-fiscais-automaticamente-para-assinaturas
 * O objeto `taxes` precisa vir completo: peça os percentuais ao seu contador.
 */
export async function setupInvoices(subscriptionId: string) {
  const serviceId = process.env.ASAAS_MUNICIPAL_SERVICE_ID;
  const taxes = process.env.ASAAS_INVOICE_TAXES_JSON; // ex.: {"retainIss":false,"iss":2,"cofins":0,"csll":0,"inss":0,"ir":0,"pis":0}
  if (!serviceId || !taxes) return { skipped: true as const };
  return asaas<{ id?: string }>(`/subscriptions/${subscriptionId}/invoiceSettings`, {
    method: 'POST',
    body: JSON.stringify({
      municipalServiceId: serviceId,
      effectiveDatePeriod: 'ON_PAYMENT_CONFIRMATION',
      observations: `Gestão de redes sociais – ${BRAND.name}`,
      taxes: JSON.parse(taxes),
    }),
  });
}

export function cancelSubscription(subscriptionId: string) {
  return asaas<{ deleted: boolean }>(`/subscriptions/${subscriptionId}`, { method: 'DELETE' });
}
