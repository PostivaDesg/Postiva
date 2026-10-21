import { createClient } from '@supabase/supabase-js';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';

/** Cliente com a sessão do usuário logado (respeita o RLS). */
export async function supabaseUser() {
  const store = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => store.getAll(),
        setAll: (list: { name: string; value: string; options?: CookieOptions }[]) => list.forEach(({ name, value, options }) => store.set(name, value, options)),
      },
    },
  );
}

/** Cliente de serviço (ignora o RLS). Usar SÓ no servidor, nunca no navegador. */
export function supabaseAdmin() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  });
}

/** Devolve o usuário logado e o perfil dele (empresa + papel), ou null. */
export async function currentProfile() {
  const sb = await supabaseUser();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabaseAdmin()
    .from('profiles').select('id, company_id, role, full_name').eq('id', user.id).single();
  return profile as { id: string; company_id: string | null; role: 'gestor' | 'cliente'; full_name: string | null } | null;
}
