// Refaz a escolha de foto (e o layout) de uma lista de posts, sem mudar os textos. Usado pelo botão do gestor
// e pela tarefa em segundo plano (lib/jobs.ts).
import { supabaseAdmin } from './supabase';
import { pickWithVision } from './art/pick';
import { photoQueries } from './claude';
import { photoLessons } from './learning';

export async function refazerFotos(companyId: string, postIds: string[]) {
  const db = supabaseAdmin();
  const { data: company } = await db.from('companies').select('*').eq('id', companyId).single();
  if (!company || !postIds.length) return { updated: 0, withPhoto: 0 };
  const { data: posts } = await db.from('posts').select('id, kind, layout, art_photo, art_product, date_label, art_version, art_headline, caption, product_image_url')
    .in('id', postIds).in('status', ['rascunho', 'aguardando']);
  if (!posts?.length) return { updated: 0, withPhoto: 0 };

  // o Claude revê o tema de foto pelo título e pela legenda (mantém "loja"/"equipe" quando há foto própria)
  const { data: own } = await db.from('company_assets').select('kind').eq('company_id', companyId).in('kind', ['loja', 'equipe']);
  const ownHint = own?.length
    ? 'A empresa tem fotos reais próprias da loja e da equipe: em post de horário, loja aberta, entrega, atendimento ou bastidores, responda "q": "loja" (ou "equipe" se fala das pessoas).'
    : '';
  const qs = await photoQueries(posts.map((p) => ({ headline: p.art_headline ?? '', caption: p.caption, segment: company.segment })), [ownHint, await photoLessons(companyId)].filter(Boolean).join('\n')).catch(() => []);
  posts.forEach((p, i) => {
    if (!qs[i]?.q) return;
    if (!['loja', 'equipe'].includes(String(p.art_photo ?? '').toLowerCase()) || ['loja', 'equipe'].includes(qs[i].q.toLowerCase())) p.art_photo = qs[i].q;
    if (!p.date_label && !p.product_image_url) p.art_product = qs[i].p ?? p.art_product;
  });
  await Promise.all(posts.map((p) => db.from('posts').update({ art_photo: p.art_photo, art_product: p.art_product }).eq('id', p.id)));

  let updated = 0, withPhoto = 0;
  await pickWithVision(company, posts.map((p) => ({
    id: p.id, kind: p.kind, layout: p.layout ?? 'foto-faixa', date_label: p.date_label,
    headline: p.art_headline ?? '', caption: p.caption, art_photo: p.art_photo, art_product: p.art_product, product_image_url: p.product_image_url,
  })), async (i, x) => {
    if (!x.asset_id && !x.stock_photo_url) return;
    withPhoto++;
    const { error } = await db.from('posts').update({ layout: x.layout, asset_id: x.asset_id, stock_photo_url: x.stock_photo_url, bg_photo_url: x.bg_photo_url ?? null, art_version: (posts[i].art_version ?? 1) + 1 }).eq('id', posts[i].id);
    if (!error) updated++;
  });
  return { updated, withPhoto };
}
