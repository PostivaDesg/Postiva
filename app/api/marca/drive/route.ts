// Vincula a pasta do Google Drive da empresa e importa a lista de imagens dela.
import { NextResponse } from 'next/server';
import { currentProfile, supabaseAdmin } from '@/lib/supabase';
import { resolveCompany } from '@/lib/quota';
import { folderIdFromUrl, listImages, serviceEmail } from '@/lib/drive';

export const maxDuration = 120;

export async function POST(req: Request) {
  const me = await currentProfile();
  if (!me) return NextResponse.json({ error: 'Faça login.' }, { status: 401 });
  const { url, companyId } = await req.json() as { url: string; companyId?: string };
  const cid = resolveCompany(me, companyId);
  if (!cid) return NextResponse.json({ error: 'Empresa não informada.' }, { status: 400 });

  const folderId = folderIdFromUrl(url ?? '');
  if (!folderId) return NextResponse.json({ error: 'Cole o link de uma PASTA do Google Drive.' }, { status: 400 });

  let images;
  try {
    images = await listImages(folderId);
  } catch {
    return NextResponse.json({
      error: `Não consegui abrir a pasta. No Drive, clique em Compartilhar e adicione ${serviceEmail() ?? 'o e-mail da Postiva Design'} como Leitor.`,
    }, { status: 400 });
  }

  const db = supabaseAdmin();
  await db.from('companies').update({ drive_folder_id: folderId }).eq('id', cid);
  if (images.length) {
    await db.from('company_assets').upsert(
      images.map((f) => ({ company_id: cid, kind: guessKind(f.name), source: 'drive', drive_file_id: f.id, name: f.name.slice(0, 200) })),
      { onConflict: 'company_id,drive_file_id', ignoreDuplicates: true },
    );
  }
  return NextResponse.json({ linked: true, images: images.length });
}

// "logo.png", "Fotos da loja/fachada.jpg" … ajuda o Claude a escolher a foto certa
function guessKind(name: string) {
  const n = name.toLowerCase();
  if (n.includes('logo') || n.includes('marca')) return 'logo';
  if (n.includes('equipe') || n.includes('time') || n.includes('funcionar')) return 'equipe';
  if (n.includes('loja') || n.includes('fachada') || n.includes('clinica') || n.includes('ambiente')) return 'loja';
  if (n.includes('produto')) return 'produto';
  return 'outro';
}
