// Fontes das artes. Vêm dos pacotes @fontsource (instalados com o projeto, sem custo e sem chamada externa).
import { readFile } from 'fs/promises';
import path from 'path';

export const FONT_FAMILIES = {
  'Inter': 'inter',
  'Montserrat': 'montserrat',
  'Poppins': 'poppins',
  'Playfair Display': 'playfair-display',
  'DM Serif Display': 'dm-serif-display',
  'Bebas Neue': 'bebas-neue',
  'Caveat': 'caveat',
  'Nunito': 'nunito',
  'Oswald': 'oswald',
  'Lora': 'lora',
  'Archivo Black': 'archivo-black',
  'Space Grotesk': 'space-grotesk',
  'Kaushan Script': 'kaushan-script',
} as const;
export type FontFamily = keyof typeof FONT_FAMILIES;

const cache = new Map<string, ArrayBuffer>();

async function load(slug: string, weight: number): Promise<ArrayBuffer | null> {
  const key = `${slug}-${weight}`;
  if (cache.has(key)) return cache.get(key)!;
  const file = path.join(process.cwd(), 'node_modules', '@fontsource', slug, 'files', `${slug}-latin-${weight}-normal.woff`);
  try {
    const buf = await readFile(file);
    const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer;
    cache.set(key, ab);
    return ab;
  } catch {
    return null; // peso não existe nesta família
  }
}

/** Carrega as fontes de título e de texto nos pesos usados pelos layouts. */
export async function fontsFor(display: FontFamily, body: FontFamily) {
  const out: { name: string; data: ArrayBuffer; weight: 400 | 700; style: 'normal' }[] = [];
  for (const [family, weights] of [[display, [400, 700]], [body, [400, 700]]] as const) {
    const slug = FONT_FAMILIES[family] ?? 'inter';
    for (const w of weights) {
      const data = (await load(slug, w)) ?? (await load(slug, 400));
      if (data && !out.some((f) => f.name === family && f.weight === w)) out.push({ name: family, data, weight: w, style: 'normal' });
    }
  }
  return out;
}
