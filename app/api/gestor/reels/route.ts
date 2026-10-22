// Monta os vídeos dos reels (lib/reels.tsx). Sem postId: devolve os reels da empresa que ainda não têm vídeo
// (o painel chama um por um, cada montagem cabe no tempo da Vercel). Com postId: monta aquele.
import { NextResponse } from 'next/server';
import { currentProfile, supabaseAdmin } from '@/lib/supabase';
import { buildReel } from '@/lib/reels';

export const maxDuration = 300;

export async function POST(req: Request) {
  const me = await currentProfile();
  if (me?.role !== 'gestor') return NextResponse.json({ error: 'Só o gestor.' }, { status: 403 });
  const { companyId, postIds, postId, refazer } = await req.json() as { companyId: string; postIds?: string[]; postId?: string; refazer?: boolean };
  const db = supabaseAdmin();
  if (postId) {
    try { return NextResponse.json(await buildReel(postId)); }
    catch (e) { return NextResponse.json({ error: e instanceof Error ? e.message : 'Falha ao montar o vídeo.' }, { status: 500 }); }
  }
  let q = db.from('posts').select('id, video_path, video_auto').eq('company_id', companyId).eq('kind', 'reels').in('status', ['rascunho', 'aguardando', 'aprovado']);
  if (postIds?.length) q = q.in('id', postIds);
  const { data } = await q.limit(30);
  // refazer: remonta os automáticos também (nunca troca um vídeo enviado pelo cliente)
  const pending = (data ?? []).filter((p) => !p.video_path || (refazer && p.video_auto)).map((p) => p.id);
  return NextResponse.json({ pending });
}
