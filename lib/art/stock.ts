// Fotos de banco gratuito para quando a empresa não tem foto própria que sirva.
// Pixabay (PIXABAY_API_KEY, chave grátis na hora) ou Pexels (PEXELS_API_KEY). Os dois liberam uso comercial sem atribuição.
// Regra do Pixabay: não usar o link deles direto. Por isso a foto escolhida é COPIADA para o armazenamento
// da empresa (bucket "marcas", pasta banco/) e a arte lê dali. As buscas ficam em cache por 24h.
// Sem nenhuma das chaves, nada muda: o site usa só as fotos da empresa e os layouts de texto.
import { supabaseAdmin } from '../supabase';
import { imageMime, toArtDataUrl, MAX_ART_IMAGE } from './image-bytes';

export type Hit = { key: string; url: string; tags?: string; thumb?: string }; // key: "pixabay-123" / "pexels-456" (para não repetir)

// Nunca entra em arte nenhuma (as fotos de banco vêm com etiquetas; a foto é descartada se tiver uma destas)
const BANNED = ['alcohol', 'alcoholic', 'beer', 'wine', 'whisky', 'whiskey', 'vodka', 'liquor', 'cocktail', 'bar', 'pub', 'drunk',
  'cigarette', 'smoking', 'smoke', 'tobacco', 'vape', 'gun', 'weapon', 'drugs', 'marijuana', 'cannabis', 'casino', 'gambling',
  'lingerie', 'bikini', 'sexy', 'blood', 'death', 'skull', 'cerveja', 'vinho', 'bebida alcoolica', 'cigarro'];

/** Palavras proibidas: as fixas + as que a empresa escreveu em "o que nunca postar" (separadas por vírgula). */
export function bannedWords(extra?: string | null) {
  const own = String(extra ?? '').toLowerCase().split(/[,;\n]/).map((w) => w.trim()).filter((w) => w && w.length <= 30);
  return [...BANNED, ...own];
}
const STOP = new Set(['with', 'and', 'the', 'for', 'from', 'on', 'in', 'of', 'at', 'a', 'an', 'to', 'person', 'people', 'woman', 'man', 'hand', 'hands', 'holding', 'using', 'happy', 'smiling', 'home', 'care', 'product', 'products', 'photo', 'image', 'background']);
const stem = (w: string) => w.replace(/(ies)$/, 'y').replace(/(es|s)$/, '');
/** A foto tem nas etiquetas alguma palavra-chave do tema? (sem etiquetas, aceita) */
export function relevant(h: Hit, query: string) {
  if (!h.tags) return true;
  const keys = query.toLowerCase().split(/[^a-z]+/).filter((w) => w.length > 2 && !STOP.has(w)).map(stem);
  if (!keys.length) return true;
  const tags = h.tags.toLowerCase().split(/[^a-z]+/).filter(Boolean).map(stem);
  return keys.some((k) => tags.some((t) => t === k || t.startsWith(k) || k.startsWith(t) && t.length > 3));
}
export const allowed = (h: Hit, banned: string[]) => {
  const t = ` ${(h.tags ?? '').toLowerCase().replace(/[^a-z0-9à-ú]+/g, ' ')} `;
  return !banned.some((w) => t.includes(` ${w} `));
};

export const stockEnabled = () => !!(process.env.PIXABAY_API_KEY || process.env.PEXELS_API_KEY);

async function pixabay(query: string, perPage: number): Promise<Hit[]> {
  const u = new URL('https://pixabay.com/api/');
  u.searchParams.set('key', process.env.PIXABAY_API_KEY!);
  u.searchParams.set('q', query.slice(0, 100));
  u.searchParams.set('image_type', 'photo');
  u.searchParams.set('orientation', 'vertical');
  u.searchParams.set('safesearch', 'true');
  u.searchParams.set('per_page', String(Math.max(3, Math.min(50, perPage))));
  const r = await fetch(u, { next: { revalidate: 86400 }, signal: AbortSignal.timeout(12000) }).catch(() => null); // cache de 24h exigido pelo Pixabay
  if (!r?.ok) return [];
  const j = (await r.json()) as { hits?: { id: number; largeImageURL: string; webformatURL: string; tags?: string }[] };
  return (j.hits ?? []).map((h) => ({ key: `pixabay-${h.id}`, url: h.largeImageURL || h.webformatURL, tags: h.tags, thumb: h.webformatURL }));
}

async function pexels(query: string, perPage: number): Promise<Hit[]> {
  const u = new URL('https://api.pexels.com/v1/search');
  u.searchParams.set('query', query.slice(0, 80));
  u.searchParams.set('orientation', 'portrait');
  u.searchParams.set('per_page', String(perPage));
  const r = await fetch(u, { headers: { Authorization: process.env.PEXELS_API_KEY! }, next: { revalidate: 86400 } });
  if (!r.ok) return [];
  const j = (await r.json()) as { photos?: { id: number; alt?: string; src: { portrait: string; large: string } }[] };
  return (j.photos ?? []).map((p) => ({ key: `pexels-${p.id}`, url: p.src.portrait || p.src.large, tags: p.alt, thumb: p.src.portrait }));
}

