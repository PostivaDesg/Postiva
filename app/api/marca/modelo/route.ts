// Modelo visual da empresa: o Claude desenha a partir do logo, cores e exemplos; o cliente vê a prévia e aprova.
import { NextResponse } from 'next/server';
import { createHash } from 'crypto';
import { currentProfile, supabaseAdmin } from '@/lib/supabase';
import { resolveCompany } from '@/lib/quota';
import { designTemplate } from '@/lib/art/design';
import { previewUrl } from '@/lib/art/url';
import { chatMode } from '@/lib/mode';

export const maxDuration = 120;
const MAX_PER_DAY = 5; // versões por dia por empresa (cada uma é uma chamada ao Claude)

async function previews(companyId: string, spec: any) {
  // a prévia muda quando muda o modelo, as fotos/logo enviados ou a liberação das fotos de banco
  const { count } = await supabaseAdmin().from('company_assets').select('id', { count: 'exact', head: true }).eq('company_id', companyId);
  const rev = createHash('sha1').update(`${JSON.stringify(spec)}|${count ?? 0}|${process.env.PIXABAY_API_KEY || process.env.PEXELS_API_KEY ? 's' : ''}|4`).digest('hex').slice(0, 10);
  const layouts = [...(spec?.layouts ?? []).slice(0, 4), 'data-festiva', 'data-foto-equipe'];
  return layouts.map((l: string) => ({ layout: l, url: previewUrl(companyId, l, rev) }));
}

// prévias do modelo do Canva guardadas pela equipe (tabela model_previews)
async function canvaPreviews(companyId: string) {
  const db = supabaseAdmin();
  const { data } = await db.from('model_previews').select('label, path').eq('company_id', companyId).not('path', 'is', null).order('id');
  const out: { layout: string; url: string }[] = [];
  for (const r of data ?? []) {
    const { data: s } = await db.storage.from('marcas').createSignedUrl(r.path as string, 3600);
    if (s?.signedUrl) out.push({ layout: r.label, url: s.signedUrl });
  }
  return out;
}

export async function GET(req: Request) {
  const me = await currentProfile();
  if (!me) return NextResponse.json({ error: 'Faça login.' }, { status: 401 });
  const cid = resolveCompany(me, new URL(req.url).searchParams.get('companyId'));
  if (!cid) return NextResponse.json({ error: 'Empresa não informada.' }, { status: 400 });
  const { data: c } = await supabaseAdmin().from('companies').select('template_spec, template_status').eq('id', cid).single();
  if (await chatMode()) {
    const { data: t } = await supabaseAdmin().from('companies').select('canva_brand_template_ids').eq('id', cid).single();
    if (t?.canva_brand_template_ids && Object.keys(t.canva_brand_template_ids).length > 0) {
      return NextResponse.json({ status: c?.template_status ?? 'aprovado', notes: 'Seu modelo está pronto no Canva, com o seu logo e as suas cores. As artes da semana saem nele.', previews: await canvaPreviews(cid) });
    }
  }
  return NextResponse.json({ status: c?.template_status ?? 'pendente', notes: c?.template_spec?.notes ?? null, previews: c?.template_spec ? await previews(cid, c.template_spec) : [] });
}

export async function POST(req: Request) {
  const me = await currentProfile();
  if (!me) return NextResponse.json({ error: 'Faça login.' }, { status: 401 });
  const b = await req.json() as { action: 'desenhar' | 'aprovar'; feedback?: string; companyId?: string };
  const cid = resolveCompany(me, b.companyId);
  if (!cid) return NextResponse.json({ error: 'Empresa não informada.' }, { status: 400 });
  const db = supabaseAdmin();

  if (b.action === 'aprovar') {
    await db.from('companies').update({ template_status: 'aprovado' }).eq('id', cid);
    return NextResponse.json({ status: 'aprovado' });
  }

  // modo chat: o modelo é montado no Canva pela equipe (tarefa agendada do Claude), sem gastar API
  if (await chatMode()) {
    const { data: c0 } = await db.from('companies').select('canva_brand_template_ids, template_status').eq('id', cid).single();
    const ready = c0?.canva_brand_template_ids && Object.keys(c0.canva_brand_template_ids).length > 0;
    if (!ready && c0?.template_status !== 'aprovado') await db.from('companies').update({ template_status: 'aguardando' }).eq('id', cid);
    return NextResponse.json({
      status: ready ? 'aprovado' : 'aguardando', previews: [],
      notes: ready
        ? 'Seu modelo já está pronto no Canva, com o seu logo e as suas cores. As artes da semana saem nele.'
        : 'Recebemos seu logo e seus exemplos. A equipe monta o seu modelo no Canva em até 1 dia útil e ele já vale para as próximas artes.',
    });
  }

  // Limite diário de versões (o gestor não tem limite)
  const today = new Date(Date.now() - 3 * 3600e3).toISOString().slice(0, 10);
  const { data: c } = await db.from('companies').select('template_tries, template_tries_day').eq('id', cid).single();
  const tries = c?.template_tries_day === today ? c.template_tries : 0;
  if (me.role !== 'gestor' && tries >= MAX_PER_DAY) {
    return NextResponse.json({ error: `Você já pediu ${MAX_PER_DAY} versões hoje. Amanhã dá para pedir mais, ou fale com a equipe.` }, { status: 429 });
  }
  await db.from('companies').update({ template_tries: tries + 1, template_tries_day: today }).eq('id', cid);

  try {
    const spec = await designTemplate(cid, b.feedback?.slice(0, 500));
    return NextResponse.json({ status: 'aguardando', notes: spec.notes, previews: await previews(cid, spec) });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
