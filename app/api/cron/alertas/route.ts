// Todo dia: aprova sozinho o que o cliente deixou (se ele ligou essa opção),
// confere o que precisa de atenção e avisa no painel + e-mail (sem WhatsApp).
//  - cliente com post esperando aprovação há mais de 24h
//  - cota do mês quase no fim (80% ou mais)
//  - assinatura atrasada
//  - post aprovado que não foi agendado (Instagram/Metricool desconectado ou arte faltando)
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { isCron } from '@/lib/cron';
import { monthlyRemaining } from '@/lib/quota';
import { PLANS, type PlanId } from '@/lib/plans';
import { notifyClient, notifyGestor, today } from '@/lib/notify';
import { approvePost } from '@/lib/approve';

export const maxDuration = 300;

export async function GET(req: Request) {
  if (!isCron(req)) return NextResponse.json({ error: 'não autorizado' }, { status: 401 });
  const db = supabaseAdmin();
  const day = today();
  const now = Date.now();
  let sent = 0;

  const { data: companies } = await db.from('companies').select('id, name, plan, auto_approve_hours, subscriptions(status)').eq('setup_done', true);
  for (const c of companies ?? []) {
    // 0) Aprovação automática (só para quem ligou em "Minha marca")
    if (c.auto_approve_hours) {
      const { data: due } = await db.from('posts').select('id').eq('company_id', c.id).eq('status', 'aguardando')
        .lt('released_at', new Date(now - c.auto_approve_hours * 3600e3).toISOString());
      let n = 0;
      for (const p of due ?? []) if ((await approvePost(p.id, false)).ok) n++;
      if (n) {
        await notifyClient(c.id, 'aprovar', `${n} posts foram aprovados automaticamente (sem resposta em ${c.auto_approve_hours}h). Dá para mudar isso em Minha marca.`, `auto-${c.id}-${day}`);
        sent++;
      }
    }

    // 1) Aprovação parada há mais de 24h
    const { data: late } = await db.from('posts').select('id, scheduled_at')
      .eq('company_id', c.id).eq('status', 'aguardando')
      .lt('released_at', new Date(now - 24 * 3600e3).toISOString());
    if (late?.length) {
      const soon = late.filter((p) => Date.parse(p.scheduled_at) - now < 48 * 3600e3).length;
      await notifyClient(c.id, 'atraso_aprovacao',
        `${late.length} posts esperam sua aprovação há mais de 24h${soon ? ` (${soon} vão ao ar nos próximos 2 dias)` : ''}.`, `late-${c.id}-${day}`);
      await notifyGestor(c.id, 'atraso_aprovacao', `${c.name}: ${late.length} posts sem aprovação há mais de 24h.`, `late-g-${c.id}-${day}`);
      sent++;
    }

    // 2) Cota do mês quase no fim
    const left = await monthlyRemaining(c.id, c.plan as PlanId);
    const p = PLANS[c.plan as PlanId];
    const days = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate();
    const total = p.storiesPerDay * days + p.postsPerDay * days + p.reelsPerWeek * Math.ceil(days / 7);
    const usedPct = 1 - (left.story + left.post + left.reels) / total;
    if (usedPct >= 0.8) {
      const month = day.slice(0, 7);
      await notifyClient(c.id, 'cota', `Você já usou ${Math.round(usedPct * 100)}% da cota do mês. Quer peças extras ou subir de plano? Fale com a equipe.`, `cota-${c.id}-${month}`);
      await notifyGestor(c.id, 'cota', `${c.name}: ${Math.round(usedPct * 100)}% da cota usada. Boa hora para oferecer upgrade.`, `cota-g-${c.id}-${month}`);
      sent++;
    }

    // 3) Assinatura atrasada
    const rel = c.subscriptions as unknown as { status: string } | { status: string }[] | null;
    if ((Array.isArray(rel) ? rel[0] : rel)?.status === 'atrasada') {
      await notifyGestor(c.id, 'pagamento', `${c.name}: assinatura em atraso, geração pausada.`, `pag-g-${c.id}-${day}`);
      sent++;
    }

    // 4) Aprovado mas não agendado, com menos de 24h para ir ao ar
    const { data: stuck } = await db.from('posts').select('id')
      .eq('company_id', c.id).eq('status', 'aprovado')
      .lt('scheduled_at', new Date(now + 24 * 3600e3).toISOString());
    if (stuck?.length) {
      await notifyGestor(c.id, 'agendamento',
        `${c.name}: ${stuck.length} posts aprovados não foram agendados. Confira a arte e a conexão do Instagram no Metricool.`, `stuck-${c.id}-${day}`);
      sent++;
    }
  }
  return NextResponse.json({ ok: true, sent });
}
