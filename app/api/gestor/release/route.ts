// Gestor libera os rascunhos revisados para o cliente aprovar e avisa no painel + e-mail.
import { NextResponse } from 'next/server';
import { currentProfile, supabaseAdmin } from '@/lib/supabase';
import { notifyClient } from '@/lib/notify';

export async function POST(req: Request) {
  const me = await currentProfile();
  if (me?.role !== 'gestor') return NextResponse.json({ error: 'Só o gestor.' }, { status: 403 });

  const { companyId, postIds } = await req.json() as { companyId: string; postIds: string[] };
  const db = supabaseAdmin();

  const { data, error } = await db.from('posts').update({ status: 'aguardando', released_at: new Date().toISOString() })
    .eq('company_id', companyId).eq('status', 'rascunho').in('id', postIds).select('id');
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const { data: company } = await db.from('companies').select('setup_done').eq('id', companyId).single();
  if (!company?.setup_done) await db.from('companies').update({ setup_done: true }).eq('id', companyId);

  if (data.length) await notifyClient(companyId, 'aprovar', `Você tem ${data.length} posts novos esperando aprovação.`);
  return NextResponse.json({ released: data.length });
}
