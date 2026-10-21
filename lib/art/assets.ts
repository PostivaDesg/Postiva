// Fotos e logo para as artes: carrega como data URL e escolhe a foto de cada post em rodízio.
import { supabaseAdmin } from '../supabase';
import { downloadFile } from '../drive';

type Asset = { id: string; kind: string; storage_path: string | null; drive_file_id: string | null; name: string };

const mimeOf = (name: string, fallback = 'image/jpeg') => {
  const ext = name.toLowerCase().split('.').pop();
  return ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : fallback;
};

export async function assetDataUrl(a: Asset | null | undefined) {
  if (!a) return null;
  try {
    if (a.storage_path) {
      const { data } = await supabaseAdmin().storage.from('marcas').download(a.storage_path);
      if (!data) return null;
      return `data:${data.type || mimeOf(a.name)};base64,${Buffer.from(await data.arrayBuffer()).toString('base64')}`;
    }
    if (a.drive_file_id) {
      const bytes = await downloadFile(a.drive_file_id);
      return `data:${mimeOf(a.name)};base64,${Buffer.from(bytes).toString('base64')}`;
    }
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
