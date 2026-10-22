// Botão "Gerar com o Claude" do gestor. Os posts nascem como rascunho e vão para a fila de revisão.
import { NextResponse } from 'next/server';
import { currentProfile } from '@/lib/supabase';
import { generateWeekFor, WeekError } from '@/lib/week';

export const maxDuration = 300;

export async function POST(req: Request) {
  const me = await currentProfile();
  if (me?.role !== 'gestor') return NextResponse.json({ error: 'Só o gestor.' }, { status: 403 });
  const { companyId, weekStart, extraContext } = await req.json() as { companyId: string; weekStart: string; extraContext?: string };
  try {
    const r = await generateWeekFor(companyId, weekStart, extraContext);
    return NextResponse.json({ created: r.created, ids: r.ids });
  } catch (e) {
    const status = e instanceof WeekError ? e.status : 500;
    return NextResponse.json({ error: (e as Error).message }, { status });
  }
}
