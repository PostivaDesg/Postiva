'use client';
// Trocar a senha (o cliente recebe uma senha provisória no cadastro).
import { useState } from 'react';
import Link from 'next/link';
import { createBrowserClient } from '@supabase/ssr';

export default function Conta() {
  const [a, setA] = useState('');
  const [b, setB] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function trocar(e: React.FormEvent) {
    e.preventDefault();
    if (a.length < 8) return setMsg('A senha precisa ter pelo menos 8 caracteres.');
    if (a !== b) return setMsg('As duas senhas não são iguais.');
    setBusy(true);
    const sb = createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
    const { error } = await sb.auth.updateUser({ password: a });
    setBusy(false);
    setMsg(error ? 'Não foi possível trocar a senha. Saia e entre de novo, e tente outra vez.' : 'Senha trocada.');
    if (!error) { setA(''); setB(''); }
  }
  async function sair() {
    const sb = createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
    await sb.auth.signOut();
    window.location.href = '/login';
  }

  return (
    <main className="wrap" style={{ maxWidth: 480, display: 'grid', gap: 16 }}>
      <Link href="/painel">← Voltar ao painel</Link>
      <h1 style={{ margin: 0 }}>Minha conta</h1>
      <form onSubmit={trocar} className="card" style={{ display: 'grid', gap: 14 }}>
        <h2 style={{ margin: 0 }}>Trocar senha</h2>
        <div><label htmlFor="a">Nova senha</label><input id="a" type="password" autoComplete="new-password" value={a} onChange={(e) => setA(e.target.value)} /></div>
        <div><label htmlFor="b">Repita a nova senha</label><input id="b" type="password" autoComplete="new-password" value={b} onChange={(e) => setB(e.target.value)} /></div>
        {msg && <p role="status" style={{ margin: 0 }}>{msg}</p>}
        <button className="btn" disabled={busy}>Salvar nova senha</button>
      </form>
      <button className="btn ghost" onClick={sair}>Sair</button>
    </main>
  );
}
