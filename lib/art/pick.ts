// Escolha de foto COM OLHO: busca várias candidatas e o Claude olha as miniaturas e escolhe a que mostra
// o assunto do post (ou pede outra busca). Usado no "Refazer fotos" e logo depois de gerar a semana.
// Custo: ~1 a 2 mil tokens por post (miniaturas pequenas), alguns centavos por semana.
import { anthropic, MODEL } from '../claude';
import { supabaseAdmin } from '../supabase';
import { photosBySubject } from './assets';
import { allowed, bannedWords, braveImages, relevant, runLimited, saveCopy, searchStock, stockEnabled, productSearchEnabled, type Hit } from './stock';
import { NEEDS_PHOTO } from './layouts';
import { toSegment } from '../dates';

export type PickIn = {
  id: string; kind: string; layout: string; date_label?: string | null;
  headline: string; caption?: string | null; art_photo?: string | null; art_product?: string | null;
};
export type PickOut = { layout: string; asset_id: string | null; stock_photo_url: string | null };

const RESERVE: Record<string, { loja: string; equipe: string }> = {
  farmacia: { loja: 'pharmacist pharmacy counter', equipe: 'pharmacist smiling customer' },
  estetica: { loja: 'beauty clinic interior', equipe: 'aesthetician smiling' },
  alimentacao: { loja: 'restaurant interior', equipe: 'chef smiling kitchen' },
  moda: { loja: 'clothing store interior', equipe: 'shop assistant smiling' },
  servicos: { loja: 'office reception', equipe: 'team smiling office' },
  outro: { loja: 'small shop interior', equipe: 'team smiling' },
};
const TEXT_ONLY = ['tipografico', 'cartao-central', 'citacao', 'lista-numerada'];

/** Claude olha as candidatas e escolhe. Devolve o índice (0 = nenhuma serve) e, se nenhuma servir, uma busca melhor. */
async function judge(segment: string, p: PickIn, cands: Hit[], product: boolean) {
  const content: any[] = cands.map((h) => ({ type: 'image', source: { type: 'url', url: h.thumb ?? h.url } }));
  content.push({
    type: 'text',
    text: `Post de Instagram de ${segment}.\nTítulo: "${p.headline}"\nLegenda: "${String(p.caption ?? '').slice(0, 400)}"\n\n` +
      `As ${cands.length} imagens acima são candidatas à foto da arte (numeradas de 1 a ${cands.length}, na ordem).\n` +
      (product
        ? 'O post fala de um produto: a foto boa mostra a EMBALAGEM do produto, nítida, inteira, sem marca d\'água, sem montagem feia e sem texto de outra loja por cima.\n'
        : 'A foto boa mostra claramente o assunto da legenda (o produto, a pessoa ou a cena), é bonita, profissional, sem marca d\'água e sem nada que não combine com uma farmácia/loja séria.\n') +
      'Nunca escolha: bebida alcoólica, bar, cigarro, foto escura, borrada, sem relação, com texto grande ou com logotipo de outra empresa.\n' +
      'Responda SÓ com JSON: {"escolha": número da melhor (0 se nenhuma serve), "nova_busca": "se 0, uma busca melhor em inglês de 2 a 5 palavras"}',
  });
  try {
    const res = await anthropic.messages.create({ model: MODEL, max_tokens: 300, messages: [{ role: 'user', content }] });
    const text = res.content.filter((c) => c.type === 'text').map((c) => (c as { text: string }).text).join('');
    const j = JSON.parse(text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1)) as { escolha?: number; nova_busca?: string };
    return { pick: Math.max(0, Math.min(cands.length, Number(j.escolha) || 0)), retry: j.nova_busca ? String(j.nova_busca) : null };
  } catch {
    return { pick: cands.length ? 1 : 0, retry: null }; // se o olho falhar, fica a primeira (já filtrada)
  }
}

