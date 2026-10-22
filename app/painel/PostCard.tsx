'use client';
// Um post para aprovar: arte à esquerda, legenda e decisão à direita.
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
    <article className="painel aprovar" id={`p-${p.id}`}>
      {p.artUrl
        ? <img src={p.artUrl} alt={`Arte: ${p.title}`} />
        : <div className="vazio" style={{ aspectRatio: '4/5', placeItems: 'center' }}><p>Arte sendo gerada</p></div>}
      <div className="pilha" style={{ gap: 14 }}>
        <div>
          <span className="status aguardando">{p.kind} · {p.when}</span>
          <h3 style={{ marginTop: 10, fontSize: 19 }}>{p.title}</h3>
        </div>
        <p className="legenda-post">{p.caption}</p>
        {p.reason && <p className="porque">Por que este post: {p.reason}</p>}
        {msg && <p role="alert" style={{ color: 'var(--vermelho)', margin: 0 }}>{msg}</p>}
        {modo === 'ajuste' ? (
          <div className="pilha" style={{ gap: 8 }}>
            <label htmlFor={`n-${p.id}`}>O que você quer mudar?</label>
            <textarea id={`n-${p.id}`} rows={3} value={nota} onChange={(e) => setNota(e.target.value)} placeholder="Ex.: trocar a foto, falar do delivery, texto mais curto" />
            <div className="acoes">
              <button className="btn" disabled={!nota.trim()} onClick={() => chamar('change', { note: nota })}>Enviar ajuste</button>
              <button className="btn ghost" onClick={() => setModo('idle')}>Cancelar</button>
            </div>
          </div>
        ) : (
          <div className="acoes">
            <button className="btn ok" disabled={modo === 'enviando'} onClick={() => chamar('approve')}>{modo === 'enviando' ? 'Enviando…' : 'Aprovar'}</button>
            <button className="btn ghost" disabled={modo === 'enviando'} onClick={() => setModo('ajuste')}>Pedir ajuste</button>
          </div>
        )}
      </div>
    </article>
  );
}
