// Fotos e logo para as artes: carrega como data URL e escolhe a foto de cada post em rodízio.
import { supabaseAdmin } from '../supabase';
import { downloadFile } from '../drive';
import { toArtDataUrl } from './image-bytes';

type Asset = { id: string; kind: string; storage_path: string | null; drive_file_id: string | null; name: string };

export async function assetDataUrl(a: Asset | null | undefined) {
  if (!a) return null;
  try {
    if (a.storage_path) {
      const { data } = await supabaseAdmin().storage.from('marcas').download(a.storage_path);
      if (!data) return null;
      return toArtDataUrl(await data.arrayBuffer());
    }
    if (a.drive_file_id) return toArtDataUrl(await downloadFile(a.drive_file_id) as ArrayBuffer);
  } catch { /* sem a imagem, o layout usa a versão só com texto */ }
  return null;
}

export async function logoDataUrl(companyId: string) {
  const { data } = await supabaseAdmin().from('company_assets').select('id, kind, storage_path, drive_file_id, name')
    .eq('company_id', companyId).eq('kind', 'logo').order('created_at', { ascending: false }).limit(1);
  return assetDataUrl(data?.[0]);
}

export async function assetById(id: string | null | undefined) {
  if (!id) return null;
  const { data } = await supabaseAdmin().from('company_assets').select('id, kind, storage_path, drive_file_id, name').eq('id', id).maybeSingle();
  return data as Asset | null;
}

// Que tipo de foto combina com cada layout
const PREFER: Record<string, string[]> = {
  'data-foto-equipe': ['equipe', 'loja'], 'polaroid': ['equipe', 'loja', 'produto'], 'citacao': [],
  'produto-flutuante': ['produto'], 'faixa-preco': ['produto'], 'data-produto': ['produto'],
};

/** Escolhe fotos para as peças novas: o tipo certo para o layout, a usada há mais tempo primeiro. */
export async function pickPhotos(companyId: string, layouts: string[]) {
  const db = supabaseAdmin();
  const { data: assets } = await db.from('company_assets').select('id, kind').eq('company_id', companyId).in('kind', ['loja', 'equipe', 'produto', 'outro']);
  if (!assets?.length) return layouts.map(() => null);
  const { data: used } = await db.from('posts').select('asset_id, created_at').eq('company_id', companyId)
    .not('asset_id', 'is', null).order('created_at', { ascending: false }).limit(200);
  const lastUse = new Map<string, number>();
  (used ?? []).forEach((u, i) => { if (!lastUse.has(u.asset_id)) lastUse.set(u.asset_id, i); });
  const out: (string | null)[] = [];
  for (const l of layouts) {
    const pref = PREFER[l] ?? ['loja', 'equipe', 'produto', 'outro'];
    if (!pref.length) { out.push(null); continue; }
    const pool = assets.filter((a) => pref.includes(a.kind));
    const list = pool.length ? pool : assets;
    // nunca usada (sem registro) vem primeiro; depois a usada há mais tempo
    const best = [...list].sort((a, b) => (lastUse.get(b.id) ?? 1e9) - (lastUse.get(a.id) ?? 1e9))[0];
    lastUse.set(best.id, -out.length - 1); // acabou de ser usada
    out.push(best.id);
  }
  return out;
}


const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\.[a-z0-9]+$/, '').replace(/[^a-z0-9]+/g, ' ').trim();

/** Fotos de produto da empresa (nome do arquivo = nome do produto), para o Claude escolher pelo assunto. */
export async function productPhotoNames(companyId: string) {
  const { data } = await supabaseAdmin().from('company_assets').select('name').eq('company_id', companyId).eq('kind', 'produto')
    .order('created_at', { ascending: false }).limit(120);
  return [...new Set((data ?? []).map((a) => a.name.replace(/\.[a-z0-9]+$/i, '')))];
}

/**
 * Foto de cada peça SEGUINDO O ASSUNTO (nunca uma foto qualquer do rodízio):
 *  - art_product com o nome de uma foto de produto da empresa → essa foto
 *  - art_photo "loja" / "equipe" → foto própria desse tipo (a usada há mais tempo)
 *  - senão → null (quem chama busca no banco de fotos pelo tema)
 */
export async function photosBySubject(companyId: string, pieces: { art_photo?: string | null; art_product?: string | null }[]) {
  const db = supabaseAdmin();
  const { data: assets } = await db.from('company_assets').select('id, kind, name').eq('company_id', companyId).in('kind', ['loja', 'equipe', 'produto']);
  if (!assets?.length) return pieces.map(() => null);
  const { data: used } = await db.from('posts').select('asset_id').eq('company_id', companyId).not('asset_id', 'is', null)
    .order('created_at', { ascending: false }).limit(200);
  const lastUse = new Map<string, number>();
  (used ?? []).forEach((u, i) => { if (!lastUse.has(u.asset_id)) lastUse.set(u.asset_id, i); });
  return pieces.map((p, i) => {
    if (p.art_product) {
      const want = norm(p.art_product);
      const hit = assets.find((a) => a.kind === 'produto' && norm(a.name) === want)
        ?? assets.find((a) => a.kind === 'produto' && (norm(a.name).includes(want) || want.includes(norm(a.name))));
      if (hit) return hit.id;
    }
    const k = norm(p.art_photo ?? '');
    if (k === 'loja' || k === 'equipe') {
      const pool = assets.filter((a) => a.kind === k);
      if (pool.length) {
        const best = [...pool].sort((a, b) => (lastUse.get(b.id) ?? 1e9) - (lastUse.get(a.id) ?? 1e9))[0];
        lastUse.set(best.id, -i - 1);
        return best.id;
      }
    }
    return null;
  });
}
