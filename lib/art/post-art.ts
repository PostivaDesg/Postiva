// Monta a arte de um post com o modelo da empresa.
import { supabaseAdmin } from '../supabase';
import { normalizeSpec, toTheme, variantTheme, textOn, type Theme } from './theme';
import { renderArt } from './render';
import { anyBrandPhoto, assetById, assetDataUrl, logoDataUrl } from './assets';
import { NEEDS_PHOTO } from './layouts';
import { directionById } from '../styles';
import { BRAND } from '../brand-config';
import { stockDataUrl } from './stock';
import { remoteToDataUrl } from './image-bytes';

const brl = (n: number | null | undefined) => (n == null ? null : Number(n).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }));
const br = (d?: string | null) => (d ? d.split('-').reverse().slice(0, 2).join('/') : '');

// Datas com cor própria (Novembro Azul, Outubro Rosa…): a arte usa a cor da campanha, não a cor alternada da marca
const DATE_COLORS: [RegExp, string][] = [
  [/azul/i, '#1565C0'], [/rosa/i, '#D81B60'], [/amarel/i, '#F9A825'], [/laranja/i, '#EF6C00'], [/verde/i, '#2E7D32'],
  [/roxo|lil[aá]s/i, '#6A1B9A'], [/vermelh/i, '#C62828'], [/natal/i, '#B71C1C'], [/p[aá]scoa/i, '#8E24AA'],
];
export function dateTheme(theme: Theme, label?: string | null): Theme {
  const hit = label ? DATE_COLORS.find(([re]) => re.test(label)) : null;
  if (!hit) return theme;
  return { ...theme, palette: { ...theme.palette, primary: hit[1] }, onPrimary: textOn(hit[1]) };
}

export async function companyTheme(company: any) {
  return toTheme(normalizeSpec(company.template_spec ?? {}, directionById(company.art_style).layouts));
}

export async function renderPostArt(postId: string) {
  const db = supabaseAdmin();
  const { data: p } = await db.from('posts').select('*').eq('id', postId).single();
  if (!p) return null;
  const { data: company } = await db.from('companies').select('*').eq('id', p.company_id).single();
  if (!company) return null;

  // Promoção: foto, preço e validade vêm do item da promoção
  let promo: any = null;
  if (p.promo_item_ids?.length === 1) {
    const { data } = await db.from('promo_items').select('*').eq('id', p.promo_item_ids[0]).single();
    promo = data;
  }
  // foto da promoção vem de site de terceiros: baixa e confere o formato (WEBP quebraria a arte)
  const [main, bg] = await Promise.all([
    (async () => (await remoteToDataUrl(promo?.photo_url)) ?? (await assetDataUrl(await assetById(p.asset_id))) ?? (await stockDataUrl(p.stock_photo_url)))(),
    stockDataUrl(p.bg_photo_url),
  ]);
  // se a foto principal falhar, usa a foto de cena; senão uma foto real da loja/equipe (nunca arte de cor lisa)
  const photo = main ?? bg ?? (await anyBrandPhoto(company.id, p.id));
  const bgPhoto = main ? bg : null;
  // regra da Postiva: arte sempre com produto ou pessoa. Layout só de texto (ou embalagem sem embalagem) → layout de foto
  let layout = p.layout ?? 'foto-faixa';
  if (photo && (!NEEDS_PHOTO.includes(layout) || (layout === 'produto-flutuante' && !main))) layout = p.date_label ? 'data-festiva' : 'foto-faixa';

  return renderArt({
    layout,
    format: p.kind === 'post' ? 'post' : 'story',
    // cada post com sua variação; data com cor de campanha usa a cor da campanha
    theme: p.date_label ? dateTheme(await companyTheme(company), p.date_label) : variantTheme(await companyTheme(company), p.id),
    brandName: company.name,
    logo: await logoDataUrl(company.id),
    photo,
    bgPhoto,
    headline: p.art_headline || p.title,
    sub: p.art_sub,
    cta: p.art_cta,
    items: p.art_items,
    priceFrom: brl(promo?.price_from),
    priceTo: brl(promo?.price_to),
    validity: promo ? `Válido de ${br(promo.valid_from)} a ${br(promo.valid_until)} ou enquanto durar o estoque` : null,
    dateLabel: p.date_label,
    footer: company.address ? String(company.address).split(/[,–-]/).slice(-1)[0].trim() || company.city : company.city,
    credit: p.credit ? BRAND.credit : null,
  });
}
