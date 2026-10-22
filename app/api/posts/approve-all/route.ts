// "Aprovar todos": o cliente aprova de uma vez os posts que estão esperando (ou os que ele marcou).
import { NextResponse } from 'next/server';
import { currentProfile, supabaseAdmin } from '@/lib/supabase';
import { approvePost } from '@/lib/approve';

export const maxDuration = 300;

export async function POST(req: Request) {
  const me = await currentProfile();
  if (!me?.company_id) return NextResponse.json({ error: 'Faça login com a conta da empresa.' }, { status: 401 });
  const { ids } = await req.json().catch(() => ({})) as { ids?: string[] };

  let q = supabaseAdmin().from('posts').select('id').eq('company_id', me.company_id).eq('status', 'aguardando');
  if (ids?.length) q = q.in('id', ids.slice(0, 200));
  const { data } = await q;

  let approved = 0;
  for (const p of data ?? []) if ((await approvePost(p.id)).ok) approved++;
  return NextResponse.json({ approved });
}
