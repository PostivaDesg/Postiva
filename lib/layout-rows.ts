// Junta a cada peça: o layout (rodízio, sem repetir), a foto (rodízio), os textos da arte
// e a assinatura da Postiva Design nas datas comemorativas.
import { assignLayouts, CREDIT_TEXT, LAYOUTS as LAYOUT_TEXT, DATE_LAYOUTS as DATE_LAYOUT_TEXT } from './styles';
import { photosBySubject } from './art/assets';
import { NEEDS_PHOTO } from './art/layouts';
import { pickStockPhotos, pickProductPhotos } from './art/stock';
import type { GeneratedPiece } from './claude';
import { toSegment } from './dates';

type Company = { id: string; art_style: string | null; credit_all: boolean | null; segment?: string | null; template_spec?: { layouts?: string[]; notes?: string } | null };

// Temas de reserva quando a peça não trouxe foto (ou pediu foto da loja/equipe e a empresa não tem)
const RESERVE: Record<string, { loja: string; equipe: string; geral: string[] }> = {
  farmacia: { loja: 'pharmacy store shelves', equipe: 'pharmacist smiling customer', geral: ['pharmacy products shelf', 'woman smiling health', 'family care home', 'delivery motorcycle'] },
  estetica: { loja: 'beauty clinic interior', equipe: 'aesthetician smiling', geral: ['woman skincare', 'spa relaxing', 'glowing skin'] },
  alimentacao: { loja: 'restaurant interior', equipe: 'chef smiling kitchen', geral: ['delicious food', 'friends eating', 'fresh ingredients'] },
  moda: { loja: 'clothing store interior', equipe: 'shop assistant smiling', geral: ['fashion woman', 'outfit', 'shopping bags'] },
  servicos: { loja: 'office reception', equipe: 'team smiling office', geral: ['professional at work', 'customer service', 'handshake'] },
  outro: { loja: 'small shop interior', equipe: 'team smiling', geral: ['happy customer', 'small business', 'people smiling'] },
};
const TEXT_ONLY = ['tipografico', 'cartao-central', 'citacao', 'lista-numerada'];
const PHOTO_DEFAULT = ['foto-faixa', 'foto-cheia', 'diagonal', 'divisao-vertical', 'moldura'];

type PlanIn = { kind: string; art_photo?: string | null; art_product?: string | null; date_label?: string | null; hasProductPhoto?: boolean; layout: string; brief: string; isDate: boolean };

/**
 * Foto e layout de cada peça. Regra da casa: TODA arte tem foto ligada ao assunto (produto, pessoa, cena).
 *  1. foto própria pelo assunto (produto pelo nome; loja/equipe quando o post é sobre elas)
 *  2. foto real da embalagem na internet quando a peça fala de um produto
 *  3. foto de banco pelo tema (ou um tema de reserva do segmento)
 * Layout só de texto fica para o caso raro de não achar foto nenhuma.
 */