/** Busca fotos para o tema (links temporários: servem para a prévia; para os posts use pickStockPhotos). */
export async function searchStock(query: string, perPage = 15): Promise<Hit[]> {
  if (!stockEnabled() || !query.trim()) return [];
  try {
    if (process.env.PIXABAY_API_KEY) {
      const hits = await pixabay(query, perPage);
      if (hits.length || !process.env.PEXELS_API_KEY) return hits;
    }
    return await pexels(query, perPage);
  } catch {
    return [];
  }
}

/** Copia a foto para o armazenamento da empresa e devolve o caminho ("banco/..."). */
export async function saveCopy(companyId: string, hit: Hit) {
  try {
    const r = await fetch(hit.url, { signal: AbortSignal.timeout(15000) });
    if (!r.ok) return null;
    const bytes = new Uint8Array(await r.arrayBuffer());
    // só JPG e PNG (pelos bytes, não pelo cabeçalho) e até 6 MB: o gerador de artes não lê WEBP/AVIF
    const mime = bytes.length <= MAX_ART_IMAGE ? imageMime(bytes) : null;
    if (!mime) return null;
    const path = `${companyId}/banco/${hit.key}.${mime === 'image/png' ? 'png' : 'jpg'}`;
    const { error } = await supabaseAdmin().storage.from('marcas').upload(path, bytes, { contentType: mime, upsert: true });
    return error ? null : path;
  } catch {
    return null;
  }
}

/** Uma foto por pedido, sem repetir as que a empresa já usou (nem dentro do mesmo lote). */
export async function pickStockPhotos(companyId: string, queries: (string | null | undefined)[], banned: string[] = bannedWords()) {
  const out: (string | null)[] = queries.map(() => null);
  if (!stockEnabled() || !queries.some((q) => q?.trim())) return out;
  const { data: used } = await supabaseAdmin().from('posts').select('stock_photo_url')
    .eq('company_id', companyId).not('stock_photo_url', 'is', null).order('created_at', { ascending: false }).limit(300);
  const keyOf = (s: string) => s.split('/').pop()!.replace(/\.\w+$/, '');
  const seen = new Set((used ?? []).map((u) => keyOf(u.stock_photo_url as string)));
  // Agrupa por tema e processa vários temas ao mesmo tempo (a semana inteira cabe no tempo da Vercel)
  const groups = new Map<string, number[]>();
  queries.forEach((raw, i) => { const q = raw?.trim().toLowerCase(); if (q) groups.set(q, [...(groups.get(q) ?? []), i]); });
  await runLimited([...groups.entries()], 6, async ([q, idxs]) => {
    // relevância: a foto precisa ter nas etiquetas pelo menos uma palavra principal do tema (evita sapato em post de hidratante)
    const hits = (await searchStock(q, 40)).filter((h) => allowed(h, banned) && relevant(h, q));
    for (const i of idxs) {
      for (const hit of hits) {
        if (seen.has(hit.key)) continue;
        seen.add(hit.key);
        const path = await saveCopy(companyId, hit);
        if (path) { out[i] = path; break; }
      }
    }
  });
  return out;
}

export async function runLimited<T>(items: T[], limit: number, fn: (x: T) => Promise<void>) {
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) { const it = items[next++]; await fn(it).catch(() => {}); }
  }));
}

// ---------- Foto de produto achada na internet (busca de imagens do Brave, parecida com o Google Imagens) ----------
// A API de busca do Google fechou para novos clientes (e acaba em 1/1/2027). O Brave tem busca de imagens com crédito
// grátis mensal. Usado só quando a peça fala de um produto e a empresa não enviou a foto dele.
export const productSearchEnabled = () => !!process.env.BRAVE_API_KEY;

let braveNext = 0;
/** O plano grátis do Brave aceita ~1 busca por segundo: as buscas entram em fila com 1,1 s entre elas. */
async function braveSlot() {
  const now = Date.now();
  const wait = Math.max(0, braveNext - now);
  braveNext = Math.max(now, braveNext) + 1100;
  if (wait) await new Promise((r) => setTimeout(r, wait));
}

