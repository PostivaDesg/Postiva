'use client';
import { createBrowserClient } from '@supabase/ssr';

export default function SignOut() {
  async function sair() {
    const sb = createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
    await sb.auth.signOut();
    window.location.href = '/login';
  }
  return <button type="button" onClick={sair}>Sair</button>;
}
