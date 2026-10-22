// Volta do Canva depois da autorização: guarda o token e leva o gestor para o Diagnóstico.
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { currentProfile } from '@/lib/supabase';
import { canvaExchangeCode } from '@/lib/canva';

export async function GET(req: Request) {
  const me = await currentProfile();
  if (me?.role !== 'gestor') return NextResponse.redirect(new URL('/login', req.url));
  const url = new URL(req.url);
  const jar = await cookies();
  const back = new URL('/gestor/diagnostico', req.url);
  const code = url.searchParams.get('code');
  if (!code || url.searchParams.get('state') !== jar.get('canva_s')?.value) {
    back.searchParams.set('canva', 'erro'); return NextResponse.redirect(back);
  }
  try { await canvaExchangeCode(code, jar.get('canva_v')?.value ?? ''); back.searchParams.set('canva', 'ok'); }
  catch (e) { console.error('[canva]', e); back.searchParams.set('canva', 'erro'); }
  return NextResponse.redirect(back);
}
