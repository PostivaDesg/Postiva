// Escolha de foto COM OLHO: busca várias candidatas e o Claude olha as miniaturas e escolhe a que mostra
// o assunto do post (ou pede outra busca). Usado no "Refazer fotos" e logo depois de gerar a semana.
// Custo: ~1 a 2 mil tokens por post (miniaturas pequenas), alguns centavos por semana.
import { anthropic, MODEL } from '../claude';
import { photoLessons } from '../learning';
import { imageMime } from './image-bytes';
import { supabaseAdmin } from '../supabase';
import { photosBySubject } from './assets';
import { allowed, bannedWords, braveImages, productImages, relevant, runLimited, saveCopy, searchStock, stockEnabled, productSearchEnabled, type Hit } from './stock';
import { NEEDS_PHOTO } from './layouts';
import { toSegment } from '../dates';

export type PickIn = {
  id: string; kind: string; layout: string; date_label?: string | null;
  headline: string; caption?: string | null; art_photo?: string | null; art_product?: string | null;
  product_image_url?: string | null; // embalagem escolhida à mão (pelo gestor ou pelo Claude na conversa): pula a busca
};
export type PickOut = { layout: string; asset_id: string | null; stock_photo_url: string | null; bg_photo_url?: string | null };

const RESERVE: Record<string, { loja: string; equipe: string }> = {
  farmacia: { loja: 'pharmacist pharmacy counter', equipe: 'pharmacist smiling customer' },
  estetica: { loja: 'beauty clinic interior', equipe: 'aesthetician smiling' },
  alimentacao: { loja: 'restaurant interior', equipe: 'chef smiling kitchen' },
  moda: { loja: 'clothing store interior', equipe: 'shop assistant smiling' },
  servicos: { loja: 'office reception', equipe: 'team smiling office' },
  outro: { loja: 'small shop interior', equipe: 'team smiling' },
};
const TEXT_ONLY = ['tipografico', 'cartao-central', 'citacao', 'lista-numerada'];

// Sem crédito/sem acesso à API do Claude: em vez de jogar a foto da loja em tudo, escolhe pelas etiquetas do banco
// de fotos (o Pixabay descreve cada foto com palavras). Embalagem de produto não tem etiqueta: fica de fora.
let visionDown = false;
const outage = (e: unknown) => {
  const m = e instanceof Error ? e.message : String(e);
  const st = (e as { status?: number })?.status;
  return /credit balance|billing|overloaded|authentication|api[_ ]key|permission/i.test(m) || [401, 402, 403, 429, 529].includes(Number(st));
};
const KEY_STOP = new Set(['with', 'and', 'the', 'for', 'from', 'on', 'in', 'of', 'at', 'a', 'an', 'to', 'person', 'people', 'woman', 'man', 'hand', 'hands', 'holding', 'using', 'happy', 'smiling', 'home', 'care', 'product', 'products', 'photo', 'image', 'background', 'closeup', 'close', 'row', 'colorful', 'bottle', 'bottles']);
const stemW = (w: string) => w.replace(/(ies)$/, 'y').replace(/(ing)$/, '').replace(/(es|s)$/, '');
function byTags(query: string, cands: Hit[]) {
  const keys = [...new Set(query.toLowerCase().split(/[^a-z]+/).filter((w) => w.length > 2 && !KEY_STOP.has(w)).map(stemW))];
  if (!keys.length) return { pick: 0, hit: null as Hit | null, retry: null };
  const need = Math.min(2, keys.length);
  let best = -1, bestScore = 0;
  cands.forEach((h, i) => {
    const tags = String(h.tags ?? '').toLowerCase().split(/[^a-z]+/).filter(Boolean).map(stemW);
    const score = keys.filter((k) => tags.some((t) => t === k || (t.length > 3 && k.startsWith(t)) || (k.length > 3 && t.startsWith(k)))).length;
    if (score >= need && score > bestScore) { best = i; bestScore = score; }
  });
  return best >= 0 ? { pick: best + 1, hit: cands[best], retry: null } : { pick: 0, hit: null as Hit | null, retry: null };
}
const queryText = (p: PickIn) => {
  const ap = String(p.art_photo ?? '').trim();
  return ['loja', 'equipe'].includes(ap.toLowerCase()) ? p.headline : ap || p.headline;
};

