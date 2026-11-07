// "Aprovar todos": o cliente aprova de uma vez os posts que estão esperando (ou os que ele marcou).
import { NextResponse } from 'next/server';
import { currentProfile, supabaseAdmin } from '@/lib/supabase';
import { blockedResponse } from '@/lib/access';
import { approvePost } from '@/lib/approve';

export const maxDuration = 300;

export async function POST(req: Request) {
  const me = await currentProfile();
  if (!me?.company_id) return NextResponse.json({ error: 'Faça login com a conta da empresa.' }, { status: 401 });
  const blocked = await blockedResponse(me.company_id, me.role);
  if (blocked) return blocked;
  const { ids } = await req.json().catch(() => ({})) as { ids?: string[] };

  let q = supabaseAdmin().from('posts').select('id').eq('company_id', me.company_id).eq('status', 'aguardando');
  if (ids?.length) q = q.in('id', ids.slice(0, 200));
  const { data } = await q;

  // em lotes de 5 em paralelo (antes era um por um e estourava o tempo com muitos posts)
  let approved = 0;
  const list = data ?? [];
  for (let i = 0; i < list.length; i += 5) {
    const rs = await Promise.all(list.slice(i, i + 5).map((p) => approvePost(p.id).catch(() => ({ ok: false }))));
    approved += rs.filter((r) => r.ok).length;
  }
  return NextResponse.json({ approved, total: list.length });
}
