// Botões do gestor: começa a tarefa em segundo plano (fotos → Canva → reels) e devolve na hora.
// GET: progresso (quantas artes do Canva já estão prontas).
import { NextResponse } from 'next/server';
import { currentProfile, supabaseAdmin } from '@/lib/supabase';
import { kickArtes } from '@/lib/jobs';

export async function POST(req: Request) {
  const me = await currentProfile();
  if (me?.role !== 'gestor') return NextResponse.json({ error: 'Só o gestor.' }, { status: 403 });
  const { companyId, postIds, fotos } = await req.json() as { companyId: string; postIds?: string[]; fotos?: boolean };
  let ids: string[] = [];
  if (fotos) {
    let q = supabaseAdmin().from('posts').select('id').eq('company_id', companyId).in('status', ['rascunho', 'aguardando']);
    if (postIds?.length) q = q.in('id', postIds);
    const { data } = await q.order('scheduled_at').limit(150);
    ids = (data ?? []).map((p) => p.id);
  }
  await kickArtes({ companyId, fotos: ids });
  return NextResponse.json({ ok: true, fotos: ids.length });
}

export async function GET(req: Request) {
  const me = await currentProfile();
  if (me?.role !== 'gestor') return NextResponse.json({ error: 'Só o gestor.' }, { status: 403 });
  const companyId = new URL(req.url).searchParams.get('companyId');
  const { data } = await supabaseAdmin().from('posts').select('art_png_path, art_version').eq('company_id', companyId!).in('status', ['rascunho', 'aguardando']);
  const total = data?.length ?? 0;
  const prontas = (data ?? []).filter((p) => String(p.art_png_path ?? '').includes(`-v${p.art_version ?? 1}.png`)).length;
  return NextResponse.json({ total, prontas });
}
