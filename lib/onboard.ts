// Cria uma conta nova na Postiva: empresa, login do cliente, perfil do Claude com o modelo do segmento,
// pasta no Canva (opcional) e assinatura no Asaas com 7 dias de teste.
// Usado pelo gestor ("Nova empresa") e pelo cadastro público ("Criar conta").
import { supabaseAdmin } from '@/lib/supabase';
import { PLANS, type PlanId } from '@/lib/plans';
import { createCustomer, createSubscription, setupInvoices } from '@/lib/asaas';
import { createCompanyFolder } from '@/lib/canva';
import { SEGMENT_STARTERS } from '@/lib/segments';
import { toSegment } from '@/lib/dates';
import { newTrackingCode } from '@/lib/tracking';
import { pickDirection } from '@/lib/styles';

export interface NewAccount {
  name: string; instagram?: string; segment?: string; city?: string; whatsapp?: string; siteUrl?: string;
  plan: PlanId; billingType: 'PIX' | 'CREDIT_CARD';
  clientEmail: string; clientName: string; password: string; cpfCnpj: string;
}

export type OnboardResult = { ok: true; companyId: string; userId: string; warnings: string[] } | { ok: false; status: number; error: string };

const onlyDigits = (s?: string) => (s ?? '').replace(/\D/g, '');

export function validateAccount(b: Partial<NewAccount>): string | null {
  if (!b.plan || !PLANS[b.plan as PlanId]) return 'Escolha um plano.';
  if (PLANS[b.plan as PlanId].priceBRL === null) return `O plano ${PLANS[b.plan as PlanId].name} ainda não tem preço.`;
  if (!b.name?.trim()) return 'Informe o nome da empresa.';
  if (!b.clientName?.trim()) return 'Informe o seu nome.';
  if (!b.clientEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(b.clientEmail)) return 'Informe um e-mail válido.';
  if (!b.password || b.password.length < 8) return 'A senha precisa ter pelo menos 8 caracteres.';
  const doc = onlyDigits(b.cpfCnpj);
  if (doc.length !== 11 && doc.length !== 14) return 'Informe um CPF (11 números) ou CNPJ (14 números).';
  if (b.billingType !== 'PIX' && b.billingType !== 'CREDIT_CARD') return 'Escolha a forma de pagamento.';
  return null;
}

export async function createAccount(body: NewAccount): Promise<OnboardResult> {
  const invalid = validateAccount(body);
  if (invalid) return { ok: false, status: 400, error: invalid };
  const plan = PLANS[body.plan];
  const db = supabaseAdmin();
  const warnings: string[] = [];
  const email = body.clientEmail.trim().toLowerCase();
  const instagram = body.instagram?.trim().replace(/^@/, '') || null;

  // 1) Empresa
  const { data: company, error: e1 } = await db.from('companies').insert({
    name: body.name.trim(), instagram, segment: body.segment?.trim() || null, city: body.city?.trim() || null,
    whatsapp: body.whatsapp?.trim() || null, plan: body.plan, site_url: body.siteUrl?.trim() || null,
    cnpj: onlyDigits(body.cpfCnpj), contact_name: body.clientName.trim(), contact_email: email,
    bio_code: `bio-${newTrackingCode(6)}`,
    // Direção de arte menos usada no mesmo segmento e cidade: duas empresas nunca saem iguais
    art_style: await pickDirection(toSegment(body.segment), body.city),
  }).select().single();
  if (e1) return { ok: false, status: 500, error: e1.message };

  // 2) Login do cliente
  const { data: auth, error: e2 } = await db.auth.admin.createUser({ email, password: body.password, email_confirm: true });
  if (e2) {
    await db.from('companies').delete().eq('id', company.id);
    const dup = /already|registered|exists/i.test(e2.message);
    return { ok: false, status: dup ? 409 : 500, error: dup ? 'Já existe uma conta com este e-mail. Entre ou use "Esqueci a senha".' : e2.message };
  }
  await db.from('profiles').insert({ id: auth.user.id, company_id: company.id, role: 'cliente', full_name: body.clientName.trim() });

  // 3) Perfil do Claude já começa com o modelo do segmento; o cliente completa em "Minha marca"
  const starter = SEGMENT_STARTERS[toSegment(body.segment)];
  await db.from('brand_profiles').insert({
    company_id: company.id, briefing: starter.briefing, tone: starter.tone, rules: starter.rules,
    visual: `${starter.visual}\n\nMix de conteúdo: ${starter.mix}`,
  });

  // 4) Opcional: pasta da empresa no Canva
  if (process.env.CANVA_CLIENT_ID) try {
    const folderId = await createCompanyFolder(body.name);
    await db.from('companies').update({ canva_folder_id: folderId }).eq('id', company.id);
  } catch (e) {
    warnings.push(`Pasta do Canva não criada: ${(e as Error).message}`);
  }

  // 5) Assinatura no Asaas com 7 dias de teste + nota fiscal automática
  try {
    const trialEnd = new Date(Date.now() + 7 * 864e5);
    const customer = await createCustomer({ name: body.name, cpfCnpj: onlyDigits(body.cpfCnpj), email, mobilePhone: body.whatsapp });
    const sub = await createSubscription({
      customer: customer.id, billingType: body.billingType, value: plan.priceBRL!,
      nextDueDate: trialEnd.toISOString().slice(0, 10), description: `Postiva Design – Plano ${plan.name}`, externalReference: company.id,
    });
    await db.from('subscriptions').insert({
      company_id: company.id, asaas_customer_id: customer.id, asaas_subscription_id: sub.id,
      billing_type: body.billingType, status: 'teste',
      trial_ends_at: trialEnd.toISOString(), next_due_date: trialEnd.toISOString().slice(0, 10),
    });
    const nf = await setupInvoices(sub.id).catch((e) => { warnings.push(`Nota fiscal não configurada: ${(e as Error).message}`); return null; });
    if (nf && 'skipped' in nf) warnings.push('Nota fiscal automática desligada: preencha ASAAS_MUNICIPAL_SERVICE_ID e ASAAS_INVOICE_TAXES_JSON.');
  } catch (e) {
    warnings.push(`Assinatura não criada no Asaas: ${(e as Error).message}`);
  }

  return { ok: true, companyId: company.id, userId: auth.user.id, warnings };
}
