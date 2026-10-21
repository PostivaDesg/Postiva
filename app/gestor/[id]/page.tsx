// Configuração do Claude de uma empresa + geração da semana.
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { currentProfile, supabaseAdmin } from '@/lib/supabase';
import GenerateWeek from './GenerateWeek';
import { ART_DIRECTIONS, directionById } from '@/lib/styles';
import { toSegment } from '@/lib/dates';

export default async function ConfigEmpresa({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const me = await currentProfile();
  if (me?.role !== 'gestor') redirect('/login');

  const db = supabaseAdmin();
  const { data: company } = await db.from('companies').select('*').eq('id', id).single();
  const { data: brand } = await db.from('brand_profiles').select('*').eq('company_id', id).single();
  const { data: drafts } = await db.from('posts').select('id, kind, scheduled_at, title, caption')
    .eq('company_id', id).eq('status', 'rascunho').order('scheduled_at');
  const { data: templates } = await db.from('company_templates').select('layout, brand_template_id').eq('company_id', id);
  const dir = directionById(company?.art_style);
  const options = ART_DIRECTIONS[toSegment(company?.segment)];

  async function salvar(form: FormData) {
    'use server';
    const me2 = await currentProfile();
    if (me2?.role !== 'gestor') return;
    await supabaseAdmin().from('brand_profiles').update({
      briefing: String(form.get('briefing') ?? ''),
      tone: String(form.get('tone') ?? ''),
      rules: String(form.get('rules') ?? ''),
      visual: String(form.get('visual') ?? ''),
      updated_at: new Date().toISOString(),
    }).eq('company_id', id);
    await supabaseAdmin().from('companies').update({
      metricool_blog_id: String(form.get('metricool') ?? '') || null,
      art_style: String(form.get('art_style') ?? '') || null,
      credit_all: form.get('credit_all') === 'on',
    }).eq('id', id);
    // Modelos do Canva: uma linha por layout, "layout = ID do modelo"
    const lines = String(form.get('templates') ?? '').split('\n').map((l) => l.split('=').map((s) => s.trim())).filter((p) => p.length === 2 && p[0] && p[1]);
    await supabaseAdmin().from('company_templates').delete().eq('company_id', id);
    if (lines.length) await supabaseAdmin().from('company_templates').insert(lines.map(([layout, tid]) => ({ company_id: id, layout, brand_template_id: tid })));
    revalidatePath(`/gestor/${id}`);
  }

  const campo = (name: string, label: string, value: string, rows = 6, hint = '') => (
    <div>
      <label htmlFor={name}>{label}</label>
      {hint && <p className="muted" style={{ margin: '0 0 6px', fontSize: 13 }}>{hint}</p>}
      <textarea id={name} name={name} rows={rows} defaultValue={value} />
    </div>
  );

  return (
    <main className="wrap" style={{ display: 'grid', gap: 20 }}>
      <h1 style={{ margin: 0 }}>{company?.name}: perfil do Claude</h1>
      <form action={salvar} className="card" style={{ display: 'grid', gap: 16 }}>
        {campo('briefing', 'Briefing', brand?.briefing ?? '', 8, 'O que vende, preços, público, cidade, horário.')}
        {campo('tone', 'Tom de voz', brand?.tone ?? '', 6, 'Como a marca fala + 2 ou 3 legendas aprovadas como exemplo.')}
        {campo('rules', 'Proibições e regras', brand?.rules ?? '', 5, 'O que nunca pode ser dito ou mostrado.')}
        {campo('visual', 'Identidade visual', brand?.visual ?? '', 4, 'Cores, fontes, estilo das artes, modelos do Canva.')}
        <div><label htmlFor="metricool">ID da marca no Metricool</label><input id="metricool" name="metricool" defaultValue={company?.metricool_blog_id ?? ''} /></div>
        <div><label htmlFor="art_style">Direção de arte</label>
          <select id="art_style" name="art_style" defaultValue={company?.art_style ?? ''} style={{ width: '100%', height: 46, borderRadius: 10, border: '1px solid #CBD2DD', padding: '0 10px' }}>
            {options.map((o) => <option key={o.id} value={o.id}>{o.name} – {o.brief}</option>)}
          </select>
          <p className="muted" style={{ fontSize: 13 }}>Layouts em rodízio: {dir.layouts.join(', ')}. Datas comemorativas usam layouts próprios, diferentes dos de outras empresas.</p>
        </div>
        <div><label htmlFor="templates">Opcional: modelos do Canva desta empresa, se quiser editar à mão (uma linha por layout: layout = ID do modelo)</label>
          <textarea id="templates" name="templates" rows={6} defaultValue={(templates ?? []).map((t) => `${t.layout} = ${t.brand_template_id}`).join('\n')}
            placeholder={[...dir.layouts, 'data-tipografica', 'data-foto-equipe'].map((l) => `${l} = `).join('\n')} /></div>
        <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontWeight: 500 }}>
          <input type="checkbox" name="credit_all" defaultChecked={!!company?.credit_all} style={{ width: 'auto' }} />
          Assinatura "Arte: Postiva Design" em todas as artes (nas datas comemorativas ela sempre vai)
        </label>
        <button className="btn" style={{ justifySelf: 'start' }}>Salvar perfil</button>
      </form>

      <GenerateWeek companyId={id} drafts={drafts ?? []} />
    </main>
  );
}
