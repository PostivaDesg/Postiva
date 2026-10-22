// Arte pelo Canva: preenche um modelo da empresa (company_templates) com o texto e as fotos escolhidas,
// exporta em PNG e guarda no armazenamento (posts.art_png_path). Sem modelo ou sem Canva conectado,
// a arte continua sendo desenhada pelo próprio site.
//
// Modelos: na página da empresa, uma linha por modelo, "tipo = ID do modelo", onde tipo começa com
//   post…  (feed 1080x1350)   story…  (story/capa de reels 1080x1920)   data-post… / data-story…  (datas comemorativas)
// Campos de dados aceitos no modelo (o nome do campo no Canva): titulo, texto, cta, foto, produto, data, cidade, whatsapp.
import { supabaseAdmin } from './supabase';
import { canvaConnected, fillTemplate, exportPng, templateDataset, uploadImageFromUrl } from './canva';

type Field = { type: 'text'; text: string } | { type: 'image'; asset_id: string };
const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z]/g, '');
const ALIASES: Record<string, string[]> = {
  titulo: ['titulo', 'headline', 'title', 'chamada'], texto: ['texto', 'subtitulo', 'sub', 'apoio', 'descricao'],
  cta: ['cta', 'botao', 'acao'], foto: ['foto', 'imagem', 'photo', 'fundo', 'background'], produto: ['produto', 'embalagem', 'product'],
  data: ['data', 'datacomemorativa'], logo: ['logo', 'marca'], cidade: ['cidade', 'rodape', 'endereco'], whatsapp: ['whatsapp', 'telefone', 'zap'],
};
const roleOf = (name: string) => Object.entries(ALIASES).find(([, a]) => a.includes(norm(name)))?.[0] ?? null;

async function signed(path: string | null | undefined, bucket = 'marcas') {
  if (!path) return null;
  const { data } = await supabaseAdmin().storage.from(bucket).createSignedUrl(path, 3600);
  return data?.signedUrl ?? null;
}

/** Logo da empresa no Canva (envia uma vez e reaproveita). */
async function logoAsset(companyId: string) {
  const db = supabaseAdmin();
  const { data: logo } = await db.from('company_assets').select('id, storage_path').eq('company_id', companyId).eq('kind', 'logo')
    .order('created_at', { ascending: false }).limit(1).maybeSingle();
  if (!logo?.storage_path) return null;
  const key = `canva_logo_${companyId}_${logo.id}`;
  const { data: cached } = await db.from('app_settings').select('value').eq('key', key).maybeSingle();
  if (cached?.value) return cached.value;
  const url = await signed(logo.storage_path);
  if (!url) return null;
  const id = await uploadImageFromUrl('Logo', url);
  await db.from('app_settings').upsert({ key, value: id });
  return id;
}

export async function companyUsesCanva(companyId: string) {
  if (!(await canvaConnected())) return false;
  const { count } = await supabaseAdmin().from('company_templates').select('company_id', { count: 'exact', head: true }).eq('company_id', companyId);
  return (count ?? 0) > 0;
}

/** Gera a arte do post no Canva. Devolve o caminho do PNG, ou null se a empresa não tem modelo do formato. */
export async function canvaArt(postId: string) {
  const db = supabaseAdmin();
  const { data: p } = await db.from('posts').select('*').eq('id', postId).single();
  if (!p) throw new Error('Post não encontrado.');
  const { data: company } = await db.from('companies').select('id, name, city, whatsapp, canva_folder_id').eq('id', p.company_id).single();
  const { data: rows } = await db.from('company_templates').select('layout, brand_template_id').eq('company_id', p.company_id);
  const format = p.kind === 'post' ? 'post' : 'story';
  const all = (rows ?? []).map((r) => ({ key: String(r.layout).toLowerCase().trim(), id: r.brand_template_id }));
  const dated = p.date_label ? all.filter((r) => r.key.startsWith(`data-${format}`)) : [];
  const base = dated.length ? dated : all.filter((r) => r.key.startsWith(format));
  if (!base.length) return null;
  // modelo com cartão de produto só quando o post tem embalagem + foto de cena; os outros, sem cartão
  const sets = await Promise.all(base.map(async (r) => ({ ...r, ds: await templateDataset(r.id) })));
  const withProduct = (d: Record<string, unknown>) => Object.keys(d).some((k) => roleOf(k) === 'produto');
  const isProductPost = !!p.bg_photo_url;
  const fit = sets.filter((t) => withProduct(t.ds) === isProductPost);
  const pool = fit.length ? fit : sets;
  // cada post com um modelo (variedade), sempre o mesmo para o mesmo post
  const tpl = pool[[...p.id].reduce((a: number, c: string) => (a * 31 + c.charCodeAt(0)) >>> 0, 7) % pool.length];

  const dataset = tpl.ds;
  const fields: Record<string, Field> = {};
  // fotos: com campo "produto", a embalagem vai nele e a cena no "foto"; sem ele, a foto principal
  const hasProduct = Object.keys(dataset).some((k) => roleOf(k) === 'produto');
  let assetPath: string | null = null;
  if (p.asset_id) { const { data: a } = await db.from('company_assets').select('storage_path').eq('id', p.asset_id).maybeSingle(); assetPath = a?.storage_path ?? null; }
  const main = assetPath ?? p.stock_photo_url;
  const photoFor = { foto: hasProduct && p.bg_photo_url ? p.bg_photo_url : (p.bg_photo_url && p.layout === 'produto-flutuante' ? p.bg_photo_url : main), produto: main };
  const text: Record<string, string | null> = {
    titulo: p.art_headline || p.title, texto: p.art_sub, cta: p.art_cta, data: p.date_label,
    cidade: company?.city ?? null, whatsapp: company?.whatsapp ?? null,
  };
  for (const [name, def] of Object.entries(dataset)) {
    const role = roleOf(name);
    if (!role) continue;
    if (def.type === 'image' && role === 'logo') {
      const id = await logoAsset(p.company_id);
      if (id) fields[name] = { type: 'image', asset_id: id };
    } else if (def.type === 'image' && (role === 'foto' || role === 'produto')) {
      const url = await signed(photoFor[role as 'foto' | 'produto']);
      if (url) fields[name] = { type: 'image', asset_id: await uploadImageFromUrl(`${p.title}`.slice(0, 40), url) };
    } else if (def.type === 'text') {
      fields[name] = { type: 'text', text: String(text[role] ?? '').slice(0, 220) };
    }
  }
  const designId = await fillTemplate({ brandTemplateId: tpl.id, folderId: company?.canva_folder_id, title: `${company?.name ?? ''} – ${p.title}`, fields });
  const pngUrl = await exportPng(designId);
  const r = await fetch(pngUrl, { signal: AbortSignal.timeout(30000) });
  if (!r.ok) throw new Error('Não consegui baixar a arte exportada do Canva.');
  const path = `${p.company_id}/artes/${p.id}-v${p.art_version ?? 1}.png`;
  const { error } = await db.storage.from('marcas').upload(path, new Uint8Array(await r.arrayBuffer()), { contentType: 'image/png', upsert: true });
  if (error) throw new Error(`Falha ao guardar a arte: ${error.message}`);
  await db.from('posts').update({ art_png_path: path }).eq('id', p.id);
  return path;
}
