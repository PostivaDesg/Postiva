// Volta do e-mail de "esqueci a senha": confirma o código e leva o cliente para trocar a senha.
import { NextResponse } from 'next/server';
import { supabaseUser } from '@/lib/supabase';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  const next = url.searchParams.get('next')?.startsWith('/') ? url.searchParams.get('next')! : '/conta';
  if (code) {
    const sb = await supabaseUser();
    const { error } = await sb.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(next, url.origin));
  }
  return NextResponse.redirect(new URL('/login?erro=link', url.origin));
}
