'use client';
// Pedido rápido do cliente.
import { useState } from 'react';
import Link from 'next/link';

export default function Pedido() {
  const tomorrow = new Date(Date.now() - 3 * 3600e3 + 864e5).toISOString().slice(0, 10);
  const [topic, setTopic] = useState('');
  const [kind, setKind] = useState<'story' | 'post' | 'reels'>('post');
  const [day, setDay] = useState(tomorrow);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setMsg(null);
    const r = await fetch('/api/pedidos', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ topic, kind, day }) });
    const j = await r.json(); setBusy(false);
    if (!r.ok) return setMsg(j.error);
    setTopic('');
    setMsg('Pedido recebido! A equipe revisa e ele aparece no seu painel para aprovar.');
  }

  return (
    <main className="wrap" style={{ maxWidth: 640, display: 'grid', gap: 16 }}>
      <Link href="/painel">← Voltar ao painel</Link>
      <h1 style={{ margin: 0 }}>Pedido rápido</h1>
      <p className="muted" style={{ margin: 0 }}>Precisa de um post fora do calendário? Descreva aqui. Ele usa a cota do seu plano.</p>
      <form onSubmit={enviar} className="card" style={{ display: 'grid', gap: 14 }}>
        <div><label htmlFor="topic">Sobre o que é o post?</label>
          <textarea id="topic" rows={4} maxLength={1000} required value={topic} onChange={(e) => setTopic(e.target.value)}
            placeholder="Ex.: chegou o protetor solar X, avisar que temos delivery no feriado, vaga de emprego…" /></div>
        <div className="grid">
          <div><label htmlFor="kind">Formato</label>
            <select id="kind" value={kind} onChange={(e) => setKind(e.target.value as any)} style={{ width: '100%', height: 46, borderRadius: 10, border: '1px solid #CBD2DD', padding: '0 10px' }}>
              <option value="post">Post no feed</option><option value="story">Story</option><option value="reels">Reels</option>
            </select></div>
          <div><label htmlFor="day">Para quando?</label><input id="day" type="date" min={tomorrow} value={day} onChange={(e) => setDay(e.target.value)} /></div>
        </div>
        {msg && <p role="status" style={{ margin: 0 }}>{msg}</p>}
        <button className="btn" disabled={busy}>{busy ? 'Enviando…' : 'Enviar pedido'}</button>
      </form>
    </main>
  );
}
