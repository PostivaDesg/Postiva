// "Conectar Canva": o gestor autoriza uma vez a conta do Canva da Postiva (OAuth com PKCE).
import { NextResponse } from 'next/server';
import { randomBytes, createHash } from 'crypto';
import { currentProfile } from '@/lib/supabase';
import { CANVA_SCOPES, canvaConfigured, canvaRedirect } from '@/lib/canva';

export async function GET(req: Request) {
  const me = await currentProfile();
  if (me?.role !== 'gestor') return NextResponse.redirect(new URL('/login', req.url));
  if (!canvaConfigured()) return NextResponse.json({ error: 'Cadastre CANVA_CLIENT_ID e CANVA_CLIENT_SECRET na Vercel primeiro.' }, { status: 400 });
  const verifier = randomBytes(48).toString('base64url');
  const state = randomBytes(16).toString('base64url');
  const u = new URL('https://www.canva.com/api/oauth/authorize');
  u.searchParams.set('response_type', 'code');
  u.searchParams.set('client_id', process.env.CANVA_CLIENT_ID!);
  u.searchParams.set('redirect_uri', canvaRedirect());
  u.searchParams.set('scope', CANVA_SCOPES);
  u.searchParams.set('code_challenge', createHash('sha256').update(verifier).digest('base64url'));
  u.searchParams.set('code_challenge_method', 's256');
  u.searchParams.set('state', state);
  const res = NextResponse.redirect(u.toString());
  const opts = { httpOnly: true, secure: true, sameSite: 'lax' as const, path: '/api/canva', maxAge: 600 };
  res.cookies.set('canva_v', verifier, opts);
  res.cookies.set('canva_s', state, opts);
  return res;
}
