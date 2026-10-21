// Link rastreável: conta o clique e redireciona para o WhatsApp da empresa.
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { whatsappLink } from '@/lib/tracking';

export async function GET(_req: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  if (!/^[a-z0-9-]{4,40}$/.test(code)) return NextResponse.redirect(process.env.NEXT_PUBLIC_SITE_URL ?? 'https://postivadesign.com.br');
  const db = supabaseAdmin();

  // Link de um post…
  const { data: post } = await db.from('posts').select('id, title, company_id').eq('tracking_code', code).maybeSingle();
  // …ou o link fixo da bio
  const companyId = post?.company_id ?? (await db.from('companies').select('id').eq('bio_code', code).maybeSingle()).data?.id;
  if (!companyId) return NextResponse.redirect(process.env.NEXT_PUBLIC_SITE_URL ?? 'https://postivadesign.com.br');

  const { data: company } = await db.from('companies').select('name, whatsapp, instagram, site_url').eq('id', companyId).single();
  await db.from('link_clicks').insert({ company_id: companyId, post_id: post?.id ?? null, code });

  if (!company?.whatsapp) return NextResponse.redirect(company?.site_url ?? `https://instagram.com/${(company?.instagram ?? '').replace('@', '')}`);
  const msg = post
    ? `Olá! Vi no Instagram: "${post.title}". (código ${code})`
    : `Olá! Vim pelo Instagram da ${company.name}. (código ${code})`;
  return NextResponse.redirect(whatsappLink(company.whatsapp, msg), 302);
}
