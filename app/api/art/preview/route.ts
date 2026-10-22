// Prévia do modelo desenhado para a empresa: mostra cada layout com textos de exemplo da própria marca.
import { NextResponse } from 'next/server';
import { verify } from '@/lib/art/url';
import { supabaseAdmin } from '@/lib/supabase';
import { renderArt } from '@/lib/art/render';
import { companyTheme } from '@/lib/art/post-art';
import { variantTheme } from '@/lib/art/theme';
import { logoDataUrl, assetDataUrl } from '@/lib/art/assets';
import { BRAND } from '@/lib/brand-config';
import { searchStock, SAMPLE_POSTS } from '@/lib/art/stock';
import { remoteToDataUrl } from '@/lib/art/image-bytes';
import { toSegment } from '@/lib/dates';

export const runtime = 'nodejs';
export const maxDuration = 30; // baixar logo e foto + desenhar a arte

export async function GET(req: Request) {
  const u = new URL(req.url);
  const c = u.searchParams.get('c') ?? '', l = u.searchParams.get('l') ?? '', r = u.searchParams.get('r') ?? '';
  if (!verify(`p.${c}.${l}.${r}`, u.searchParams.get('s'))) return NextResponse.json({ error: 'link inválido' }, { status: 403 });

  const db = supabaseAdmin();
  const { data: company } = await db.from('companies').select('*').eq('id', c).single();
  if (!company) return NextResponse.json({ error: 'empresa não encontrada' }, { status: 404 });
  const { data: photos } = await db.from('company_assets').select('id, kind, storage_path, drive_file_id, name')
    .eq('company_id', c).in('kind', ['loja', 'equipe', 'produto', 'outro']).limit(6);

  // cada layout da prévia com foto e texto diferentes (e combinando entre si), para mostrar a variedade de verdade
  const n = [...l].reduce((s, ch) => (s * 31 + ch.charCodeAt(0)) >>> 0, 7);
  const isDate = l.startsWith('data-');
  const seg = toSegment(company.segment);
  const pairs = SAMPLE_POSTS[seg] ?? SAMPLE_POSTS.outro;
  const sample = isDate && l === 'data-foto-equipe' ? { headline: 'Boas festas!', sub: `Obrigado por estar com a ${company.name} em mais um ano.`, query: 'christmas lights gifts' } : isDate ? { headline: 'Feliz Natal!', sub: `${company.name}, presente nos momentos que você mais precisa.`, query: 'christmas tree ornaments' } : pairs[n % pairs.length];
  // a foto sempre combina com o texto do exemplo (banco de fotos); sem banco, usa uma foto da empresa
  let photo: string | null = null;
  {
    const found = await searchStock(sample.query, 8);
    // baixa aqui (com tempo-limite e conferindo o formato) para a prévia nunca quebrar por causa da foto
    for (const h of [found[n % Math.max(1, found.length)], ...found].filter(Boolean).slice(0, 3)) {
      photo = await remoteToDataUrl(h.thumb ?? h.url);
      if (photo) break;
    }
    if (!photo && !isDate && photos?.length) photo = await assetDataUrl(photos[n % photos.length]);
  }
  return renderArt({
    layout: l, format: 'post', theme: variantTheme(await companyTheme(company), l), brandName: company.name,
    logo: await logoDataUrl(c), photo,
    headline: sample.headline,
    sub: sample.sub,
    cta: isDate ? null : 'Chame no WhatsApp',
    items: ['Primeiro item da lista', 'Segundo item da lista', 'Terceiro item da lista'],
    dateLabel: isDate ? 'Natal' : null,
    footer: company.city ?? null,
    credit: isDate ? BRAND.credit : null,
  });
}
