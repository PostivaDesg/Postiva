// Prévia do modelo desenhado para a empresa: mostra cada layout com textos de exemplo da própria marca.
import { NextResponse } from 'next/server';
import { verify } from '@/lib/art/url';
import { supabaseAdmin } from '@/lib/supabase';
import { renderArt } from '@/lib/art/render';
import { companyTheme } from '@/lib/art/post-art';
import { logoDataUrl, assetDataUrl } from '@/lib/art/assets';
import { BRAND } from '@/lib/brand-config';
import { searchStock, SAMPLE_QUERIES } from '@/lib/art/stock';
import { toSegment } from '@/lib/dates';

export const runtime = 'nodejs';

export async function GET(req: Request) {
  const u = new URL(req.url);
  const c = u.searchParams.get('c') ?? '', l = u.searchParams.get('l') ?? '', r = u.searchParams.get('r') ?? '';
  if (!verify(`p.${c}.${l}.${r}`, u.searchParams.get('s'))) return NextResponse.json({ error: 'link inválido' }, { status: 403 });

  const db = supabaseAdmin();
  const { data: company } = await db.from('companies').select('*').eq('id', c).single();
  if (!company) return NextResponse.json({ error: 'empresa não encontrada' }, { status: 404 });
  const { data: photos } = await db.from('company_assets').select('id, kind, storage_path, drive_file_id, name')
    .eq('company_id', c).in('kind', ['loja', 'equipe', 'produto', 'outro']).limit(6);

  // cada layout da prévia com uma foto e um texto diferentes, para mostrar a variedade de verdade
  const n = [...l].reduce((s, ch) => (s * 31 + ch.charCodeAt(0)) >>> 0, 7);
  let photo = photos?.length ? await assetDataUrl(photos[n % photos.length]) : null;
  if (!photo) {
    const qs = SAMPLE_QUERIES[toSegment(company.segment)] ?? SAMPLE_QUERIES.outro;
    const found = await searchStock(qs[n % qs.length], 6);
    photo = found[n % Math.max(1, found.length)]?.url ?? null;
  }

  const isDate = l.startsWith('data-');
  const product = String(company.products ?? '').split('\n')[0]?.split(/[–-]/)[0]?.trim();
  const samples = [product || `Novidade na ${company.name}`, 'Cuidar de você é o nosso dia a dia', 'Precisou? A gente entrega', 'Comece o dia com energia'];
  return renderArt({
    layout: l, format: 'post', theme: await companyTheme(company), brandName: company.name,
    logo: await logoDataUrl(c), photo,
    headline: isDate ? 'Feliz Natal para quem faz parte da nossa história' : samples[n % samples.length],
    sub: isDate ? null : company.address ? `Venha conhecer: ${company.address}` : 'Texto de apoio do post',
    cta: isDate ? null : 'Chame no WhatsApp',
    items: ['Primeiro item da lista', 'Segundo item da lista', 'Terceiro item da lista'],
    dateLabel: isDate ? 'Natal' : null,
    credit: isDate ? BRAND.credit : null,
  });
}