export async function pickWithVision(company: any, posts: PickIn[]): Promise<PickOut[]> {
  const seg = toSegment(company.segment);
  const reserve = RESERVE[seg] ?? RESERVE.outro;
  const banned = bannedWords(company.forbidden);
  const segName = company.segment ? String(company.segment) : 'pequena empresa';
  const own = await photosBySubject(company.id, posts);
  const { data: used } = await supabaseAdmin().from('posts').select('stock_photo_url').eq('company_id', company.id)
    .not('stock_photo_url', 'is', null).not('id', 'in', `(${posts.map((p) => p.id).join(',') || '00000000-0000-0000-0000-000000000000'})`).limit(300);
  const seen = new Set((used ?? []).map((u) => String(u.stock_photo_url).split('/').pop()!.replace(/\.\w+$/, '')));

  const specPhoto = (company.template_spec?.layouts ?? []).filter((l: string) => NEEDS_PHOTO.includes(l) && !['produto-flutuante', 'faixa-preco'].includes(l));
  const photoPool = specPhoto.length ? specPhoto : ['foto-faixa', 'foto-cheia', 'diagonal', 'divisao-vertical'];
  let k = 0;
  const out: PickOut[] = posts.map((p) => ({ layout: p.layout, asset_id: null, stock_photo_url: null }));

  const queryOf = (p: PickIn) => {
    const ap = String(p.art_photo ?? '').trim(); const low = ap.toLowerCase();
    return low === 'loja' ? reserve.loja : low === 'equipe' ? reserve.equipe : ap || p.headline;
  };
  const fresh = (hs: Hit[], q: string, strict = true) =>
    hs.filter((h) => allowed(h, banned) && (!strict || relevant(h, q)) && !seen.has(h.key)).slice(0, 6);

  // Produtos primeiro e um de cada vez (o Brave grátis aceita ~1 busca por segundo); o resto em paralelo
  const order = posts.map((_, i) => i);
  const productIdx = order.filter((i) => !own[i] && posts[i].art_product && !posts[i].date_label && productSearchEnabled());
  const restIdx = order.filter((i) => !productIdx.includes(i));

  const choose = async (i: number, cands: Hit[], product: boolean) => {
    if (!cands.length) return null;
    const { pick, retry } = await judge(segName, posts[i], cands, product);
    if (pick > 0) {
      const hit = cands[pick - 1];
      seen.add(hit.key);
      return (await saveCopy(company.id, hit)) ?? (hit.thumb && hit.thumb !== hit.url ? await saveCopy(company.id, { ...hit, key: hit.key + 't', url: hit.thumb }) : null);
    }
    if (retry && !product && stockEnabled()) {
      const again = fresh(await searchStock(retry, 30), retry);
      if (again.length) {
        const r2 = await judge(segName, posts[i], again, false);
        if (r2.pick > 0) { const hit = again[r2.pick - 1]; seen.add(hit.key); return saveCopy(company.id, hit); }
      }
    }
    return null;
  };

  await runLimited(productIdx, 1, async (i) => {
    const p = posts[i];
    const cands = fresh(await braveImages(`${p.art_product} embalagem`), '', false);
    const path = await choose(i, cands, true);
    if (path) { out[i] = { layout: 'produto-flutuante', asset_id: null, stock_photo_url: path }; return; }
    restIdx.push(i); // sem embalagem boa: tenta foto de banco
  });

  await runLimited(restIdx, 5, async (i) => {
    const p = posts[i];
    if (own[i]) { out[i] = { layout: TEXT_ONLY.includes(p.layout) ? photoPool[k++ % photoPool.length] : p.layout, asset_id: own[i], stock_photo_url: null }; return; }
    if (!stockEnabled()) return;
    const q = queryOf(p);
    const path = await choose(i, fresh(await searchStock(q, 30), q), false);
    if (!path) return;
    let layout = p.layout;
    if (p.date_label) { if (!NEEDS_PHOTO.includes(layout)) layout = 'data-festiva'; }
    else if (TEXT_ONLY.includes(layout) || layout === 'produto-flutuante') layout = photoPool[k++ % photoPool.length];
    out[i] = { layout, asset_id: null, stock_photo_url: path };
  });
  return out;
}
