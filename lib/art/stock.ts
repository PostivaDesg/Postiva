// Fotos de banco gratuito para quando a empresa não tem foto própria que sirva.
// Pixabay (PIXABAY_API_KEY, chave grátis na hora) ou Pexels (PEXELS_API_KEY). Os dois liberam uso comercial sem atribuição.
// Regra do Pixabay: não usar o link deles direto. Por isso a foto escolhida é COPIADA para o armazenamento
// da empresa (bucket "marcas", pasta banco/) e a arte lê dali. As buscas ficam em cache por 24h.
// Sem nenhuma das chaves, nada muda: o site usa só as fotos da empresa e os layouts de texto.
import { supabaseAdmin } from '../supabase';

type Hit = { key: string; url: string }; // key: "pixabay-123" / "pexels-456" (para não repetir)

export const stockEnabled = () => !!(process.env.PIXABAY_API_KEY || process.env.PEXELS_API_KEY);

async function pixabay(query: string, perPage: number): Promise<Hit[]> {
  const u = new URL('https://pixabay.com/api/');
  u.searchParams.set('key', process.env.PIXABAY_API_KEY!);
  u.searchParams.set('q', query.slice(0, 100));
  u.searchParams.set('image_type', 'photo');
  u.searchParams.set('orientation', 'vertical');
  u.searchParams.set('safesearch', 'true');
  u.searchParams.set('per_page', String(Math.max(3, Math.min(50, perPage))));
  const r = await fetch(u, { next: { revalidate: 86400 } }); // cache de 24h exigido pelo Pixabay
  if (!r.ok) return [];
  const j = (await r.json()) as { hits?: { id: number; largeImageURL: string; webformatURL: string }[] };
  return (j.hits ?? []).map((h) => ({ key: `pixabay-${h.id}`, url: h.largeImageURL || h.webformatURL }));
}

async function pexels(query: string, perPage: number): Promise<Hit[]> {
  const u = new URL('https://api.pexels.com/v1/search');
  u.searchParams.set('query', query.slice(0, 80));
  u.searchParams.set('orientation', 'portrait');
  u.searchParams.set('per_page', String(perPage));
  const r = await fetch(u, { headers: { Authorization: process.env.PEXELS_API_KEY! }, next: { revalidate: 86400 } });
  if (!r.ok) return [];
  const j = (await r.json()) as { photos?: { id: number; src: { portrait: string; large: string } }[] };
  return (j.photos ?? []).map((p) => ({ key: `pexels-${p.id}`, url: p.src.portrait || p.src.large }));
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
async function saveCopy(companyId: string, hit: Hit) {
  try {
    const r = await fetch(hit.url);
    if (!r.ok) return null;
    const type = r.headers.get('content-type') ?? 'image/jpeg';
    if (!type.startsWith('image/')) return null;
    const path = `${companyId}/banco/${hit.key}.${type.includes('png') ? 'png' : 'jpg'}`;
    const { error } = await supabaseAdmin().storage.from('marcas').upload(path, await r.arrayBuffer(), { contentType: type, upsert: true });
    return error ? null : path;
  } catch {
    return null;
  }
}

/** Uma foto por pedido, sem repetir as que a empresa já usou (nem dentro do mesmo lote). */
export async function pickStockPhotos(companyId: string, queries: (string | null | undefined)[]) {
  const out: (string | null)[] = queries.map(() => null);
  if (!stockEnabled() || !queries.some((q) => q?.trim())) return out;
  const { data: used } = await supabaseAdmin().from('posts').select('stock_photo_url')
    .eq('company_id', companyId).not('stock_photo_url', 'is', null).order('created_at', { ascending: false }).limit(300);
  const keyOf = (s: string) => s.split('/').pop()!.replace(/\.\w+$/, '');
  const seen = new Set((used ?? []).map((u) => keyOf(u.stock_photo_url as string)));
  const cache = new Map<string, Hit[]>();
  for (let i = 0; i < queries.length; i++) {
    const q = queries[i]?.trim().toLowerCase();
    if (!q) continue;
    if (!cache.has(q)) cache.set(q, await searchStock(q, 20));
    for (const hit of cache.get(q)!) {
      if (seen.has(hit.key)) continue;
      seen.add(hit.key);
      const path = await saveCopy(companyId, hit);
      if (path) { out[i] = path; break; }
    }
  }
  return out;
}

/** Foto de banco gravada no post → data URL para a arte. */
export async function stockDataUrl(pathOrUrl: string | null | undefined) {
  if (!pathOrUrl) return null;
  if (/^https?:\/\//.test(pathOrUrl)) return pathOrUrl; // posts antigos
  try {
    const { data } = await supabaseAdmin().storage.from('marcas').download(pathOrUrl);
    if (!data) return null;
    return `data:${data.type || 'image/jpeg'};base64,${Buffer.from(await data.arrayBuffer()).toString('base64')}`;
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
    { headline: 'Cuidado que o bebê sente', sub: 'Fraldas e lenços para o dia a dia', query: 'baby care diaper' },
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
