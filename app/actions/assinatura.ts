'use server';
// Cliente escolhe o plano no aviso de fim do teste. Se já houver link do Mercado Pago para o plano
// (app_settings mp_link_<plano>), vai direto para o pagamento; senão a escolha fica registrada e o gestor é avisado.
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { currentProfile, supabaseAdmin } from '@/lib/supabase';
import { PLANS, type PlanId } from '@/lib/plans';
import { mpLinkKey } from '@/lib/trial';
import { notifyGestor, today } from '@/lib/notify';

export async function escolherPlano(form: FormData) {
  const me = await currentProfile();
  if (!me?.company_id || me.role === 'gestor') return;
  const plan = String(form.get('plan') ?? '') as PlanId;
  if (!PLANS[plan] || PLANS[plan].priceBRL == null) return;

  const db = supabaseAdmin();
  await db.from('subscriptions').update({ plano_escolhido: plan, escolhido_em: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq('company_id', me.company_id);
  const { data: c } = await db.from('companies').select('name').eq('id', me.company_id).single();
  await notifyGestor(me.company_id, 'pagamento',
    `${c?.name ?? 'Uma empresa'} terminou o teste e escolheu o plano ${PLANS[plan].name} (R$ ${PLANS[plan].priceBRL}/mês). Falta confirmar o pagamento.`,
    `plano-${me.company_id}-${plan}-${today()}`).catch(() => {});

  const { data: link } = await db.from('app_settings').select('value').eq('key', mpLinkKey(plan)).maybeSingle();
  if (link?.value && /^https:\/\//.test(link.value)) redirect(link.value);
  revalidatePath('/', 'layout');
}
