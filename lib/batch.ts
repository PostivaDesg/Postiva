// Geração de domingo em LOTE (Message Batches API do Claude):
//  - custa 50% menos que a chamada normal;
//  - não tem limite de tempo da Vercel: o Claude processa em segundo plano (geralmente em menos de 1 hora).
// Domingo: submitWeekBatch() envia todas as empresas. A cada hora: collectBatches() grava o que ficou pronto.
import { anthropic, parseWeek } from './claude';
import { supabaseAdmin } from './supabase';
import { prepareWeek, saveWeek } from './week';
import { notifyGestor } from './notify';

export async function submitWeekBatch(weekStart: string) {
  const db = supabaseAdmin();
  // Nunca envia a mesma semana duas vezes (rotina rodou de novo, por exemplo)
  const { data: already } = await db.from('generation_batches').select('id').eq('week_start', weekStart).limit(1);
  if (already?.length) return { batch: null, skipped: [`semana ${weekStart} já enviada`] };
  const { data: companies } = await db.from('companies').select('id, name').eq('setup_done', true);
  const requests: { custom_id: string; params: any }[] = [];
  const items: Record<string, { company_id: string; quota: Record<string, number> }> = {};
  const skipped: string[] = [];

  for (const c of companies ?? []) {
    try {
      const { quota, params } = await prepareWeek(c.id, weekStart);
      const custom_id = `w-${c.id.replace(/-/g, '')}`; // até 64 caracteres
      requests.push({ custom_id, params });
      items[custom_id] = { company_id: c.id, quota };
    } catch (e) {
      skipped.push(`${c.name}: ${(e as Error).message}`);
    }
  }
  if (!requests.length) return { batch: null, skipped };

  const batch = await anthropic.messages.batches.create({ requests } as any);
  await db.from('generation_batches').insert({ anthropic_batch_id: batch.id, week_start: weekStart, items, status: 'enviado' });
  return { batch: batch.id, count: requests.length, skipped };
}

export async function collectBatches() {
  const db = supabaseAdmin();
  const { data: open } = await db.from('generation_batches').select('*').eq('status', 'enviado');
  const report: string[] = [];

  for (const b of open ?? []) {
    const info = await anthropic.messages.batches.retrieve(b.anthropic_batch_id);
    if (info.processing_status !== 'ended') continue;

    const done: string[] = [], failed: string[] = [];
    for await (const r of await anthropic.messages.batches.results(b.anthropic_batch_id)) {
      const item = b.items[r.custom_id];
      if (!item) continue;
      const { data: company } = await db.from('companies').select('*').eq('id', item.company_id).single();
      if (!company) continue;
      try {
        if (r.result.type !== 'succeeded') throw new Error(r.result.type);
        const { pieces, usage } = parseWeek(r.result.message as any);
        // lote custa metade: registra o uso pela metade para a margem ficar certa
        const half = { ...usage, input_tokens: Math.round(usage.input_tokens / 2), output_tokens: Math.round(usage.output_tokens / 2) };
        const n = await saveWeek(company, item.quota as any, pieces, half);
        done.push(`${company.name} (${n})`);
      } catch (e) {
        failed.push(`${company.name}: ${(e as Error).message}`);
      }
    }
    await db.from('generation_batches').update({ status: 'concluido', finished_at: new Date().toISOString() }).eq('id', b.id);
    const msg = `Semana de ${String(b.week_start).split('-').reverse().join('/')} pronta para revisar: ${done.join(', ') || 'nenhuma'}.` +
      (failed.length ? ` Com problema (gere pelo botão da empresa): ${failed.join('; ')}.` : '');
    await notifyGestor(null, 'semana', msg, `semana-${b.week_start}`);
    report.push(msg);
  }
  return report;
}
