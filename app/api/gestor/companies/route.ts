// Gestor cria uma nova empresa: login do cliente, perfil do Claude (com modelo do segmento),
// pasta no Canva, assinatura no Asaas com 7 dias de teste e nota fiscal automática.
import { NextResponse } from 'next/server';
import { currentProfile, supabaseAdmin } from '@/lib/supabase';
import { PLANS, type PlanId } from '@/lib/plans';
import { createCustomer, createSubscription, setupInvoices } from '@/lib/asaas';
import { createCompanyFolder } from '@/lib/canva';
import { SEGMENT_STARTERS } from '@/lib/segments';
import { toSegment } from '@/lib/dates';
import { newTrackingCode } from '@/lib/tracking';
import { pickDirection } from '@/lib/styles';

export async function POST(req: Request) {
  const me = await currentProfile();
  if (me?.role !== 'gestor') return NextResponse.json({ error: 'Só o gestor pode criar empresas.' }, { status: 403 });

  const body = await req.json() as {
    name: string; instagram?: string; segment?: string; city?: string; whatsapp?: string; siteUrl?: string;
    plan: PlanId; billingType: 'PIX' | 'CREDIT_CARD';
    clientEmail: string; clientName: string; tempPassword: string; cpfCnpj: string;
  };
  const plan = PLANS[body.plan];
  if (!plan) return NextResponse.json({ error: 'Plano inválido.' }, { status: 400 });
  if (plan.priceBRL === null) return NextResponse.json({ error: `Defina o preço do plano ${plan.name} em lib/plans.ts.` }, { status: 400 });
  if (!body.name || !body.clientEmail || !body.tempPassword || body.tempPassword.length < 8 || !body.cpfCnpj) {
    return NextResponse.json({ error: 'Preencha nome, e-mail, CPF/CNPJ e uma senha provisória de 8+ caracteres.' }, { status: 400 });
  }

  const db = supabaseAdmin();
  const warnings: string[] = [];

  // 1) Empresa
  const { data: company, error: e1 } = await db.from('companies').insert({
    name: body.name, instagram: body.instagram, segment: body.segment, city: body.city,
    whatsapp: body.whatsapp, plan: body.plan, site_url: body.siteUrl ?? null,
    cnpj: body.cpfCnpj, contact_name: body.clientName, contact_email: body.clientEmail,
    bio_code: `bio-${newTrackingCode(6)}`,
    // Direção de arte menos usada no mesmo segmento e cidade: duas empresas nunca saem iguais
    art_style: await pickDirection(toSegment(body.segment), body.city),
  }).select().single();
  if (e1) return NextResponse.json({ error: e1.message }, { status: 500 });

  // 2) Login único do cliente (ele troca a senha no primeiro acesso)
  const { data: auth, error: e2 } = await db.auth.admin.createUser({
    email: body.clientEmail, password: body.tempPassword, email_confirm: true,
  });
  if (e2) {
    await db.from('companies').delete().eq('id', company.id);
    return NextResponse.json({ error: e2.message }, { status: 500 });
  }
  await db.from('profiles').insert({ id: auth.user.id, company_id: company.id, role: 'cliente', full_name: body.clientName });

  // 3) Perfil do Claude já começa com o modelo do segmento; você só ajusta os [colchetes]
  const starter = SEGMENT_STARTERS[toSegment(body.segment)];
  await db.from('brand_profiles').insert({
    company_id: company.id, briefing: starter.briefing, tone: starter.tone, rules: starter.rules,
    visual: `${starter.visual}\n\nMix de conteúdo: ${starter.mix}`,
  });

  // 4) Opcional: pasta da empresa no Canva, para quem quiser editar artes à mão.
  //    As artes são geradas pelo próprio site; o Canva não é obrigatório.
  if (process.env.CANVA_CLIENT_ID) try {
    const folderId = await createCompanyFolder(body.name);
    await db.from('companies').update({ canva_folder_id: folderId }).eq('id', company.id);
  } catch (e) {
    warnings.push(`Pasta do Canva não criada: ${(e as Error).message}`);
  }

  // 5) Assinatura no Asaas com 7 dias de teste + nota fiscal automática
  try {
    const trialEnd = new Date(Date.now() + 7 * 864e5);
    const customer = await createCustomer({ name: body.name, cpfCnpj: body.cpfCnpj, email: body.clientEmail, mobilePhone: body.whatsapp });
    const sub = await createSubscription({
      customer: customer.id, billingType: body.billingType, value: plan.priceBRL,
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

  return NextResponse.json({ companyId: company.id, warnings });
}
