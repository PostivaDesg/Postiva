// Cadastro público: qualquer empresa cria a própria conta com 7 dias de teste.
import { NextResponse } from 'next/server';
import { createAccount, type NewAccount } from '@/lib/onboard';
import { supabaseAdmin } from '@/lib/supabase';

export async function POST(req: Request) {
  const body = await req.json().catch(() => null) as (NewAccount & { website?: string }) | null;
  if (!body) return NextResponse.json({ error: 'Dados inválidos.' }, { status: 400 });
  // campo escondido: só robô preenche
  if (body.website) return NextResponse.json({ ok: true });

  // obrigatórios do cadastro público: questionário da marca e aceite dos termos
  const need: [unknown, string][] = [
    [body.whatsapp, 'Informe o WhatsApp da empresa.'], [body.city, 'Informe a cidade.'],
    [body.address, 'Informe o endereço.'], [body.openingHours, 'Informe o horário de funcionamento.'],
    [body.products, 'Conte os 3 produtos ou serviços que mais vendem.'],
  ];
  for (const [v, msg] of need) if (!String(v ?? '').trim()) return NextResponse.json({ error: msg }, { status: 400 });
  if (!body.acceptedTerms) return NextResponse.json({ error: 'Para criar a conta, aceite os Termos de uso e a Política de privacidade.' }, { status: 400 });

  // limite contra abuso: 3 contas por hora por IP e 30 por hora no site todo
  const db = supabaseAdmin();
  const ip = (req.headers.get('x-forwarded-for') ?? '').split(',')[0].trim() || req.headers.get('x-real-ip') || 'desconhecido';
  const hourAgo = new Date(Date.now() - 3600e3).toISOString();
  const [{ count: porIp }, { count: total }] = await Promise.all([
    db.from('signup_attempts').select('id', { count: 'exact', head: true }).eq('ip', ip).gte('created_at', hourAgo),
    db.from('signup_attempts').select('id', { count: 'exact', head: true }).gte('created_at', hourAgo),
  ]);
  if ((porIp ?? 0) >= 3 || (total ?? 0) >= 30) return NextResponse.json({ error: 'Muitos cadastros agora. Tente de novo em alguns minutos.' }, { status: 429 });
  await db.from('signup_attempts').insert({ ip });

  const r = await createAccount({
    name: body.name, instagram: body.instagram, segment: body.segment, city: body.city, whatsapp: body.whatsapp,
    siteUrl: body.siteUrl, plan: body.plan, // sem dados de pagamento: só o teste grátis
    clientEmail: body.clientEmail, clientName: body.clientName, password: body.password,
    address: body.address, openingHours: body.openingHours, products: body.products, audience: body.audience,
    delivery: body.delivery, acceptedTerms: !!body.acceptedTerms,
  });
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });
  return NextResponse.json({ ok: true });
}
