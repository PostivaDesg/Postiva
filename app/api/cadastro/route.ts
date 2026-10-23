// Cadastro público: qualquer empresa cria a própria conta com 7 dias de teste.
import { NextResponse } from 'next/server';
import { createAccount, type NewAccount } from '@/lib/onboard';
import { supabaseAdmin } from '@/lib/supabase';

export async function POST(req: Request) {
  const body = await req.json().catch(() => null) as (NewAccount & { website?: string }) | null;
  if (!body) return NextResponse.json({ error: 'Dados inválidos.' }, { status: 400 });
  // campo escondido: só robô preenche
  if (body.website) return NextResponse.json({ ok: true });

  // limite simples contra abuso: no máximo 5 contas novas por hora no site todo
  const { count } = await supabaseAdmin().from('companies').select('id', { count: 'exact', head: true })
    .gte('created_at', new Date(Date.now() - 3600e3).toISOString());
  if ((count ?? 0) >= 5) return NextResponse.json({ error: 'Muitos cadastros agora. Tente de novo em alguns minutos.' }, { status: 429 });

  const r = await createAccount({
    name: body.name, instagram: body.instagram, segment: body.segment, city: body.city, whatsapp: body.whatsapp,
    siteUrl: body.siteUrl, plan: body.plan, billingType: body.billingType,
    clientEmail: body.clientEmail, clientName: body.clientName, password: body.password, cpfCnpj: body.cpfCnpj,
  });
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });
  return NextResponse.json({ ok: true });
}
