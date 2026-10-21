// Webhook do Asaas: mantém o status da assinatura em dia.
// No painel do Asaas, cadastre https://SEU-DOMINIO/api/webhooks/asaas com o token ASAAS_WEBHOOK_TOKEN.
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { notifyClient, notifyGestor, today } from '@/lib/notify';

export async function POST(req: Request) {
  if (req.headers.get('asaas-access-token') !== process.env.ASAAS_WEBHOOK_TOKEN) {
    return NextResponse.json({ error: 'token inválido' }, { status: 401 });
  }
  const evt = await req.json() as { event: string; payment?: { subscription?: string; dueDate?: string } };
  const subId = evt.payment?.subscription;
  if (!subId) return NextResponse.json({ ok: true });

  const db = supabaseAdmin();
  const { data: sub } = await db.from('subscriptions')
    .select('company_id, companies(name)').eq('asaas_subscription_id', subId).single();
  if (!sub) return NextResponse.json({ ok: true });
  const rel = sub.companies as unknown as { name: string } | { name: string }[] | null;
  const name = (Array.isArray(rel) ? rel[0] : rel)?.name ?? 'Empresa';

  let status: string | null = null;
  switch (evt.event) {
    case 'PAYMENT_CONFIRMED':
    case 'PAYMENT_RECEIVED':
      status = 'ativa';
      break;
    case 'PAYMENT_OVERDUE':
      status = 'atrasada';
      await notifyClient(sub.company_id, 'pagamento', 'Sua mensalidade está em atraso. Os posts novos ficam pausados até a regularização.', `pag-${sub.company_id}-${today()}`);
      await notifyGestor(sub.company_id, 'pagamento', `${name}: pagamento em atraso.`, `pag-g-${sub.company_id}-${today()}`);
      break;
    case 'SUBSCRIPTION_DELETED':
      status = 'cancelada';
      break;
  }
  if (status) {
    await db.from('subscriptions')
      .update({ status, next_due_date: evt.payment?.dueDate ?? null, updated_at: new Date().toISOString() })
      .eq('company_id', sub.company_id);
  }
  return NextResponse.json({ ok: true });
}
