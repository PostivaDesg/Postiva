// De hora em hora: grava as semanas que o Claude terminou de gerar em lote.
import { NextResponse } from 'next/server';
import { isCron } from '@/lib/cron';
import { collectBatches } from '@/lib/batch';

export const maxDuration = 800;

export async function GET(req: Request) {
  if (!isCron(req)) return NextResponse.json({ error: 'não autorizado' }, { status: 401 });
  return NextResponse.json({ report: await collectBatches() });
}
