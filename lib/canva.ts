// Canva Connect API: a mesma conta do Canva usada hoje com a NanoFarma e a MedVie.
// Cada empresa tem UMA pasta própria; toda arte gerada para ela é movida para lá.
// Docs: https://www.canva.dev/docs/connect/
// O preenchimento automático (autofill) de modelos funciona no Canva Pro, Teams e Enterprise.
//
// Autenticação: a Connect API usa OAuth. Crie uma integração em canva.com/developers,
// autorize uma vez com a conta da Postiva Design e guarde o refresh token em CANVA_REFRESH_TOKEN.
import { BRAND } from './brand-config';

const BASE = 'https://api.canva.com/rest/v1';

let cached: { token: string; expires: number } | null = null;

export const CANVA_SCOPES = 'design:content:read design:content:write design:meta:read brandtemplate:meta:read brandtemplate:content:read asset:read asset:write folder:read folder:write';
export const canvaConfigured = () => !!(process.env.CANVA_CLIENT_ID && process.env.CANVA_CLIENT_SECRET);
export const canvaRedirect = () => `${process.env.NEXT_PUBLIC_SITE_URL ?? 'https://postiva-design.vercel.app'}/api/canva/callback`;
const basic = () => `Basic ${Buffer.from(`${process.env.CANVA_CLIENT_ID}:${process.env.CANVA_CLIENT_SECRET}`).toString('base64')}`;

async function setting(key: string) {
  const { supabaseAdmin } = await import('./supabase');
  const { data } = await supabaseAdmin().from('app_settings').select('value').eq('key', key).maybeSingle();
  return data?.value ?? null;
}
async function saveSetting(key: string, value: string) {
  const { supabaseAdmin } = await import('./supabase');
  await supabaseAdmin().from('app_settings').upsert({ key, value, updated_at: new Date().toISOString() });
}

/** O Canva está conectado (o gestor autorizou pelo botão "Conectar Canva")? */
export async function canvaConnected() {
  return canvaConfigured() && !!((await setting('canva_refresh_token')) ?? process.env.CANVA_REFRESH_TOKEN);
}

/** Troca o código da autorização pelo token (chamado pelo /api/canva/callback). */
export async function canvaExchangeCode(code: string, verifier: string) {
  const res = await fetch(`${BASE}/oauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Authorization: basic() },
    body: new URLSearchParams({ grant_type: 'authorization_code', code, code_verifier: verifier, redirect_uri: canvaRedirect() }),
  });
  if (!res.ok) throw new Error(`Canva OAuth: ${res.status} ${await res.text()}`);
  const j = await res.json() as { access_token: string; expires_in: number; refresh_token: string };
  await saveSetting('canva_refresh_token', j.refresh_token);
  cached = { token: j.access_token, expires: Date.now() + j.expires_in * 1000 };
}

async function accessToken() {
  if (cached && cached.expires > Date.now() + 60_000) return cached.token;
  const refresh = (await setting('canva_refresh_token')) ?? process.env.CANVA_REFRESH_TOKEN;
  if (!refresh) throw new Error('Canva não conectado: toque em "Conectar Canva" no Diagnóstico.');
  const res = await fetch(`${BASE}/oauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Authorization: basic() },
    body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: refresh }),
  });
  if (!res.ok) throw new Error(`Canva OAuth: ${res.status} ${await res.text()}`);
  const j = await res.json() as { access_token: string; expires_in: number; refresh_token?: string };
  // o Canva troca o refresh token a cada uso: guarda o novo no banco
  if (j.refresh_token && j.refresh_token !== refresh) await saveSetting('canva_refresh_token', j.refresh_token);
  cached = { token: j.access_token, expires: Date.now() + j.expires_in * 1000 };
  return cached.token;
}

