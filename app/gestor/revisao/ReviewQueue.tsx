'use client';
import { useEffect, useRef, useState } from 'react';

type Item = {
  id: string; kind: string; scheduledAt: string; title: string; caption: string; artBrief: string;
  reason: string | null; quickRequest: string | null; isPromo: boolean; company: string; art: string;
};

const KIND: Record<string, string> = { story: 'Story', post: 'Post', reels: 'Reels' };

export default function ReviewQueue({ items: initial }: { items: Item[] }) {
  const [items, setItems] = useState(initial);
  const [filter, setFilter] = useState('');
  const companies = Array.from(new Set(initial.map((i) => i.company))).sort();
  const shown = items.filter((i) => !filter || i.company === filter);

  return (
    <>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }} role="group" aria-label="Filtrar por empresa">
        {['', ...companies].map((c) => (
          <button key={c || 'todas'} className={`btn ${filter === c ? '' : 'ghost'}`} style={{ height: 38 }} onClick={() => setFilter(c)}>
            {c || 'Todas'}
          </button>
        ))}
      </div>
      {shown.length === 0 && <p className="muted">Nada na fila.</p>}
      <div style={{ display: 'grid', gap: 12 }}>
        {shown.map((it) => <Card key={it.id} it={it} onDone={() => setItems((xs) => xs.filter((x) => x.id !== it.id))} />)}
      </div>
    </>
  );
}

function Card({ it, onDone }: { it: Item; onDone: () => void }) {
  const [title, setTitle] = useState(it.title);
  const [caption, setCaption] = useState(it.caption);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const ref = useRef<HTMLElement>(null);
  const seconds = useRef(0);

  // Conta o tempo só enquanto o card está na tela (para a margem por cliente)
  useEffect(() => {
    let visible = false;
    const obs = new IntersectionObserver(([e]) => { visible = e.isIntersecting; }, { threshold: 0.5 });
    if (ref.current) obs.observe(ref.current);
    const t = setInterval(() => { if (visible && document.visibilityState === 'visible') seconds.current += 1; }, 1000);
    return () => { obs.disconnect(); clearInterval(t); };
  }, []);

  async function act(action: 'liberar' | 'descartar') {
    if (action === 'descartar' && !confirm('Descartar este rascunho?')) return;
    setBusy(true); setErr(null);
    const r = await fetch('/api/gestor/review', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ postId: it.id, action, title, caption, seconds: seconds.current }),
    });
    const j = await r.json();
    setBusy(false);
    if (!r.ok) return setErr(j.error);
    onDone();
  }

  const when = new Date(it.scheduledAt).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', weekday: 'short', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
  return (
    <article ref={ref} className="card" style={{ display: 'grid', gap: 10 }}>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <strong>{it.company}</strong>
        <span className="badge">{KIND[it.kind] ?? it.kind} · {when}</span>
        {it.isPromo && <span className="badge" style={{ background: '#EAF0FF', color: '#1C3BC2' }}>Promoção</span>}
        {it.quickRequest && <span className="badge" style={{ background: '#E5F5EC', color: '#17704A' }}>Pedido do cliente</span>}
      </div>
      {it.quickRequest && <p style={{ margin: 0, fontSize: 14 }}><strong>Pedido:</strong> {it.quickRequest}</p>}
      <img src={it.art} alt={`Prévia da arte: ${it.title}`} loading="lazy" style={{ width: 220, maxWidth: '100%', borderRadius: 10, border: '1px solid #E1E6EE' }} />
      <div><label htmlFor={`t-${it.id}`}>Título</label><input id={`t-${it.id}`} value={title} onChange={(e) => setTitle(e.target.value)} /></div>
      <div><label htmlFor={`c-${it.id}`}>Legenda / texto</label><textarea id={`c-${it.id}`} rows={5} value={caption} onChange={(e) => setCaption(e.target.value)} /></div>
      <details><summary className="muted">Briefing da arte e motivo</summary>
        <p style={{ whiteSpace: 'pre-line', fontSize: 14 }}>{it.artBrief}</p>
        {it.reason && <p className="muted" style={{ fontSize: 14 }}>{it.reason}</p>}
      </details>
      {err && <p role="alert" style={{ color: '#A1281F', margin: 0 }}>{err}</p>}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button className="btn ok" disabled={busy} onClick={() => act('liberar')}>Liberar para o cliente</button>
        <button className="btn ghost" disabled={busy} onClick={() => act('descartar')}>Descartar</button>
      </div>
    </article>
  );
}
