// Trava de acesso no servidor: empresa desativada pelo gestor ou com teste/período pago vencido não pede
// peças, não aprova e não pede ajuste. A tela já mostra o aviso; isto impede chamadas diretas à API.
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { trialExpired } from '@/lib/trial';

export async function companyBlocked(companyId: string): Promise<string | null> {
  const db = supabaseAdmin();
  const [{ data: c }, { data: sub }] = await Promise.all([
    db.from('companies').select('ativa').eq('id', companyId).maybeSingle(),
    db.from('subscriptions').select('status, trial_ends_at, pago_ate').eq('company_id', companyId).maybeSingle(),
  ]);
  if (!c) return 'Empresa não encontrada.';
  if (c.ativa === false) return 'Sua conta está pausada. Fale com a equipe da Postiva.';
  if (trialExpired(sub)) return 'Seu teste grátis ou período pago terminou. Escolha um plano para continuar.';
  if (sub && !['teste', 'ativa'].includes(sub.status)) return 'Assinatura pausada. Fale com a equipe da Postiva.';
  return null;
}

/** Resposta 402 pronta quando a empresa está bloqueada (o gestor nunca é bloqueado). */
export async function blockedResponse(companyId: string, role?: string | null) {
  if (role === 'gestor') return null;
  const why = await companyBlocked(companyId);
  return why ? NextResponse.json({ error: why }, { status: 402 }) : null;
}
