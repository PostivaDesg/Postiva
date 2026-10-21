// Prévia do modelo desenhado para a empresa: mostra cada layout com textos de exemplo da própria marca.
import { NextResponse } from 'next/server';
import { verify } from '@/lib/art/url';
import { supabaseAdmin } from '@/lib/supabase';
import { renderArt } from '@/lib/art/render';
import { companyTheme } from '@/lib/art/post-art';
import { logoDataUrl, assetDataUrl } from '@/lib/art/assets';
import { BRAND } from '@/lib/brand-config';

export const runtime = 'nodejs';

export async function GET(req: Request) {
  const u = new URL(req.url);
  const c = u.searchParams.get('c') ?? '', l = u.searchParams.get('l') ?? '', r = u.searchParams.get('r') ?? '';
  if (!verify(`p.${c}.${l}.${r}`, u.searchParams.get('s'))) return NextResponse.json({ error: 'link inválido' }, { status: 403 });

  const db = supabaseAdmin();
  const { data: company } = await db.from('companies').select('*').eq('id', c).single();
  if (!company) return NextResponse.json({ error: 'empresa não encontrada' }, { status: 404 });
  const { data: photos } = await db.from('company_assets').select('id, kind, storage_path, drive_file_id, name')
    .eq('company_id', c).in('kind', ['loja', 'equipe', 'produto']).limit(1);

  const isDate = l.startsWith('data-');
  const product = String(company.products ?? '').split('\n')[0]?.split(/[–-]/)[0]?.trim();
  return renderArt({
    layout: l, format: 'post', theme: await companyTheme(company), brandName: company.name,
    logo: await logoDataUrl(c), photo: await assetDataUrl(photos?.[0]),
    headline: isDate ? 'Feliz Natal para quem faz parte da nossa história' : product || `Novidade na ${company.name}`,
    sub: isDate ? null : company.address ? `Venha conhecer: ${company.address}` : 'Texto de apoio do post',
    cta: isDate ? null : 'Chame no WhatsApp',
    items: ['Primeiro item da lista', 'Segundo item da lista', 'Terceiro item da lista'],
    dateLabel: isDate ? 'Natal' : null,
    credit: isDate ? BRAND.credit : null,
  });
}
