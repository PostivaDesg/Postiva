// Identificação de produtos para promoções.
//  - fromSite: lê a página do produto ou da categoria no site da própria empresa.
//  - fromEan:  busca nome, foto, marca e NCM no Cosmos (Bluesoft) pelo código de barras.
import Anthropic from '@anthropic-ai/sdk';

export interface Product {
  name: string;
  ean?: string | null;
  brand?: string | null;
  ncm?: string | null;
  photoUrl?: string | null;
  productUrl?: string | null;
  sitePrice?: number | null;
  isMedicine: boolean;
}

/** NCM 3003 e 3004 = medicamentos. Esses ficam travados até o cliente confirmar venda livre. */
export function isMedicineNcm(ncm?: string | null) {
  const n = (ncm ?? '').replace(/\D/g, '');
  return n.startsWith('3003') || n.startsWith('3004');
}

/** Converte "R$ 1.234,56", "1234.56" ou 1234.56 em número. */
export function parsePrice(v: unknown): number | null {
  if (typeof v === 'number') return Number.isFinite(v) && v > 0 ? v : null;
  if (typeof v !== 'string') return null;
  let s = v.replace(/[^\d,.-]/g, '');
  if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
  else if (/^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, ''); // "1.234" = mil duzentos e trinta e quatro
  const n = Number(s);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** EAN-8/12/13/14 com dígito verificador válido. */
export function isValidEan(code: string) {
  const d = code.replace(/\D/g, '');
  if (![8, 12, 13, 14].includes(d.length)) return false;
  const digits = d.split('').map(Number);
  const check = digits.pop()!;
  const sum = digits.reverse().reduce((s, n, i) => s + n * (i % 2 === 0 ? 3 : 1), 0);
  return (10 - (sum % 10)) % 10 === check;
}

// ---------- Cosmos (Bluesoft) ----------
// Token em https://cosmos.bluesoft.com.br (área do desenvolvedor). Confira os termos de uso das imagens
// e o limite de consultas do seu plano antes de lançar.
export async function fromEan(ean: string): Promise<Product | null> {
  const code = ean.replace(/\D/g, '');
  const res = await fetch(`https://api.cosmos.bluesoft.com.br/gtins/${code}.json`, {
    headers: {
      'X-Cosmos-Token': process.env.COSMOS_TOKEN!,
      'User-Agent': 'Postiva Design (contato@postivadesign.com.br)',
      'Content-Type': 'application/json',
    },
    next: { revalidate: 60 * 60 * 24 * 30 }, // o mesmo EAN não é consultado de novo por 30 dias
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Cosmos ${code}: ${res.status}`);
  const j = await res.json() as {
    description?: string; thumbnail?: string; brand?: { name?: string }; ncm?: { code?: string };
  };
  return {
    name: j.description ?? '',
    ean: code,
    brand: j.brand?.name ?? null,
    ncm: j.ncm?.code ?? null,
    photoUrl: j.thumbnail ?? null,
    isMedicine: isMedicineNcm(j.ncm?.code),
  };
}

// ---------- Site da empresa ----------
/** Só aceita links do domínio cadastrado da empresa (evita usar o servidor para abrir sites alheios). */
export function assertSameSite(url: string, siteUrl: string | null) {
  if (!siteUrl) throw new Error('Cadastre o site da empresa antes de usar este modo.');
  const a = new URL(url), b = new URL(siteUrl);
  const host = (h: string) => h.replace(/^www\./, '');
  if (a.protocol !== 'https:' || host(a.hostname) !== host(b.hostname)) {
    throw new Error(`Use um link do seu site (${b.hostname}).`);
  }
}

export async function fromSite(url: string): Promise<Product[]> {
  const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (Postiva Design)' }, redirect: 'follow' });
  if (!res.ok) throw new Error(`Não consegui abrir o link (${res.status}).`);
  const html = (await res.text()).slice(0, 2_000_000);

  // 1) Dados estruturados (JSON-LD), que a maioria das lojas virtuais (VTEX, Shopify, Nuvemshop…) publica
  const fromLd = productsFromJsonLd(html, url);
  if (fromLd.length) return fromLd.slice(0, 40);

  // 2) Página de um produto só: tags Open Graph
  const og = (p: string) => html.match(new RegExp(`<meta[^>]+property=["']${p}["'][^>]+content=["']([^"']+)`, 'i'))?.[1];
  const ogPrice = og('product:price:amount');
  if (og('og:type')?.includes('product') || ogPrice) {
    return [{ name: decode(og('og:title') ?? ''), photoUrl: abs(og('og:image'), url), productUrl: url, sitePrice: parsePrice(ogPrice), isMedicine: false }];
  }

  // 3) Último recurso: o Claude (Haiku, barato) lê a página e lista os produtos
  return productsWithClaude(html, url);
}

function productsFromJsonLd(html: string, base: string): Product[] {
  const out: Product[] = [];
  const blocks = html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi);
  const visit = (n: any) => {
    if (!n || typeof n !== 'object') return;
    if (Array.isArray(n)) return n.forEach(visit);
    const type = [].concat(n['@type'] ?? []).join(',');
    if (type.includes('Product')) {
      const offer = [].concat(n.offers ?? [])[0] as any;
      const img = [].concat(n.image ?? [])[0] as any;
      out.push({
        name: decode(String(n.name ?? '')),
        ean: n.gtin13 ?? n.gtin ?? n.gtin14 ?? n.gtin8 ?? null,
        brand: typeof n.brand === 'string' ? n.brand : n.brand?.name ?? null,
        photoUrl: abs(typeof img === 'string' ? img : img?.url, base),
        productUrl: abs(n.url ?? offer?.url, base) ?? base,
        sitePrice: ldPrice(offer?.price ?? offer?.lowPrice),
        isMedicine: false,
      });
    }
    if (n.itemListElement) visit([].concat(n.itemListElement).map((e: any) => e.item ?? e));
    if (n['@graph']) visit(n['@graph']);
  };
  for (const b of blocks) {
    try { visit(JSON.parse(b[1])); } catch { /* bloco inválido: ignora */ }
  }
  return out.filter((p) => p.name);
}

async function productsWithClaude(html: string, base: string): Promise<Product[]> {
  const slim = html
    .replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>|<svg[\s\S]*?<\/svg>/gi, '')
    .replace(/\s+/g, ' ')
    .slice(0, 150_000);
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const res = await anthropic.messages.create({
    model: 'claude-haiku-5-5',
    max_tokens: 8000,
    messages: [{
      role: 'user',
      content: `Esta é uma página de loja virtual (${base}). Liste os produtos à venda que aparecem nela.
Use SÓ o que está escrito na página: nome exatamente como aparece, preço exibido, link da imagem e link do produto.
Se algo não estiver na página, use null. Responda só com um array JSON:
[{"name":"","price":"","image":"","url":""}]

${slim}`,
    }],
  });
  const text = res.content.filter((c) => c.type === 'text').map((c) => (c as { text: string }).text).join('');
  const s = text.indexOf('['), e = text.lastIndexOf(']');
  if (s < 0 || e < 0) return [];
  const list = JSON.parse(text.slice(s, e + 1)) as { name: string; price: string | null; image: string | null; url: string | null }[];
  return list.filter((p) => p.name).slice(0, 40).map((p) => ({
    name: p.name, photoUrl: abs(p.image ?? undefined, base), productUrl: abs(p.url ?? undefined, base) ?? base,
    sitePrice: parsePrice(p.price), isMedicine: false,
  }));
}

/** No schema.org o preço usa ponto decimal ("1299.90"); só cai no formato brasileiro se vier com vírgula. */
function ldPrice(v: unknown) {
  if (typeof v === 'string' && /^\d+(\.\d+)?$/.test(v.trim())) return parsePrice(Number(v));
  return parsePrice(v);
}

function abs(u: string | undefined | null, base: string) {
  if (!u) return null;
  try { return new URL(u, base).toString(); } catch { return null; }
}
function decode(s: string) {
  return s.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').trim();
}