export async function braveImages(query: string): Promise<Hit[]> {
  await braveSlot();
  const u = new URL('https://api.search.brave.com/res/v1/images/search');
  u.searchParams.set('q', query.slice(0, 120));
  u.searchParams.set('country', 'BR');
  u.searchParams.set('search_lang', 'pt-br');
  u.searchParams.set('count', '20');
  u.searchParams.set('safesearch', 'strict');
  const r = await fetch(u, { headers: { 'X-Subscription-Token': process.env.BRAVE_API_KEY!, Accept: 'application/json' }, next: { revalidate: 86400 }, signal: AbortSignal.timeout(12000) }).catch(() => null);
  if (!r?.ok) return [];
  const j = (await r.json()) as { results?: { title?: string; url?: string; properties?: { url?: string; width?: number; height?: number }; thumbnail?: { src?: string } }[] };
  const out: Hit[] = [];
  for (const it of j.results ?? []) {
    const src = it.properties?.url;
    const w = it.properties?.width ?? 0, h = it.properties?.height ?? 0;
    if (!src || (w && w < 400) || (h && h < 400)) continue;
    const key = 'web-' + [...src].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7).toString(36);
    out.push({ key, url: src, tags: it.title, thumb: it.thumbnail?.src ?? src });
    if (it.thumbnail?.src) out.push({ key: key + 't', url: it.thumbnail.src, tags: it.title, thumb: it.thumbnail.src }); // se a original bloquear, a miniatura serve
  }
  return out;
}

/** Domínio do site da empresa (para buscar a foto do produto primeiro no site dela). */
export function siteHost(url?: string | null) {
  try { return url ? new URL(url).hostname.replace(/^www\./, '') : null; } catch { return null; }
}

/** Fotos do produto: primeiro as do site da própria empresa, depois as da internet. */
export async function productImages(name: string, site?: string | null) {
  const host = siteHost(site);
  const own = host ? await braveImages(`site:${host} ${name}`) : [];
  const web = await braveImages(`${name} embalagem produto`);
  return [...own, ...web];
}

/** Foto real do produto (embalagem) para cada nome; copia para o armazenamento da empresa. */
export async function pickProductPhotos(companyId: string, names: (string | null | undefined)[], banned: string[] = bannedWords(), site?: string | null) {
  const out: (string | null)[] = names.map(() => null);
  if (!productSearchEnabled()) return out;
  await runLimited(names.map((n, i) => [n, i] as const), 1, // o plano grátis do Brave aceita ~1 busca por segundo
    async ([n, i]) => {
    const q = n?.trim();
    if (!q) return;
    for (const hit of (await productImages(q, site)).filter((h) => allowed(h, banned)).slice(0, 10)) {
      const path = await saveCopy(companyId, hit);
      if (path) { out[i] = path; break; }
    }
  });
  return out;
}

/** Foto de banco gravada no post → data URL para a arte. */
export async function stockDataUrl(pathOrUrl: string | null | undefined) {
  if (!pathOrUrl) return null;
  if (/^https?:\/\//.test(pathOrUrl)) return pathOrUrl; // posts antigos
  try {
    const { data } = await supabaseAdmin().storage.from('marcas').download(pathOrUrl);
    return data ? toArtDataUrl(await data.arrayBuffer()) : null;
  } catch {
    return null;
  }
}

/** Exemplos para a prévia do modelo (título + foto que combinam), por segmento. */
type Sample = { headline: string; sub: string; query: string };
export const SAMPLE_POSTS: Record<string, Sample[]> = {
  farmacia: [
    { headline: 'Comece o dia com energia', sub: 'Vitamina C para a imunidade de toda a família', query: 'vitamin c orange tablets' },
    { headline: 'Sol forte pede proteção', sub: 'Protetor solar para o rosto e para o corpo', query: 'sunscreen beach' },
    { headline: 'Cuidado que o bebê sente', sub: 'Fraldas e lenços para o dia a dia', query: 'happy baby diaper' },
    { headline: 'Pele bonita todo dia', sub: 'Dermocosméticos para cada tipo de pele', query: 'woman skincare cream' },
  ],
  estetica: [
    { headline: 'Sua pele merece uma pausa', sub: 'Limpeza de pele profunda', query: 'facial skincare treatment' },
    { headline: 'Agenda aberta para novembro', sub: 'Garanta seu horário', query: 'woman relaxing spa' },
  ],
  alimentacao: [
    { headline: 'Hoje é dia de pedir', sub: 'Entrega rápida na sua casa', query: 'burger fries' },
    { headline: 'Feito na hora', sub: 'Ingredientes frescos todo dia', query: 'fresh food table' },
  ],
  moda: [
    { headline: 'Chegou coleção nova', sub: 'Peças para o verão', query: 'fashion woman summer' },
    { headline: 'Look pronto para o fim de semana', sub: 'Venha provar', query: 'clothing store' },
  ],
  servicos: [
    { headline: 'Resolvido no mesmo dia', sub: 'Atendimento rápido e de confiança', query: 'professional at work' },
    { headline: 'Fale com a gente', sub: 'Orçamento sem compromisso', query: 'customer service smiling' },
  ],
  outro: [
    { headline: 'Novidade por aqui', sub: 'Venha conhecer', query: 'happy customer store' },
    { headline: 'Atendimento de perto', sub: 'Do jeito que você gosta', query: 'small business owner' },
  ],
};
