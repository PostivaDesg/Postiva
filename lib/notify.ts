// Avisos sem custo de WhatsApp: ficam no painel e, se configurado, vão por e-mail.
// E-mail via Resend (https://resend.com), que tem plano gratuito. Sem RESEND_API_KEY, só o painel.
import { supabaseAdmin } from './supabase';
import { BRAND } from './brand-config';

type Kind = 'aprovar' | 'atraso_aprovacao' | 'cota' | 'pagamento' | 'agendamento' | 'pedido' | 'semana';

async function sendEmail(to: string | null | undefined, subject: string, text: string) {
  if (!to || !process.env.RESEND_API_KEY) return;
  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: BRAND.emailFrom, to, subject, text }),
  }).catch((e) => console.error('[email] falhou', e));
}

/** Aviso para o cliente (painel + e-mail do responsável). `dedupe` evita repetir o mesmo aviso. */
export async function notifyClient(companyId: string, kind: Kind, message: string, dedupe?: string) {
  const db = supabaseAdmin();
  const { error } = await db.from('notifications').insert({
    company_id: companyId, audience: 'cliente', kind, message, dedupe_key: dedupe ?? null,
  });
  if (error?.code === '23505') return; // já avisado
  const { data: c } = await db.from('companies').select('contact_email').eq('id', companyId).single();
  await sendEmail(c?.contact_email, `${BRAND.name}: novidade no seu painel`, `${message}\n\nAcesse: ${BRAND.site}/painel`);
}

/** Aviso para você (gestor): aparece no painel do gestor e vai para GESTOR_EMAIL. */
export async function notifyGestor(companyId: string | null, kind: Kind, message: string, dedupe?: string) {
  const { error } = await supabaseAdmin().from('notifications').insert({
    company_id: companyId, audience: 'gestor', kind, message, dedupe_key: dedupe ?? null,
  });
  if (error?.code === '23505') return;
  await sendEmail(process.env.GESTOR_EMAIL, `${BRAND.name}: ${kind}`, message);
}

/** Chave de deduplicação por dia (horário de Brasília). */
export const today = () => new Date(Date.now() - 3 * 3600e3).toISOString().slice(0, 10);
