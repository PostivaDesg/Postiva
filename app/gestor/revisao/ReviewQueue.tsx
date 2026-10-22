'use client';
import { readJSON } from '@/lib/client-fetch';
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
      <div className="acoes" role="group" aria-label="Filtrar por empresa">
        {['', ...companies].map((c) => (
          <button key={c || 'todas'} className={`btn pequeno ${filter === c ? 'escuro' : 'ghost'}`} aria-pressed={filter === c} onClick={() => setFilter(c)}>
            {c || 'Todas'}
          </button>
        ))}
      </div>
      {shown.length === 0 && <div className="vazio"><h3>Fila vazia</h3><p>Gere a semana de uma empresa para os rascunhos aparecerem aqui.</p></div>}
      <div className="pilha" style={{ marginTop: 16 }}>
        {shown.map((it) => <Card key={it.id} it={it} onDone={() => setItems((xs) => xs.filter((x) => x.id !== it.id))} />)}
      </div>
    </>
  );
}

function Card({ it, onDone }: { it: Item; onDone: () => void }) {
  const [title, setTitle] = useState(it.title);
  const [caption, setCaption] = useState(it.caption);
  const [busy, setBusy] = useState(false);
  const [reason, setReason] = useState('');
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
      body: JSON.stringify({ postId: it.id, action, title, caption, seconds: seconds.current, reason }),
    }).catch(() => null);
    const j = r ? await readJSON(r) : { error: 'Sem conexão com o servidor. Tente de novo.' };
    setBusy(false);
    if (!r?.ok) return setErr(j.error);
    onDone();
  }

  const when = new Date(it.scheduledAt).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', weekday: 'short', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
  return (
    <article ref={ref} className="painel aprovar">
      <img src={it.art} alt={`Prévia da arte: ${it.title}`} loading="lazy" />
      <div className="pilha" style={{ gap: 12 }}>
        <div className="acoes" style={{ alignItems: 'center' }}>
          <strong>{it.company}</strong>
          <span className="status rascunho">{KIND[it.kind] ?? it.kind} · {when}</span>
          {it.isPromo && <span className="status teste">Promoção</span>}
          {it.quickRequest && <span className="status aprovado">Pedido do cliente</span>}
        </div>
        {it.quickRequest && <p className="porque"><strong>Pedido:</strong> {it.quickRequest}</p>}
        <div><label htmlFor={`t-${it.id}`}>Título</label><input id={`t-${it.id}`} value={title} onChange={(e) => setTitle(e.target.value)} /></div>
        <div><label htmlFor={`c-${it.id}`}>Legenda</label><textarea id={`c-${it.id}`} rows={6} value={caption} onChange={(e) => setCaption(e.target.value)} /></div>
        <details><summary className="muted">Briefing da arte e motivo</summary>
          <p style={{ whiteSpace: 'pre-line', fontSize: 14 }}>{it.artBrief}</p>
          {it.reason && <p className="muted" style={{ fontSize: 14 }}>{it.reason}</p>}
        </details>
        <div><label htmlFor={`r-${it.id}`}>Se for descartar, por quê? O Claude aprende com isso.</label>
          <input id={`r-${it.id}`} placeholder="Ex.: foto não combina com o texto, tema repetido, tom muito formal" value={reason} onChange={(e) => setReason(e.target.value)} /></div>
        {err && <p role="alert" style={{ color: 'var(--vermelho)', margin: 0 }}>{err}</p>}
        <div className="acoes">
          <button className="btn ok" disabled={busy} onClick={() => act('liberar')}>Liberar para o cliente</button>
          <button className="btn ghost" disabled={busy} onClick={() => act('descartar')}>Descartar</button>
        </div>
      </div>
    </article>
  );
}
