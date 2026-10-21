// Vídeo do reels. O arquivo vai DIRETO do navegador para o armazenamento (a Vercel não aceita arquivos grandes),
// em duas etapas: 1) pedir o link de envio; 2) avisar que terminou → o reels é agendado se já estiver aprovado.
import { NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { currentProfile, supabaseAdmin } from '@/lib/supabase';
import { schedulePostNow } from '@/lib/approve';

const TYPES = ['video/mp4', 'video/quicktime'];
// Supabase grátis aceita até 50 MB por arquivo; no Pro, suba MAX_VIDEO_MB (e o limite global em Storage > Settings)
const MAX_MB = Number(process.env.MAX_VIDEO_MB ?? 50);

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const me = await currentProfile();
  if (!me) return NextResponse.json({ error: 'Faça login.' }, { status: 401 });
  const db = supabaseAdmin();
  const { data: post } = await db.from('posts').select('id, company_id, kind, status').eq('id', id).single();
  if (!post || (me.role !== 'gestor' && post.company_id !== me.company_id)) return NextResponse.json({ error: 'Post não encontrado.' }, { status: 404 });
  if (post.kind !== 'reels') return NextResponse.json({ error: 'Só reels recebem vídeo.' }, { status: 400 });

  const b = await req.json() as { action: 'link' | 'pronto'; type?: string; size?: number; path?: string };
  if (b.action === 'link') {
    if (!TYPES.includes(b.type ?? '')) return NextResponse.json({ error: 'Envie um vídeo MP4 ou MOV.' }, { status: 400 });
    if ((b.size ?? 0) > MAX_MB * 1024 * 1024) return NextResponse.json({ error: `O vídeo pode ter no máximo ${MAX_MB} MB. Exporte em 1080p com qualidade média.` }, { status: 400 });
    const path = `${post.company_id}/${post.id}-${randomUUID()}.${b.type === 'video/quicktime' ? 'mov' : 'mp4'}`;
    const { data, error } = await db.storage.from('videos').createSignedUploadUrl(path);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ path, token: data.token });
  }

  // pronto: confere que o arquivo existe e grava
  if (!b.path?.startsWith(`${post.company_id}/${post.id}-`)) return NextResponse.json({ error: 'Envio inválido.' }, { status: 400 });
  const folder = b.path.split('/')[0], name = b.path.split('/')[1];
  const { data: files } = await db.storage.from('videos').list(folder, { search: name });
  if (!files?.some((f) => f.name === name)) return NextResponse.json({ error: 'O vídeo não chegou. Tente de novo.' }, { status: 400 });
  await db.from('posts').update({ video_path: b.path }).eq('id', id);
  const status = post.status === 'aprovado' ? await schedulePostNow(id) : post.status;
  return NextResponse.json({ ok: true, status });
}
