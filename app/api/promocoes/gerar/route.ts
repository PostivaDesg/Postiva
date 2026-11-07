// Gera a campanha de promoção (posts, stories e reels) a partir dos itens confirmados.
import { NextResponse } from 'next/server';
import { currentProfile, supabaseAdmin } from '@/lib/supabase';
import { chatMode } from '@/lib/mode';
import { blockedResponse } from '@/lib/access';
import { generatePromo } from '@/lib/claude';
import { monthlyRemaining, resolveCompany } from '@/lib/quota';
import { notifyClient, notifyGestor } from '@/lib/notify';
import { newTrackingCode } from '@/lib/tracking';
import type { PlanId } from '@/lib/plans';
import { fromEan } from '@/lib/products';
import { buildBrand } from '@/lib/brand';
import { withLayouts, artColumns } from '@/lib/layout-rows';
import { withFiveHashtags } from '@/lib/hashtags';

export const maxDuration = 300;

interface Item {
  name: string; ean?: string | null; brand?: string | null; ncm?: string | null;
  photoUrl?: string | null; productUrl?: string | null;
  priceFrom?: number | null; priceTo: number;
  isMedicine?: boolean; otcConfirmed?: boolean;
}

export async function POST(req: Request) {
  const me = await currentProfile();
  if (!me) return NextResponse.json({ error: 'Faça login.' }, { status: 401 });
  const body = await req.json() as {
    companyId?: string; source: 'site' | 'planilha'; items: Item[];
    validFrom: string; validUntil: string;
    formats: { postPerItem: boolean; storySequence: boolean; reels: boolean };
  };
  const cid = resolveCompany(me, body.companyId);
  if (!cid) return NextResponse.json({ error: 'Empresa não informada.' }, { status: 400 });

  // Validações: preço, datas e medicamentos
  if (!body.items?.length) return NextResponse.json({ error: 'Escolha pelo menos um produto.' }, { status: 400 });
  if (!body.validFrom || !body.validUntil || body.validUntil < body.validFrom) {
    return NextResponse.json({ error: 'Informe a validade da promoção (início e fim).' }, { status: 400 });
  }
  for (const it of body.items) {
    // Reconfere no servidor: o NCM vem do Cosmos, não do navegador
    if (it.ean) {
      const p = await fromEan(it.ean).catch(() => null);
      if (p) { it.ncm = p.ncm; it.isMedicine = p.isMedicine; it.brand = it.brand ?? p.brand; }
    }
    if (!(it.priceTo > 0)) return NextResponse.json({ error: `Falta o preço da promoção de "${it.name}".` }, { status: 400 });
    if (it.isMedicine && !it.otcConfirmed) {
      return NextResponse.json({ error: `"${it.name}" é medicamento: confirme que é de venda livre.` }, { status: 400 });
    }
  }

  const db = supabaseAdmin();
  const { data: company } = await db.from('companies').select('*').eq('id', cid).single();
  const { data: brand } = await db.from('brand_profiles').select('*').eq('company_id', cid).single();
  const { data: sub } = await db.from('subscriptions').select('status').eq('company_id', cid).single();
  if (!company || !brand) return NextResponse.json({ error: 'Empresa não encontrada.' }, { status: 404 });
  if (sub && !['teste', 'ativa'].includes(sub.status)) return NextResponse.json({ error: 'Assinatura pausada.' }, { status: 402 });
  const blocked = await blockedResponse(cid, me.role);
  if (blocked) return blocked;

  const left = await monthlyRemaining(cid, company.plan as PlanId, new Date(`${body.validFrom}T12:00:00-03:00`));
  if (left.post + left.story + left.reels === 0) {
    return NextResponse.json({ error: 'A cota do mês já foi usada. Peça peças extras à equipe.' }, { status: 409 });
  }

  // Salva os itens da promoção
  const { data: saved, error } = await db.from('promo_items').insert(body.items.map((it) => ({
    company_id: cid, source: body.source, ean: it.ean ?? null, name: it.name, brand: it.brand ?? null, ncm: it.ncm ?? null,
    product_url: it.productUrl ?? null, photo_url: it.photoUrl ?? null,
    price_from: it.priceFrom ?? null, price_to: it.priceTo,
    valid_from: body.validFrom, valid_until: body.validUntil,
    is_medicine: !!it.isMedicine, otc_confirmed: !!it.otcConfirmed,
    needs_review: !!it.isMedicine || !it.photoUrl || !it.ean, // sem EAN não dá para conferir se é remédio: gestor revisa
  }))).select('id, needs_review');
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // modo chat (sem API paga): cada produto vira um pedido na fila; o Claude cria story (com preço) e, se pedido,
  // post e reels (sem preço) na próxima rodada, com os preços e a validade gravados em promo_items
  if (await chatMode()) {
    const queue: Record<string, unknown>[] = [];
    const left2 = { ...left };
    const fmt = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    const val = `válido de ${body.validFrom.split('-').reverse().join('/')} a ${body.validUntil.split('-').reverse().join('/')} ou enquanto durar o estoque`;
    body.items.forEach((it, i) => {
      const desc = `Promoção: ${it.name}${it.brand ? ` (${it.brand})` : ''} por ${fmt(it.priceTo)}${it.priceFrom ? ` (de ${fmt(it.priceFrom)})` : ''}, ${val}.`;
      const add = (kind: 'story' | 'post' | 'reels', note: string) => {
        if (left2[kind]-- <= 0) return;
        queue.push({ company_id: cid, kind, scheduled_at: `${body.validFrom}T${kind === 'story' ? '13' : kind === 'post' ? '19' : '11'}:00:00-03:00`,
          title: it.name.slice(0, 80), caption: '', status: 'pedido', quick_request: `${desc} ${note}`,
          promo_item_ids: saved?.[i]?.id ? [saved[i].id] : [], tracking_code: newTrackingCode() });
      };
      if (body.formats.storySequence || (!body.formats.postPerItem && !body.formats.reels)) add('story', 'Story com o preço e a validade.');
      if (body.formats.postPerItem) add('post', 'Post de feed SEM preço (regra da Postiva), destacando o produto.');
    });
    if (body.formats.reels && body.items.length) {
      if (left2.reels-- > 0) queue.push({ company_id: cid, kind: 'reels', scheduled_at: `${body.validFrom}T11:00:00-03:00`,
        title: 'Promoção', caption: '', status: 'pedido', quick_request: `Reels da promoção (SEM preço) com: ${body.items.map((x) => x.name).join(', ')}.`,
        promo_item_ids: (saved ?? []).map((x) => x.id), tracking_code: newTrackingCode() });
    }
    const { error: e2 } = await db.from('posts').insert(queue);
    if (e2) return NextResponse.json({ error: 'Não consegui salvar a promoção. Tente de novo.' }, { status: 500 });
    await notifyGestor(cid, 'pedido', `${company.name} criou uma promoção com ${body.items.length} produto(s): ${queue.length} peça(s) na fila.`).catch(() => {});
    return NextResponse.json({ created: queue.length, queued: true, waitingClient: 0, waitingReview: 0, cut: 0,
      message: 'Promoção recebida. As peças chegam para você aprovar em algumas horas.' });
  }

  const { pieces, usage } = await generatePromo({
    brand: buildBrand(company, brand),
    items: body.items.map((it) => ({ name: it.name, brand: it.brand ?? null, priceFrom: it.priceFrom ?? null, priceTo: it.priceTo, photoUrl: it.photoUrl ?? null })),
    validFrom: body.validFrom, validUntil: body.validUntil, formats: body.formats, limits: left,
  });

  // Respeita a cota e decide quem revisa primeiro
  const remaining = { ...left };
  const kept = pieces.filter((p) => remaining[p.kind]-- > 0);
  // peças de promoção usam a foto do produto (site ou Cosmos)
  const laid = await withLayouts(company, kept.map((p) => ({ ...p, hasProductPhoto: (p.items ?? []).some((i) => !!body.items[i]?.photoUrl) })));
  const rows = laid.map((l) => { const p = l.piece;
    const ids = (p.items ?? []).map((i) => saved[i]?.id).filter(Boolean) as string[];
    const review = (p.items ?? []).some((i) => saved[i]?.needs_review);
    return {
      company_id: cid, kind: p.kind, scheduled_at: `${p.day}T${p.time}:00-03:00`,
      title: p.title, caption: withFiveHashtags(p.kind, p.caption, company), reason: p.reason,
      ...artColumns(l),
      status: review ? 'rascunho' : 'aguardando', // medicamento ou sem foto: gestor revisa antes
      released_at: review ? null : new Date().toISOString(),
      promo_item_ids: ids,
      tracking_code: newTrackingCode(),
    };
  });
  const { error: e3 } = await db.from('posts').insert(rows);
  if (e3) return NextResponse.json({ error: 'Não consegui salvar as peças da promoção. Tente de novo.' }, { status: 500 });
  await db.from('ai_usage').insert({ company_id: cid, ...usage });

  const waiting = rows.filter((r) => r.status === 'aguardando').length;
  if (waiting) await notifyClient(cid, 'aprovar', `Sua promoção tem ${waiting} peças prontas para aprovar.`);
  if (rows.length - waiting) await notifyGestor(cid, 'pedido', `${company.name}: ${rows.length - waiting} peças de promoção na fila de revisão.`);

  return NextResponse.json({
    created: rows.length,
    waitingClient: waiting,
    waitingReview: rows.length - waiting,
    cut: pieces.length - rows.length, // peças que não couberam na cota
  });
}
