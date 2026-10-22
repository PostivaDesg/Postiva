'use client';
// Pedido rápido do cliente.
import { readJSON } from '@/lib/client-fetch';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function Pedido() {
  const today = new Date(Date.now() - 3 * 3600e3).toISOString().slice(0, 10);
  const tomorrow = new Date(Date.now() - 3 * 3600e3 + 864e5).toISOString().slice(0, 10);
  const router = useRouter();
  const [topic, setTopic] = useState('');
  const [kind, setKind] = useState<'story' | 'post' | 'reels'>('post');
  const [day, setDay] = useState(tomorrow);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setMsg(null);
    const r = await fetch('/api/pedidos', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ topic, kind, day }) }).catch(() => null);
    const j = r ? await readJSON(r) : { error: 'Sem conexão com o servidor. Tente de novo.' }; setBusy(false);
    if (!r?.ok) return setMsg(j.error);
    setTopic('');
    setMsg('Sua arte está pronta! Abrindo para você aprovar…');
    router.push(`/painel/aprovar#p-${j.postId}`);
  }

  return (
    <div className="pilha" style={{maxWidth: 640}}>
      <header className="cabecalho"><div><h1>Pedido rápido</h1><p>Precisa de uma arte fora do calendário, até para hoje? Descreva aqui: a IA cria na hora e entrega para você aprovar. Usa a cota do seu plano.</p></div></header>
      <form onSubmit={enviar} className="painel" style={{ display: 'grid', gap: 14 }}>
        <div><label htmlFor="topic">Sobre o que é o post?</label>
          <textarea id="topic" rows={4} maxLength={1000} required value={topic} onChange={(e) => setTopic(e.target.value)}
            placeholder="Ex.: chegou o protetor solar X, avisar que temos delivery no feriado, vaga de emprego…" /></div>
        <div className="grid">
          <div><label htmlFor="kind">Formato</label>
            <select id="kind" value={kind} onChange={(e) => setKind(e.target.value as any)} >
              <option value="post">Post no feed</option><option value="story">Story</option><option value="reels">Reels</option>
            </select></div>
          <div><label htmlFor="day">Para quando?</label><input id="day" type="date" min={today} value={day} onChange={(e) => setDay(e.target.value)} /></div>
        </div>
        {msg && <p role="status" style={{ margin: 0 }}>{msg}</p>}
        <button className="btn" disabled={busy}>{busy ? (kind === 'reels' ? 'Criando a arte e o vídeo… (até 2 minutos)' : 'Criando a sua arte… (cerca de 1 minuto)') : 'Criar arte agora'}</button>
      </form>
    </div>
  );
}
