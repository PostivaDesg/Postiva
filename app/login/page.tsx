'use client';
import { useState } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import { useRouter } from 'next/navigation';
import { BRAND } from '@/lib/brand-config';
import { PostivaLogo } from '@/components/Logo';

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

  const tiles = ['#D6246E', '#2E2A6B', '#F3C2D6', '#3B5BDB', '#FCE8F0', '#24215A', '#B9B5E6', '#D6246E', '#3A3577'];
  return (
    <main className="entrada">
      <section className="lado" aria-hidden="false">
        <PostivaLogo size={54} invert />
        <div>
          <h1>Seu Instagram com design, todo dia.</h1>
          <p>Entre para aprovar os posts da semana, ver os contatos que chegaram pelo WhatsApp e pedir peças novas.</p>
        </div>
        <div className="grade" aria-hidden="true">{tiles.map((c, i) => <div key={i} style={{ background: c }} />)}</div>
      </section>
      <form onSubmit={entrar}>
        <div><h2 style={{ fontSize: 28 }}>Entrar</h2><p className="muted" style={{ margin: '6px 0 0' }}>Use o e-mail e a senha que você recebeu da {BRAND.name}.</p></div>
        <div><label htmlFor="email">E-mail</label><input id="email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></div>
        <div><label htmlFor="senha">Senha</label><input id="senha" type="password" autoComplete="current-password" value={senha} onChange={(e) => setSenha(e.target.value)} required /></div>
        {msg && <p role="status" style={{ margin: 0 }}>{msg}</p>}
        <button className="btn" disabled={carregando}>{carregando ? 'Entrando…' : 'Entrar'}</button>
        <button type="button" className="btn ghost" disabled={carregando} onClick={esqueci}>Esqueci a senha</button>
      </form>
    </main>
  );
}