async function canva<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${await accessToken()}`, 'Content-Type': 'application/json', ...(init.headers ?? {}) },
  });
  if (!res.ok) throw new Error(`Canva ${path}: ${res.status} ${await res.text()}`);
  return res.json() as Promise<T>;
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Cria a pasta da empresa (chamado ao cadastrar a empresa). */
export async function createCompanyFolder(companyName: string) {
  const j = await canva<{ folder: { id: string } }>('/folders', {
    method: 'POST',
    body: JSON.stringify({ name: `${BRAND.name} – ${companyName}`, parent_folder_id: 'root' }),
  });
  return j.folder.id;
}

/** Envia a foto do produto (do site ou do Cosmos) para o Canva, para usar no modelo. */
export async function uploadImageFromUrl(name: string, url: string) {
  // Endpoint de upload por URL. Conferir na doc se ainda está em preview na sua conta.
  const job = await canva<{ job: { id: string } }>('/url-asset-uploads', {
    method: 'POST', body: JSON.stringify({ name: name.slice(0, 50), url }),
  });
  for (let i = 0; i < 30; i++) {
    const s = await canva<{ job: { status: string; asset?: { id: string }; error?: { message: string } } }>(`/url-asset-uploads/${job.job.id}`);
    if (s.job.status === 'success') return s.job.asset!.id;
    if (s.job.status === 'failed') throw new Error(`Canva upload: ${s.job.error?.message}`);
    await wait(1500);
  }
  throw new Error('Canva upload: tempo esgotado');
}

/**
 * Preenche o modelo da empresa (story, post ou promoção) e move a arte para a pasta dela.
 * `fields` usa os nomes dos campos do modelo no Canva, ex.: { titulo, preco_de, preco_por, validade, foto }.
 */
export async function fillTemplate(opts: {
  brandTemplateId: string;
  folderId?: string | null;
  title: string;
  fields: Record<string, { type: 'text'; text: string } | { type: 'image'; asset_id: string }>;
}) {
  const job = await canva<{ job: { id: string } }>('/autofills', {
    method: 'POST',
    body: JSON.stringify({ brand_template_id: opts.brandTemplateId, title: opts.title.slice(0, 255), data: opts.fields }),
  });
  let designId: string | null = null;
  for (let i = 0; i < 40 && !designId; i++) {
    const s = await canva<{ job: { status: string; result?: { design: { id: string } }; error?: { message: string } } }>(`/autofills/${job.job.id}`);
    if (s.job.status === 'success') designId = s.job.result!.design.id;
    else if (s.job.status === 'failed') throw new Error(`Canva autofill: ${s.job.error?.message}`);
    else await wait(1500);
  }
  if (!designId) throw new Error('Canva autofill: tempo esgotado');

  if (opts.folderId) await canva('/folders/move', { method: 'POST', body: JSON.stringify({ item_id: designId, to_folder_id: opts.folderId }) }).catch(() => null);
  return designId;
}

/**
 * Modelo do Canva da empresa para um layout (company_templates).
 * Cada empresa tem os próprios modelos, na própria pasta, um por layout da direção de arte dela.
 * Sem modelo daquele layout, cai no primeiro modelo da empresa e o briefing descreve o layout.
 */
export async function templateFor(companyId: string, layout: string) {
  const { supabaseAdmin } = await import('./supabase');
  const db = supabaseAdmin();
  const { data } = await db.from('company_templates').select('layout, brand_template_id').eq('company_id', companyId);
  return data?.find((t) => t.layout === layout)?.brand_template_id ?? data?.[0]?.brand_template_id ?? null;
}

/** Campos padrão dos modelos (use estes nomes nos campos de dados do modelo no Canva). */
export function templateFields(post: {
  title: string; caption: string; credit: boolean; date_label?: string | null;
}, extra: Record<string, string> = {}, photoAssetId?: string | null) {
  const fields: Record<string, { type: 'text'; text: string } | { type: 'image'; asset_id: string }> = {
    titulo: { type: 'text', text: post.title.slice(0, 120) },
    texto: { type: 'text', text: post.caption.split('\n')[0].slice(0, 220) },
    credito: { type: 'text', text: post.credit ? BRAND.credit : '' },
  };
  if (post.date_label) fields.data = { type: 'text', text: post.date_label };
  for (const [k, v] of Object.entries(extra)) fields[k] = { type: 'text', text: v };
  if (photoAssetId) fields.foto = { type: 'image', asset_id: photoAssetId };
  return fields;
}

/** Exporta a arte em PNG e devolve o link (vai para posts.art_url e depois para o Metricool). */
export async function exportPng(designId: string) {
  const job = await canva<{ job: { id: string } }>('/exports', {
    method: 'POST', body: JSON.stringify({ design_id: designId, format: { type: 'png' } }),
  });
  for (let i = 0; i < 40; i++) {
    const s = await canva<{ job: { status: string; urls?: string[]; error?: { message: string } } }>(`/exports/${job.job.id}`);
    if (s.job.status === 'success') return s.job.urls![0];
    if (s.job.status === 'failed') throw new Error(`Canva export: ${s.job.error?.message}`);
    await wait(1500);
  }
  throw new Error('Canva export: tempo esgotado');
}

/** Campos de dados do modelo (nome → tipo), para preencher só o que o modelo tem. */
export async function templateDataset(brandTemplateId: string) {
  const j = await canva<{ dataset?: Record<string, { type: string }> }>(`/brand-templates/${brandTemplateId}/dataset`);
  return j.dataset ?? {};
}