/** Claude olha as candidatas e escolhe. Devolve o índice (0 = nenhuma serve) e, se nenhuma servir, uma busca melhor. */
async function judge(segment: string, p: PickIn, cands: Hit[], product: boolean, lessons = '', query?: string) {
  if (visionDown) return product ? { pick: 0, hit: null as Hit | null, retry: null } : byTags(query ?? queryText(p), cands);
  // baixa as miniaturas aqui e manda os bytes (o Claude não consegue abrir o link de alguns bancos de fotos;
  // antes, quando isso falhava, ficava a primeira foto da busca, mesmo sem nada a ver)
  const imgs = await Promise.all(cands.map(async (h) => {
    try {
      const r = await fetch(h.thumb ?? h.url, { signal: AbortSignal.timeout(8000) });
      if (!r.ok) return null;
      const b = new Uint8Array(await r.arrayBuffer());
      const mime = b.length < 4_500_000 ? imageMime(b) : null;
      return mime ? { type: 'image', source: { type: 'base64', media_type: mime, data: Buffer.from(b).toString('base64') } } : null;
    } catch { return null; }
  }));
  const okIdx = imgs.map((x, i) => (x ? i : -1)).filter((i) => i >= 0);
  if (!okIdx.length) return { pick: 0, hit: null as Hit | null, retry: null };
  cands = okIdx.map((i) => cands[i]);
  const content: any[] = okIdx.map((i) => imgs[i]);
  content.push({
    type: 'text',
    text: `Post de Instagram de ${segment}.\nTítulo: "${p.headline}"\nLegenda: "${String(p.caption ?? '').slice(0, 400)}"\n\n` +
      `As ${cands.length} imagens acima são candidatas à foto da arte (numeradas de 1 a ${cands.length}, na ordem).\n` +
      (product
        ? 'O post fala de um produto: a foto boa mostra a EMBALAGEM do produto, nítida, inteira, sem marca d\'água, sem montagem feia e sem texto de outra loja por cima.\n'
        : 'A foto boa mostra claramente o assunto da legenda (o produto, a pessoa usando o produto ou a cena), é bonita, profissional, sem marca d\'água e combina com o ramo da empresa.\n' +
          'Seja exigente: se nenhuma mostra CLARAMENTE o assunto, responda 0 e sugira uma busca melhor. Paisagem (céu, lua, praia, deserto, estrada), ' +
          'caminhão, pessoa triste ou irritada, pose de moda ou de maquiagem quando o assunto é outro, objeto aleatório: sempre 0. ' +
          'Post sobre horário, loja aberta, entrega ou atendimento só aceita foto de balcão/interior de loja do ramo, atendente sorrindo ou entregador de moto com bag.\n') +
      (lessons ? lessons + '\n' : '') +
      'Nunca escolha: bebida alcoólica, bar, cigarro, foto escura, borrada, sem relação, com texto grande ou com logotipo de outra empresa.\n' +
      'Sua resposta inteira é UM objeto JSON, sem nenhum texto antes ou depois: {"escolha": número da melhor (0 se nenhuma serve), "nova_busca": "se 0, uma busca melhor em inglês de 2 a 5 palavras"}',
  });
  try {
    const res = await anthropic.messages.create({ model: MODEL, max_tokens: 1500, messages: [{ role: 'user', content }] });
    const text = res.content.filter((c) => c.type === 'text').map((c) => (c as { text: string }).text).join('');
    const m = text.match(/\{[^{}]*"escolha"[^{}]*\}/);
    if (!m) throw new Error(`resposta sem JSON: ${text.slice(0, 200)}`);
    const j = JSON.parse(m[0]) as { escolha?: number; nova_busca?: string };
    const n = Math.max(0, Math.min(cands.length, Number(j.escolha) || 0));
    return { pick: n, hit: n ? cands[n - 1] : null, retry: j.nova_busca ? String(j.nova_busca) : null };
  } catch (e) {
    console.error('[pick] o Claude não conseguiu olhar as fotos', e instanceof Error ? e.message : e);
    if (outage(e)) { visionDown = true; return product ? { pick: 0, hit: null, retry: null } : byTags(query ?? queryText(p), cands); }
    return { pick: 0, hit: null, retry: null }; // sem olhar, não escolhe nada (melhor foto própria da loja do que foto sem relação)
  }
}

