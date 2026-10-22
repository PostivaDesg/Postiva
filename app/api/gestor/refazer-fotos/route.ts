// "Refazer fotos dos rascunhos": aplica de novo a escolha de foto e layout nos rascunhos da empresa,
// sem mudar os textos (útil depois de enviar fotos de produto ou de ligar um banco de fotos).
import { NextResponse } from 'next/server';
import { currentProfile, supabaseAdmin } from '@/lib/supabase';
import { planPhotos } from '@/lib/layout-rows';
import { photoQueries } from '@/lib/claude';

export const maxDuration = 300;

export async function POST(req: Request) {
  const me = await currentProfile();
  if (me?.role !== 'gestor') return NextResponse.json({ error: 'Só o gestor.' }, { status: 403 });
  const { companyId } = await req.json() as { companyId: string };
  const db = supabaseAdmin();
  const { data: company } = await db.from('companies').select('*').eq('id', companyId).single();
  if (!company) return NextResponse.json({ error: 'Empresa não encontrada.' }, { status: 404 });
  const { data: posts } = await db.from('posts').select('id, kind, layout, art_photo, art_product, date_label, promo_item_ids, art_version, art_headline, caption')
    .eq('company_id', companyId).eq('status', 'rascunho').order('scheduled_at').limit(120);
  if (!posts?.length) return NextResponse.json({ updated: 0 });

  // o Claude revê o tema de foto de cada rascunho pelo título e pela legenda (mantém "loja"/"equipe" quando há foto própria)
  const missing = posts;
  const qs = await photoQueries(missing.map((p) => ({ headline: p.art_headline ?? '', caption: p.caption, segment: company.segment }))).catch(() => []);
  missing.forEach((p, i) => {
    if (!qs[i]?.q) return;
    if (!['loja', 'equipe'].includes(String(p.art_photo ?? '').toLowerCase())) p.art_photo = qs[i].q;
    if (!p.date_label) p.art_product = qs[i].p ?? p.art_product;
  });
  await Promise.all(missing.map((p) => db.from('posts').update({ art_photo: p.art_photo, art_product: p.art_product }).eq('id', p.id)));

  const plan = await planPhotos(company, posts.map((p) => ({
    kind: p.kind, art_photo: p.art_photo, art_product: p.art_product, date_label: p.date_label,
    hasProductPhoto: !!p.promo_item_ids?.length, layout: p.layout ?? 'foto-faixa', brief: '', isDate: !!p.date_label,
  })));
  let updated = 0;
  for (let i = 0; i < posts.length; i++) {
    const x = plan[i];
    const { error } = await db.from('posts').update({
      layout: x.layout, asset_id: x.asset_id, stock_photo_url: x.stock_photo_url, art_version: (posts[i].art_version ?? 1) + 1,
    }).eq('id', posts[i].id);
    if (!error) updated++;
  }
  return NextResponse.json({ updated, withPhoto: plan.filter((x) => x.asset_id || x.stock_photo_url).length });
}
