// Junta a cada peça: o layout (rodízio, sem repetir), a foto (rodízio), os textos da arte
// e a assinatura da Postiva Design nas datas comemorativas.
import { assignLayouts, CREDIT_TEXT, LAYOUTS as LAYOUT_TEXT, DATE_LAYOUTS as DATE_LAYOUT_TEXT } from './styles';
import { photosBySubject } from './art/assets';
import { NEEDS_PHOTO } from './art/layouts';
import { pickStockPhotos } from './art/stock';
import type { GeneratedPiece } from './claude';

export async function withLayouts<T extends GeneratedPiece>(
  company: { id: string; art_style: string | null; credit_all: boolean | null; template_spec?: { layouts?: string[]; notes?: string } | null },
  pieces: T[],
) {
  const layouts = await assignLayouts(company.id, company.art_style,
    pieces.map((p) => ({ kind: p.kind, date_label: p.date_label, day: p.day })), company.template_spec?.layouts);
  // A foto segue o ASSUNTO da peça: produto da loja pelo nome, foto da loja/equipe quando o post é sobre elas,
  // e foto de banco gratuito pelo tema que o Claude descreveu (art_photo). Nunca uma foto qualquer do rodízio.
  const photos = await photosBySubject(company.id, pieces);
  // Datas comemorativas também pedem foto temática (árvore de Natal, confete…): viram o layout festivo
  const stock = await pickStockPhotos(company.id, layouts.map((l, i) =>
    !photos[i] && (NEEDS_PHOTO.includes(l.layout) || l.isDate) && !(pieces[i] as any).hasProductPhoto ? (['loja', 'equipe'].includes(String(pieces[i].art_photo ?? '').toLowerCase()) ? null : pieces[i].art_photo) : null));
  for (let i = 0; i < layouts.length; i++) {
    if (layouts[i].isDate && stock[i] && !NEEDS_PHOTO.includes(layouts[i].layout)) {
      layouts[i] = { ...layouts[i], layout: 'data-festiva', brief: layouts[i].brief.replace(/^[^;]*/, (DATE_LAYOUT_TEXT as Record<string, string>)['data-festiva'] ?? 'foto temática da data') };
    }
  }
  // Foto de produto (fundo branco) fica melhor no layout de produto
  for (let i = 0; i < layouts.length; i++) {
    if (photos[i] && pieces[i].art_product && !layouts[i].isDate && pieces[i].kind !== 'story') {
      layouts[i] = { ...layouts[i], layout: 'produto-flutuante', brief: layouts[i].brief.replace(/^[^;]*/, (LAYOUT_TEXT as Record<string, string>)['produto-flutuante'] ?? 'produto em destaque') };
    }
  }
  // Empresa sem fotos (ou sem foto que sirva): troca layouts de foto por layouts de texto, em rodízio
  const textPool = ['tipografico', 'cartao-central', 'citacao', 'lista-numerada'];
  const dateTextPool = ['data-tipografica', 'data-ilustrada', 'data-minimalista', 'data-moldura', 'data-carta'];
  let t = 0;
  for (let i = 0; i < layouts.length; i++) {
    if (!photos[i] && !stock[i] && NEEDS_PHOTO.includes(layouts[i].layout) && !(pieces[i] as any).hasProductPhoto) {
      const pool = layouts[i].isDate ? dateTextPool : textPool;
      const next = pool[t++ % pool.length];
      layouts[i] = { ...layouts[i], layout: next, brief: layouts[i].brief.replace(/^[^;]*/, (LAYOUT_TEXT as Record<string, string>)[next] ?? (DATE_LAYOUT_TEXT as Record<string, string>)[next] ?? next) };
    }
  }
  return pieces.map((p, i) => {
    const l = layouts[i];
    const credit = l.isDate || !!company.credit_all;
    return {
      piece: p,
      layout: l.layout,
      date_label: p.date_label ?? null,
      credit,
      asset_id: photos[i],
      stock_photo_url: photos[i] ? null : stock[i],
      art_photo: p.art_photo?.slice(0, 80) ?? null,
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
  layout: l.layout, date_label: l.date_label, credit: l.credit, asset_id: l.asset_id, stock_photo_url: l.stock_photo_url, art_photo: l.art_photo,
  art_headline: l.art_headline, art_sub: l.art_sub, art_cta: l.art_cta, art_items: l.art_items, art_brief: l.art_brief,
});