export async function planPhotos(company: Company, items: PlanIn[]) {
  const seg = RESERVE[toSegment(company.segment)] ?? RESERVE.outro;
  const photos = await photosBySubject(company.id, items);
  const web = await pickProductPhotos(company.id, items.map((p, i) => (!photos[i] && p.art_product && !p.isDate ? p.art_product : null)));
  let r = 0;
  const queryOf = (p: PlanIn) => {
    const ap = (p.art_photo ?? '').trim(); const low = ap.toLowerCase();
    if (low === 'loja') return seg.loja;
    if (low === 'equipe') return seg.equipe;
    if (ap) return ap;
    return seg.geral[r++ % seg.geral.length];
  };
  const stock = await pickStockPhotos(company.id, items.map((p, i) => (photos[i] || web[i] || p.hasProductPhoto ? null : queryOf(p))));
  const spec = (company.template_spec?.layouts ?? []).filter((l) => NEEDS_PHOTO.includes(l) && !['produto-flutuante', 'faixa-preco'].includes(l));
  const photoPool = spec.length ? spec : PHOTO_DEFAULT;
  const textPool = ['tipografico', 'cartao-central', 'citacao', 'lista-numerada'];
  const dateTextPool = ['data-tipografica', 'data-ilustrada', 'data-minimalista', 'data-moldura', 'data-carta'];
  let k = 0, t = 0;
  const name = (l: string) => (LAYOUT_TEXT as Record<string, string>)[l] ?? (DATE_LAYOUT_TEXT as Record<string, string>)[l] ?? l;
  return items.map((p, i) => {
    const has = !!(photos[i] || web[i] || stock[i] || p.hasProductPhoto);
    let layout = p.layout;
    if (has) {
      if (p.isDate) { if (!NEEDS_PHOTO.includes(layout)) layout = 'data-festiva'; }
      else if ((photos[i] || web[i]) && p.art_product) layout = 'produto-flutuante';
      else if (TEXT_ONLY.includes(layout) || layout === 'produto-flutuante') layout = photoPool[k++ % photoPool.length];
    } else if (NEEDS_PHOTO.includes(layout)) {
      const pool = p.isDate ? dateTextPool : textPool;
      layout = pool[t++ % pool.length];
    }
    return {
      layout,
      brief: layout === p.layout ? p.brief : p.brief.replace(/^[^;]*/, name(layout)),
      asset_id: photos[i],
      stock_photo_url: photos[i] ? null : (web[i] ?? stock[i]),
    };
  });
}

export async function withLayouts<T extends GeneratedPiece>(
  company: Company,
  pieces: T[],
) {
  const layouts = await assignLayouts(company.id, company.art_style,
    pieces.map((p) => ({ kind: p.kind, date_label: p.date_label, day: p.day })), company.template_spec?.layouts);
  const plan = await planPhotos(company, pieces.map((p, i) => ({
    kind: p.kind, art_photo: p.art_photo, art_product: p.art_product, date_label: p.date_label,
    hasProductPhoto: !!(p as any).hasProductPhoto, layout: layouts[i].layout, brief: layouts[i].brief, isDate: layouts[i].isDate,
  })));
  plan.forEach((x, i) => { layouts[i] = { ...layouts[i], layout: x.layout, brief: x.brief }; });
  const photos = plan.map((x) => x.asset_id);
  return pieces.map((p, i) => {
    const l = layouts[i];
    const credit = l.isDate || !!company.credit_all;
    return {
      piece: p,
      layout: l.layout,
      date_label: p.date_label ?? null,
      credit,
      asset_id: photos[i],
      stock_photo_url: plan[i].stock_photo_url,
      art_photo: p.art_photo?.slice(0, 80) ?? null,
      art_product: p.art_product?.slice(0, 120) ?? null,
      art_headline: (p.art_headline ?? p.title ?? '').slice(0, 90),
      art_sub: p.art_sub?.slice(0, 160) ?? null,
      art_cta: p.art_cta?.slice(0, 40) ?? null,
      art_items: Array.isArray(p.art_items) ? p.art_items.slice(0, 4).map((s) => String(s).slice(0, 60)) : null,
      art_brief: [
        `Layout: ${l.brief}.`,
        credit ? `Assinatura discreta no canto: "${CREDIT_TEXT}".` : '',
        p.art_brief,
      ].filter(Boolean).join('\n'),
    };
  });
}

/** Colunas da arte para gravar no post. */
export const artColumns = (l: Awaited<ReturnType<typeof withLayouts>>[number]) => ({
  layout: l.layout, date_label: l.date_label, credit: l.credit, asset_id: l.asset_id, stock_photo_url: l.stock_photo_url, art_photo: l.art_photo, art_product: l.art_product,
  art_headline: l.art_headline, art_sub: l.art_sub, art_cta: l.art_cta, art_items: l.art_items, art_brief: l.art_brief,
});
