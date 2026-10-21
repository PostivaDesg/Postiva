// Fila única de revisão: o gestor edita, libera ou descarta um rascunho.
// O tempo gasto em cada post é somado (review_seconds) para calcular a margem por cliente.
import { NextResponse } from 'next/server';
import { currentProfile, supabaseAdmin } from '@/lib/supabase';
import { notifyClient } from '@/lib/notify';

export async function POST(req: Request) {
  const me = await currentProfile();
  if (me?.role !== 'gestor') return NextResponse.json({ error: 'Só o gestor.' }, { status: 403 });
  const b = await req.json() as {
    postId: string; action: 'liberar' | 'descartar' | 'salvar';
    title?: string; caption?: string; seconds?: number;
  };
  const db = supabaseAdmin();
  const { data: post } = await db.from('posts').select('id, company_id, status, review_seconds').eq('id', b.postId).single();
  if (!post) return NextResponse.json({ error: 'Post não encontrado.' }, { status: 404 });
  if (post.status !== 'rascunho') return NextResponse.json({ error: 'Este post já saiu da fila.' }, { status: 409 });

  const seconds = Math.min(Math.max(0, Math.round(b.seconds ?? 0)), 3600); // ignora abas esquecidas abertas
  const patch: Record<string, unknown> = { review_seconds: post.review_seconds + seconds };
  if (typeof b.title === 'string') patch.title = b.title;
  if (typeof b.caption === 'string') patch.caption = b.caption;

  if (b.action === 'descartar') {
    await db.from('posts').delete().eq('id', post.id); // devolve a peça para a cota
    return NextResponse.json({ ok: true });
  }
  if (b.action === 'liberar') {
    patch.status = 'aguardando';
    patch.released_at = new Date().toISOString();
  }
  await db.from('posts').update(patch).eq('id', post.id);

  if (b.action === 'liberar') {
    const { count } = await db.from('posts').select('id', { count: 'exact', head: true })
      .eq('company_id', post.company_id).eq('status', 'aguardando');
    const { data: c } = await db.from('companies').select('setup_done').eq('id', post.company_id).single();
    if (!c?.setup_done) await db.from('companies').update({ setup_done: true }).eq('id', post.company_id);
    // Um aviso por dia por empresa, mesmo liberando vários posts
    await notifyClient(post.company_id, 'aprovar', `Você tem ${count ?? 1} posts esperando aprovação.`,
      `aprovar-${post.company_id}-${new Date(Date.now() - 3 * 3600e3).toISOString().slice(0, 10)}`);
  }
  return NextResponse.json({ ok: true });
}
