'use client';
import { useState } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import { useRouter } from 'next/navigation';
import { BRAND } from '@/lib/brand-config';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);
  const sb = () => createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

  async function entrar(e: React.FormEvent) {
    e.preventDefault();
    setCarregando(true); setMsg(null);
    const { error } = await sb().auth.signInWithPassword({ email, password: senha });
    setCarregando(false);
    if (error) return setMsg('E-mail ou senha incorretos.');
    router.push('/painel');
    router.refresh();
  }

  async function esqueci() {
    if (!email) return setMsg('Digite seu e-mail acima e clique de novo em "Esqueci a senha".');
    setCarregando(true);
    await sb().auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/auth/callback?next=/conta` });
    setCarregando(false);
    setMsg('Se este e-mail estiver cadastrado, você vai receber um link para criar uma nova senha.');
  }

  return (
    <main className="wrap" style={{ maxWidth: 420, paddingTop: 80 }}>
      <h1>Entrar na {BRAND.name}</h1>
      <p className="muted">Use o login que você recebeu da equipe.</p>
      <form onSubmit={entrar} style={{ display: 'grid', gap: 16 }}>
        <div><label htmlFor="email">E-mail</label><input id="email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></div>
        <div><label htmlFor="senha">Senha</label><input id="senha" type="password" autoComplete="current-password" value={senha} onChange={(e) => setSenha(e.target.value)} required /></div>
        {msg && <p role="status" style={{ margin: 0 }}>{msg}</p>}
        <button className="btn" disabled={carregando}>{carregando ? 'Aguarde…' : 'Entrar'}</button>
        <button type="button" className="btn ghost" disabled={carregando} onClick={esqueci}>Esqueci a senha</button>
      </form>
    </main>
  );
}
