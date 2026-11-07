// Ativar/desativar a produção de uma empresa.
// Desativar: as peças futuras (com o cliente, aprovadas ou já agendadas) viram 'pausado', guardando o status anterior.
// Nada é apagado: a rotina agendada pausa o agendamento no Metricool (vira rascunho) e, quando a empresa é
// reativada, devolve cada peça ao status anterior, reativando no Metricool ou remarcando se a data já passou.
import { supabaseAdmin } from '@/lib/supabase';
import type { MotivoInativa } from '@/lib/inativa';
import { novoPagoAte } from '@/lib/trial';

export async function desativarEmpresa(id: string, motivo: MotivoInativa, nota?: string | null) {
  const db = supabaseAdmin();
  await db.from('companies').update({
    ativa: false, motivo_inativa: motivo, nota_inativa: nota?.trim() || null, inativa_desde: new Date().toISOString(),
  }).eq('id', id);
  for (const st of ['aguardando', 'aprovado', 'agendado'] as const) {
    await db.from('posts').update({ status: 'pausado', status_antes_pausa: st })
      .eq('company_id', id).eq('status', st).gt('scheduled_at', new Date().toISOString());
  }
}

export async function ativarEmpresa(id: string) {
  // As peças pausadas continuam 'pausado': a rotina agendada devolve o status e remarca no Metricool.
  await supabaseAdmin().from('companies').update({ ativa: true, motivo_inativa: null, nota_inativa: null, inativa_desde: null }).eq('id', id);
}

/** Pagamento manual (ex.: dinheiro): libera a empresa por mais 30 dias e reativa se estiver desativada. */
export async function ativarPor30Dias(id: string) {
  const db = supabaseAdmin();
  const { data: sub } = await db.from('subscriptions').select('company_id, pago_ate').eq('company_id', id).maybeSingle();
  const pago_ate = novoPagoAte(sub?.pago_ate);
  if (sub) await db.from('subscriptions').update({ status: 'ativa', pago_ate, updated_at: new Date().toISOString() }).eq('company_id', id);
  else await db.from('subscriptions').insert({ company_id: id, status: 'ativa', pago_ate });
  await ativarEmpresa(id);
  return pago_ate;
}
