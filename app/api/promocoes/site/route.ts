// Modo 1: lê produtos do site da própria empresa (link de produto ou de categoria).
import { NextResponse } from 'next/server';
import { currentProfile, supabaseAdmin } from '@/lib/supabase';
import { assertSameSite, fromSite } from '@/lib/products';
import { resolveCompany } from '@/lib/quota';

export const maxDuration = 60;

export async function POST(req: Request) {
  const me = await currentProfile();
  if (!me) return NextResponse.json({ error: 'Faça login.' }, { status: 401 });
  const { url, companyId } = await req.json() as { url: string; companyId?: string };
  const cid = resolveCompany(me, companyId);
  if (!cid) return NextResponse.json({ error: 'Empresa não informada.' }, { status: 400 });

  const { data: company } = await supabaseAdmin().from('companies').select('site_url').eq('id', cid).single();
  try {
    assertSameSite(url, company?.site_url ?? null);
    const products = await fromSite(url);
    if (!products.length) return NextResponse.json({ error: 'Não encontrei produtos nesse link. Tente o link de um produto.' }, { status: 404 });
    return NextResponse.json({ products });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
