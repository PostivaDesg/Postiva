'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function PostCard(p: {
  id: string; kind: string; when: string; title: string; caption: string; reason: string | null; artUrl: string | null;
}) {
  const router = useRouter();
  const [modo, setModo] = useState<'idle' | 'ajuste' | 'enviando'>('idle');
  const [nota, setNota] = useState('');
  const [msg, setMsg] = useState<string | null>(null);

  async function chamar(path: string, body?: object) {
    setModo('enviando');
    const r = await fetch(`/api/posts/${p.id}/${path}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body ?? {}),
    });
    const j = await r.json();
    if (!r.ok) { setMsg(j.error); setModo('idle'); return; }
    router.refresh();
  }

  return (
    <article className="card" style={{ display: 'grid', gap: 10 }}>
      <span className="badge">{p.kind} · {p.when}</span>
      {p.artUrl
        ? <img src={p.artUrl} alt={`Arte: ${p.title}`} style={{ width: '100%', borderRadius: 10 }} />
        : <div className="muted" style={{ aspectRatio: '4/5', background: '#E9EDF4', borderRadius: 10, display: 'grid', placeItems: 'center' }}>Arte em produção</div>}
      <strong>{p.title}</strong>
      <p style={{ margin: 0, whiteSpace: 'pre-line' }}>{p.caption}</p>
      {p.reason && <p className="muted" style={{ margin: 0, fontSize: 14 }}>Por que este post: {p.reason}</p>}
      {msg && <p role="alert" style={{ color: '#A1281F', margin: 0 }}>{msg}</p>}

      {modo === 'ajuste' ? (
        <div style={{ display: 'grid', gap: 8 }}>
          <label htmlFor={`n-${p.id}`}>O que você quer mudar?</label>
          <textarea id={`n-${p.id}`} rows={3} value={nota} onChange={(e) => setNota(e.target.value)} />
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn" onClick={() => chamar('change', { note: nota })}>Enviar pedido</button>
            <button className="btn ghost" onClick={() => setModo('idle')}>Cancelar</button>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button className="btn ok" disabled={modo === 'enviando'} onClick={() => chamar('approve')}>Aprovar</button>
          <button className="btn ghost" disabled={modo === 'enviando'} onClick={() => setModo('ajuste')}>Pedir ajuste</button>
        </div>
      )}
    </article>
  );
}
