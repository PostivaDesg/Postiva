// Artes pelo Canva. Sem postId: lista os posts da empresa (rascunho ou esperando aprovação) cuja arte do Canva
// está faltando ou desatualizada. Com postId: gera aquela (o painel chama um por um; cada uma leva ~20 s).
import { NextResponse } from 'next/server';
import { currentProfile, supabaseAdmin } from '@/lib/supabase';
import { canvaArt, companyUsesCanva } from '@/lib/canva-art';

export const maxDuration = 120;

export async function POST(req: Request) {
  const me = await currentProfile();
  if (me?.role !== 'gestor') return NextResponse.json({ error: 'Só o gestor.' }, { status: 403 });
  const { companyId, postIds, postId } = await req.json() as { companyId: string; postIds?: string[]; postId?: string };
  if (postId) {
    try { return NextResponse.json({ path: await canvaArt(postId) }); }
    catch (e) { return NextResponse.json({ error: e instanceof Error ? e.message : 'Falha no Canva.' }, { status: 500 }); }
  }
  if (!(await companyUsesCanva(companyId))) return NextResponse.json({ pending: [], off: true });
  let q = supabaseAdmin().from('posts').select('id, art_png_path, art_version').eq('company_id', companyId).in('status', ['rascunho', 'aguardando']);
  if (postIds?.length) q = q.in('id', postIds);
  const { data } = await q.order('scheduled_at').limit(120);
  const pending = (data ?? []).filter((p) => !String(p.art_png_path ?? '').includes(`-v${p.art_version ?? 1}.png`)).map((p) => p.id);
  return NextResponse.json({ pending });
}