/** onPick grava cada escolha assim que sai (se a Vercel cortar por tempo, o que já foi escolhido fica salvo). */
export async function pickWithVision(company: any, posts: PickIn[], onPick?: (i: number, out: PickOut) => Promise<void>): Promise<PickOut[]> {
  visionDown = false; // cada rodada testa de novo (o crédito pode ter voltado)
  const seg = toSegment(company.segment);
  const reserve = RESERVE[seg] ?? RESERVE.outro;
  const banned = bannedWords(company.forbidden);
  const segName = company.segment ? String(company.segment) : 'pequena empresa';
  const [own, lessons, brandRows] = await Promise.all([
    photosBySubject(company.id, posts), photoLessons(company.id),
    supabaseAdmin().from('company_assets').select('id, storage_path').eq('company_id', company.id).in('kind', ['loja', 'equipe']).then((r) => r.data ?? []),
  ]);
  let bi = 0;
  const brandPhoto = () => (brandRows.length ? brandRows[bi++ % brandRows.length].id as string : null);
  const { data: used } = await supabaseAdmin().from('posts').select('stock_photo_url').eq('company_id', company.id)
    .not('stock_photo_url', 'is', null).not('id', 'in', `(${posts.map((p) => p.id).join(',') || '00000000-0000-0000-0000-000000000000'})`).limit(300);
  const seen = new Set((used ?? []).map((u) => String(u.stock_photo_url).split('/').pop()!.replace(/\.\w+$/, '')));

  const specPhoto = (company.template_spec?.layouts ?? []).filter((l: string) => NEEDS_PHOTO.includes(l) && !['produto-flutuante', 'faixa-preco'].includes(l));
  const photoPool = specPhoto.length ? specPhoto : ['foto-faixa', 'foto-cheia', 'diagonal'];
  let k = 0;
  const out: PickOut[] = posts.map((p) => ({ layout: p.layout, asset_id: null, stock_photo_url: null, bg_photo_url: null }));

  const queryOf = (p: PickIn) => {
    const ap = String(p.art_photo ?? '').trim(); const low = ap.toLowerCase();
    return low === 'loja' ? reserve.loja : low === 'equipe' ? reserve.equipe : ap || p.headline;
  };
  const fresh = (hs: Hit[], q: string, strict = true) =>
    hs.filter((h) => allowed(h, banned) && (!strict || relevant(h, q)) && !seen.has(h.key)).slice(0, 6);

  // Produtos primeiro e um de cada vez (o Brave grátis aceita ~1 busca por segundo); o resto em paralelo
  const order = posts.map((_, i) => i);
  const productIdx = order.filter((i) => (posts[i].product_image_url || (!own[i] && posts[i].art_product && productSearchEnabled())) && !posts[i].date_label);
  const restIdx = order.filter((i) => !productIdx.includes(i));

  const tries = new Map<number, number>();
  const choose = async (i: number, cands: Hit[], product: boolean, q?: string): Promise<string | null> => {
    if (!cands.length) return null;
    const { pick, hit: chosen, retry } = await judge(segName, posts[i], cands, product, lessons, q);
    if (pick > 0 && chosen) {
      const hit = chosen;
      seen.add(hit.key);
      // embalagem: precisa ter pelo menos 500 px (miniatura fica borrada); foto de cena pode usar a miniatura se a original bloquear
      if (product) {
        // só a embalagem que o Claude escolheu (pegar outra da lista sem olhar trazia produto errado);
        // se o site dela bloquear o download, o Claude escolhe de novo entre as que sobraram
        const ok = await saveCopy(company.id, hit, 500, true);
        if (ok) return ok;
        const rest = cands.filter((c) => c !== hit && c.url !== hit.url);
        const t = (tries.get(i) ?? 0) + 1;
        tries.set(i, t);
        return rest.length && t <= 2 ? choose(i, rest, true, q) : null;
      }
      return (await saveCopy(company.id, hit)) ?? (hit.thumb && hit.thumb !== hit.url ? await saveCopy(company.id, { ...hit, key: hit.key + 't', url: hit.thumb }) : null);
    }
    if (retry && !product && stockEnabled()) {
      const again = fresh(await searchStock(retry, 30), retry);
      if (again.length) {
        const r2 = await judge(segName, posts[i], again, false, lessons);
        if (r2.pick > 0 && r2.hit) { const hit = r2.hit; seen.add(hit.key); return saveCopy(company.id, hit); }
      }
    }
    return null;
  };

  const save = async (i: number, o: PickOut) => { out[i] = o; if (onPick) await onPick(i, o).catch(() => {}); };

  // foto de cena (pessoa usando, situação) escolhida pelo Claude
  const scene = async (i: number) => {
    if (!stockEnabled()) return null;
    const q = queryOf(posts[i]);
    return choose(i, fresh(await searchStock(q, 30), q), false, q);
  };

  const stockPick = async (i: number) => {
    const p = posts[i];
    if (own[i]) { await save(i, { layout: TEXT_ONLY.includes(p.layout) ? photoPool[k++ % photoPool.length] : p.layout, asset_id: own[i], stock_photo_url: null }); return; }
    if (!stockEnabled()) return;
    const q = queryOf(p);
    const path = await choose(i, fresh(await searchStock(q, 30), q), false, q);
    if (!path) {
      // nenhuma foto de banco serviu: usa uma foto real da loja/equipe (nunca uma foto sem relação)
      const b = brandPhoto();
      if (b) await save(i, { layout: TEXT_ONLY.includes(p.layout) || p.layout === 'produto-flutuante' ? photoPool[k++ % photoPool.length] : p.layout, asset_id: b, stock_photo_url: null, bg_photo_url: null });
      return;
    }
    let layout = p.layout;
    if (p.date_label) { if (!NEEDS_PHOTO.includes(layout)) layout = 'data-festiva'; }
    else if (TEXT_ONLY.includes(layout) || layout === 'produto-flutuante') layout = photoPool[k++ % photoPool.length];
    await save(i, { layout, asset_id: null, stock_photo_url: path });
  };

  // Produtos (embalagem) e fotos de banco andam AO MESMO TEMPO; as buscas do Brave já entram em fila de 1 por segundo
  await Promise.all([
    runLimited(productIdx, 2, async (i) => {
      const p = posts[i];
      // embalagem (site da empresa primeiro) + foto de cena atrás: nunca fundo liso
      const manual = p.product_image_url
        ? await saveCopy(company.id, { key: 'prod-' + Buffer.from(p.product_image_url).toString('base64url').slice(-16), url: p.product_image_url }, 300, true)
        : null;
      const cands = manual ? [] : fresh(await productImages(p.art_product!, company.site_url), '', false);
      // com fotos reais da loja, a prateleira da própria drogaria vai atrás da embalagem (mais humano que foto de banco)
      const shelfFirst = brandRows.length ? brandRows[bi++ % brandRows.length].storage_path as string | null : null;
      const [path, bg] = await Promise.all([manual ? Promise.resolve(manual) : choose(i, cands, true), scene(i).then((s) => s ?? shelfFirst)]);
      if (path && bg) await save(i, { layout: 'produto-flutuante', asset_id: null, stock_photo_url: path, bg_photo_url: bg });
      // sem embalagem: NÃO usa a prateleira como foto do post (era o "mesma foto em tudo"); vai para foto do assunto
      else if (!path) await stockPick(i);
      else if (path) {
        // embalagem achada mas nenhuma cena boa: a foto real da loja vai atrás da embalagem
        const shelf = brandRows.length ? brandRows[bi++ % brandRows.length].storage_path as string | null : null;
        await save(i, { layout: 'produto-flutuante', asset_id: null, stock_photo_url: path, bg_photo_url: shelf ?? null });
      }
    }),
    runLimited(restIdx, 5, stockPick),
  ]);
  return out;
}
