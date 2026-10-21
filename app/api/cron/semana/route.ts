// Domingo 9h: envia a semana seguinte de todas as empresas para o Claude em LOTE (50% mais barato).
// O resultado é gravado pela rotina /api/cron/coletar, que roda de hora em hora.
import { NextResponse } from 'next/server';
import { isCron } from '@/lib/cron';
import { nextMonday } from '@/lib/week';
import { submitWeekBatch } from '@/lib/batch';
import { notifyGestor } from '@/lib/notify';

export const maxDuration = 300;

export async function GET(req: Request) {
  if (!isCron(req)) return NextResponse.json({ error: 'não autorizado' }, { status: 401 });
  const week = nextMonday();
  const r = await submitWeekBatch(week);
  if (r.skipped.length) await notifyGestor(null, 'semana', `Semana ${week}: não enviadas para geração: ${r.skipped.join('; ')}.`, `semana-skip-${week}`);
  return NextResponse.json({ week, ...r });
}
