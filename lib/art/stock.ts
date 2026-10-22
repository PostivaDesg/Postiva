// Fotos de banco gratuito (Pexels) para quando a empresa não tem foto própria que sirva.
// Grátis e sem atribuição obrigatória: https://www.pexels.com/license/
// Sem PEXELS_API_KEY, nada muda: o site usa só as fotos da empresa e os layouts de texto.
import { supabaseAdmin } from '../supabase';

type PexelsPhoto = { id: number; src: { portrait: string; large2x: string; large: string }; alt?: string };

export const stockEnabled = () => !!process.env.PEXELS_API_KEY;

/** Busca fotos para o tema; retorna URLs prontas para a arte (retrato, 800x1200). */
export async function searchStock(query: string, perPage = 15): Promise<{ id: number; url: string }[]> {
  if (!stockEnabled() || !query.trim()) return [];
  try {
    const u = new URL('https://api.pexels.com/v1/search');
    u.searchParams.set('query', query.slice(0, 80));
    u.searchParams.set('orientation', 'portrait');
    u.searchParams.set('per_page', String(perPage));
    const r = await fetch(u, { headers: { Authorization: process.env.PEXELS_API_KEY! }, cache: 'no-store' });
    if (!r.ok) return [];
    const j = (await r.json()) as { photos?: PexelsPhoto[] };
    return (j.photos ?? []).map((p) => ({ id: p.id, url: p.src.portrait || p.src.large }));
  } catch {
    return [];
  }
}

/** Uma foto por pedido, sem repetir as que a empresa já usou (nem dentro do mesmo lote). */
export async function pickStockPhotos(companyId: string, queries: (string | null | undefined)[]) {
  const out: (string | null)[] = queries.map(() => null);
  if (!stockEnabled()) return out;
  const { data: used } = await supabaseAdmin().from('posts').select('stock_photo_url')
    .eq('company_id', companyId).not('stock_photo_url', 'is', null).order('created_at', { ascending: false }).limit(300);
  const seen = new Set((used ?? []).map((u) => u.stock_photo_url as string));
  const cache = new Map<string, { id: number; url: string }[]>();
  for (let i = 0; i < queries.length; i++) {
    const q = queries[i]?.trim().toLowerCase();
    if (!q) continue;
    if (!cache.has(q)) cache.set(q, await searchStock(q));
    const hit = cache.get(q)!.find((p) => !seen.has(p.url));
    if (hit) { out[i] = hit.url; seen.add(hit.url); }
  }
  return out;
}

/** Temas de foto padrão por segmento (para a prévia do modelo quando a empresa ainda não tem fotos). */
export const SAMPLE_QUERIES: Record<string, string[]> = {
  farmacia: ['pharmacist smiling customer', 'colorful fruit smoothie healthy', 'woman skincare routine', 'family health happy'],
  estetica: ['facial skincare treatment', 'woman relaxing spa', 'beauty clinic', 'healthy glowing skin'],
  alimentacao: ['delicious food table', 'burger fries', 'fresh salad bowl', 'friends eating restaurant'],
  moda: ['fashion woman street style', 'clothing store', 'outfit flat lay', 'shopping bags'],
  servicos: ['team working office', 'customer service smiling', 'handshake business', 'professional at work'],
  outro: ['happy customer store', 'small business owner', 'city street shopping', 'people smiling'],
};
