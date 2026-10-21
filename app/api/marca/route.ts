// "Minha marca": dados da empresa que o cliente mesmo preenche e atualiza.
import { NextResponse } from 'next/server';
import { currentProfile, supabaseAdmin } from '@/lib/supabase';
import { resolveCompany } from '@/lib/quota';
import { serviceEmail } from '@/lib/drive';

// Campos que o cliente pode editar (plano, pagamento e configurações técnicas ficam com o gestor)
const EDITABLE = [
  'legal_name', 'cnpj', 'contact_name', 'contact_email', 'whatsapp', 'address', 'opening_hours',
  'site_url', 'instagram', 'audience', 'competitors', 'objective', 'products', 'forbidden',
  'reference_instagram', 'hashtags',
] as const;

export async function GET(req: Request) {
  const me = await currentProfile();
  if (!me) return NextResponse.json({ error: 'Faça login.' }, { status: 401 });
  const cid = resolveCompany(me, new URL(req.url).searchParams.get('companyId'));
  if (!cid) return NextResponse.json({ error: 'Empresa não informada.' }, { status: 400 });
  const db = supabaseAdmin();
  const { data: company } = await db.from('companies').select(['name', 'drive_folder_id', 'bio_code', 'brand_colors', 'auto_approve_hours', ...EDITABLE].join(',')).eq('id', cid).single();
  const { data: assets } = await db.from('company_assets').select('id, kind, source, name, created_at').eq('company_id', cid).order('created_at', { ascending: false }).limit(200);
  return NextResponse.json({ company, assets, driveEmail: serviceEmail() });
}

export async function POST(req: Request) {
  const me = await currentProfile();
  if (!me) return NextResponse.json({ error: 'Faça login.' }, { status: 401 });
  const body = await req.json() as Record<string, string> & { companyId?: string };
  const cid = resolveCompany(me, body.companyId);
  if (!cid) return NextResponse.json({ error: 'Empresa não informada.' }, { status: 400 });

  const patch: Record<string, unknown> = {};
  for (const k of EDITABLE) if (k in body) patch[k] = String(body[k] ?? '').trim().slice(0, 5000) || null;
  // Cores da marca: até 4, em hexadecimal
  if ('brand_colors' in body) {
    const list = String(body.brand_colors ?? '').split(/[\s,;]+/).map((c) => c.trim().toUpperCase()).filter((c) => /^#[0-9A-F]{6}$/.test(c));
    patch.brand_colors = list.slice(0, 4);
  }
  // Aprovação automática opcional: 24, 48 ou 72h sem resposta (vazio = desligada)
  if ('auto_approve_hours' in body) {
    const h = Number(body.auto_approve_hours);
    patch.auto_approve_hours = [24, 48, 72].includes(h) ? h : null;
  }
  if (typeof patch.site_url === 'string' && !/^https:\/\//.test(patch.site_url)) return NextResponse.json({ error: 'O site precisa começar com https://' }, { status: 400 });
  if (typeof patch.contact_email === 'string' && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(patch.contact_email)) return NextResponse.json({ error: 'E-mail inválido.' }, { status: 400 });

  const { error } = await supabaseAdmin().from('companies').update(patch).eq('id', cid);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
