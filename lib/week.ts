// Geração da semana de uma empresa.
//  - prepareWeek: confere assinatura e cota e monta o pedido para o Claude
//  - saveWeek: grava as peças com layout, foto e textos da arte
// O botão do gestor usa os dois na hora; a rotina de domingo usa o envio em lote (lib/batch.ts).
import { supabaseAdmin } from './supabase';
import { PLANS, weeklyQuota, type PlanId, type PostKind } from './plans';
import { generateWeek, weekParams, type GeneratedPiece } from './claude';
import { newTrackingCode } from './tracking';
import { datesContext } from './dates';
import { buildBrand } from './brand';
import { withLayouts, artColumns } from './layout-rows';
import { productPhotoNames } from './art/assets';

export class WeekError extends Error {
  constructor(message: string, public status: number) { super(message); }
}

/** Próxima segunda-feira (AAAA-MM-DD), no horário de Brasília. */
export function nextMonday(from = new Date()) {
  const br = new Date(from.getTime() - 3 * 3600e3);
  const add = ((8 - br.getUTCDay()) % 7) || 7;
  return new Date(br.getTime() + add * 864e5).toISOString().slice(0, 10);
}

export async function prepareWeek(companyId: string, weekStart: string, extraContext?: string) {
  const db = supabaseAdmin();
  const { data: company } = await db.from('companies').select('*').eq('id', companyId).single();
  const { data: brand } = await db.from('brand_profiles').select('*').eq('company_id', companyId).single();
  const { data: sub } = await db.from('subscriptions').select('status').eq('company_id', companyId).single();
  if (!company || !brand) throw new WeekError('Empresa não encontrada.', 404);
  if (sub && !['teste', 'ativa'].includes(sub.status)) throw new WeekError(`Assinatura ${sub.status}: geração pausada.`, 402);
  // Sem modelo visual aprovado, as artes sairiam genéricas: melhor não gerar e avisar
  if (company.template_status !== 'aprovado') throw new WeekError('Modelo visual ainda não aprovado (Minha marca > Desenhar meu modelo).', 409);

  // Cota da semana menos o que já existe nela (promoções e pedidos rápidos incluídos)
  const quota = weeklyQuota(PLANS[company.plan as PlanId]);
  const weekEnd = new Date(Date.parse(weekStart) + 7 * 864e5).toISOString().slice(0, 10);
  const { data: existing } = await db.from('posts').select('kind')
    .eq('company_id', companyId).gte('scheduled_at', `${weekStart}T00:00:00-03:00`).lt('scheduled_at', `${weekEnd}T00:00:00-03:00`);
  for (const p of existing ?? []) quota[p.kind as PostKind] = Math.max(0, quota[p.kind as PostKind] - 1);
  if (quota.story + quota.post + quota.reels === 0) throw new WeekError('A cota desta semana já foi usada.', 409);

  const lastDay = new Date(Date.parse(weekStart) + 6 * 864e5).toISOString().slice(0, 10);
  const products = await productPhotoNames(companyId);
  const productsCtx = products.length ? `Fotos de produtos da loja (use o nome exato em art_product; sem preço): ${products.join('; ')}` : '';
  const context = [datesContext(weekStart, lastDay, company.segment, company.city), productsCtx, extraContext].filter(Boolean).join('\n');
  const opts = { brand: buildBrand(company, brand), weekStart, quota, extraContext: context || undefined };
  return { company, quota, opts, params: weekParams(opts) };
}

export async function saveWeek(company: any, quota: Record<PostKind, number>, pieces: GeneratedPiece[], usage: Record<string, unknown>) {
  const db = supabaseAdmin();
  const left = { ...quota };
  const kept = pieces.filter((p) => ['story', 'post', 'reels'].includes(p.kind) && /^\d{4}-\d{2}-\d{2}$/.test(p.day) && left[p.kind]-- > 0);
  const laid = await withLayouts(company, kept); // rodízio de layouts e fotos + arte exclusiva nas datas
  const rows = laid.map((l) => {
    const p = l.piece;
    const time = /^\d{2}:\d{2}$/.test(p.time ?? '') ? p.time : '12:00';
    return {
      company_id: company.id, kind: p.kind, scheduled_at: `${p.day}T${time}:00-03:00`,
      title: p.title, caption: p.caption, reason: p.reason,
      ...artColumns(l), status: 'rascunho', tracking_code: newTrackingCode(),
    };
  });
  if (rows.length) await db.from('posts').insert(rows);
  await db.from('ai_usage').insert({ company_id: company.id, ...usage });
  return rows.length;
}

/** Geração imediata (botão do gestor). */
export async function generateWeekFor(companyId: string, weekStart: string, extraContext?: string) {
  const { company, quota, opts } = await prepareWeek(companyId, weekStart, extraContext);
  // Na hora (plano grátis da Vercel corta em 5 min): a semana vai em 2 pedidos ao mesmo tempo, dias 1–4 e 5–7.
  const day = (n: number) => new Date(Date.parse(weekStart) + n * 864e5).toISOString().slice(0, 10);
  const split = (q: number, share: number) => Math.round(q * share);
  const qA = { story: split(quota.story, 4 / 7), post: split(quota.post, 4 / 7), reels: Math.ceil(quota.reels / 2) };
  const qB = { story: quota.story - qA.story, post: quota.post - qA.post, reels: quota.reels - qA.reels };
  const parts = await Promise.all([
    generateWeek({ ...opts, quota: qA, days: { from: day(0), to: day(3), count: 4, part: 'Outra pessoa faz os dias seguintes: varie produtos e temas.' } }),
    qB.story + qB.post + qB.reels > 0
      ? generateWeek({ ...opts, quota: qB, days: { from: day(4), to: day(6), count: 3, part: 'Outra pessoa fez os dias anteriores com outros produtos: escolha produtos e temas diferentes dos mais óbvios.' } })
      : Promise.resolve({ pieces: [], usage: null as any }),
  ]);
  const pieces = parts.flatMap((p) => p.pieces);
  const usage = parts.map((p) => p.usage).filter(Boolean).reduce((a, u) => ({
    ...a, input_tokens: a.input_tokens + u.input_tokens, output_tokens: a.output_tokens + u.output_tokens, cache_read_tokens: a.cache_read_tokens + u.cache_read_tokens,
  }));
  return { created: await saveWeek(company, quota, pieces, usage), companyName: company.name as string };
}
