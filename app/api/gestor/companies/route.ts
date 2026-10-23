// Gestor cria uma nova empresa (mesmo fluxo do cadastro público, em lib/onboard.ts).
import { NextResponse } from 'next/server';
import { currentProfile } from '@/lib/supabase';
import { createAccount, type NewAccount } from '@/lib/onboard';

export async function POST(req: Request) {
  const me = await currentProfile();
  if (me?.role !== 'gestor') return NextResponse.json({ error: 'Só o gestor pode criar empresas.' }, { status: 403 });
  const body = await req.json() as Omit<NewAccount, 'password'> & { tempPassword: string };
  const r = await createAccount({ ...body, password: body.tempPassword });
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });
  return NextResponse.json({ companyId: r.companyId, warnings: r.warnings });
}
