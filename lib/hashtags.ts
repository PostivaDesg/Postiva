// Garante EXATAMENTE 5 hashtags no fim da legenda de posts e reels (stories não levam).
// O Claude já escreve as 5 (2 da marca/cidade + 3 do assunto); aqui só corrige se vier a mais, a menos ou com acento.
const strip = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '');
const clean = (t: string) => '#' + strip(t.replace(/^#/, '')).replace(/[^A-Za-z0-9_]/g, '');

/** Hashtags fixas da empresa (campo "hashtags" da Minha marca) ou nome + cidade. */
export function brandTags(company: { name?: string | null; city?: string | null; hashtags?: string | null }) {
  const fixed = String(company.hashtags ?? '').match(/#?[\p{L}\p{N}_]+/gu)?.map(clean) ?? [];
  if (fixed.length) return fixed;
  const words = (s?: string | null) => clean(String(s ?? '').split('/')[0].split(/\s+/).map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(''));
  return [words(company.name), words(company.city)].filter((t) => t.length > 2);
}

export function withFiveHashtags(kind: string, caption: string, company: { name?: string | null; city?: string | null; hashtags?: string | null }) {
  if (kind === 'story' || !caption) return caption;
  // só o bloco de hashtags do FIM da legenda (hashtag no meio do texto fica onde está)
  const trailing = caption.match(/((?:\s*#[\p{L}\p{N}_]+)+)\s*$/u)?.[1] ?? '';
  const found = (trailing.match(/#[\p{L}\p{N}_]+/gu) ?? []).map(clean);
  const body = caption.slice(0, caption.length - trailing.length).trimEnd();
  const tags: string[] = [];
  const add = (t: string) => { if (t.length > 2 && !tags.some((x) => x.toLowerCase() === t.toLowerCase())) tags.push(t); };
  found.forEach(add);
  for (const t of brandTags(company)) { if (tags.length >= 5) break; add(t); }
  return `${body}\n\n${tags.slice(0, 5).join(' ')}`;
}
