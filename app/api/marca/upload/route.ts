// Envio direto de fotos e logo pelo painel (para quem não usa Google Drive).
import { NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { currentProfile, supabaseAdmin } from '@/lib/supabase';
import { resolveCompany } from '@/lib/quota';

const KINDS = ['logo', 'loja', 'equipe', 'produto', 'outro', 'referencia'];
const TYPES = ['image/png', 'image/jpeg']; // o gerador de artes só lê PNG e JPG (SVG também fica de fora: pode carregar script)

export async function POST(req: Request) {
  const me = await currentProfile();
  if (!me) return NextResponse.json({ error: 'Faça login.' }, { status: 401 });
  const form = await req.formData();
  const cid = resolveCompany(me, form.get('companyId') as string | null);
  if (!cid) return NextResponse.json({ error: 'Empresa não informada.' }, { status: 400 });
  const kind = KINDS.includes(String(form.get('kind'))) ? String(form.get('kind')) : 'outro';

  const files = form.getAll('files').filter((f): f is File => f instanceof File).slice(0, 20);
  if (!files.length) return NextResponse.json({ error: 'Escolha pelo menos uma imagem.' }, { status: 400 });

  const db = supabaseAdmin();
  let saved = 0;
  const errors: string[] = [];
  for (const f of files) {
    if (!TYPES.includes(f.type)) { errors.push(`${f.name}: formato não aceito. Use PNG ou JPG (no celular, um print da foto resolve).`); continue; }
    if (f.size > 6_000_000) { errors.push(`${f.name}: maior que 6 MB. Envie uma versão menor.`); continue; }
    const safeName = f.name.normalize('NFD').replace(/[^\w.-]/g, '_').slice(-80);
    const path = `${cid}/${randomUUID()}-${safeName}`;
    const { error } = await db.storage.from('marcas').upload(path, f, { contentType: f.type });
    if (error) { errors.push(`${f.name}: ${error.message}`); continue; }
    await db.from('company_assets').insert({ company_id: cid, kind, source: 'upload', storage_path: path, name: f.name.slice(0, 200) });
    saved++;
  }
  return NextResponse.json({ saved, errors });
}
