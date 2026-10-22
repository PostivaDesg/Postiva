// Cliente aprova o post; ele vai direto para o agendamento no Metricool.
import { NextResponse } from 'next/server';
import { currentProfile, supabaseAdmin } from '@/lib/supabase';
import { approvePost } from '@/lib/approve';

export const maxDuration = 300; // reels: monta o vídeo na aprovação

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const me = await currentProfile();
  if (!me) return NextResponse.json({ error: 'Faça login.' }, { status: 401 });
  const { data: post } = await supabaseAdmin().from('posts').select('company_id, status').eq('id', id).single();
  if (!post) return NextResponse.json({ error: 'Post não encontrado.' }, { status: 404 });
  if (me.role !== 'gestor' && post.company_id !== me.company_id) return NextResponse.json({ error: 'Este post não é da sua empresa.' }, { status: 403 });
  const r = await approvePost(id);
  if (!r.ok) return NextResponse.json({ error: 'Este post não está aguardando aprovação.' }, { status: 409 });
  return NextResponse.json({ status: r.status });
}
