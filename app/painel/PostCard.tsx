'use client';
// Um post para aprovar: arte à esquerda, legenda e decisão à direita.
import { readJSON } from '@/lib/client-fetch';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function PostCard(p: {
  id: string; kind: string; when: string; title: string; caption: string; reason: string | null; artUrl: string | null; videoUrl?: string | null; isReel?: boolean;
}) {
  const router = useRouter();
  const [modo, setModo] = useState<'idle' | 'ajuste' | 'enviando'>('idle');
  const [nota, setNota] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const [refazendo, setRefazendo] = useState(false);

  async function chamar(path: string, body?: object, back: 'idle' | 'ajuste' = 'idle') {
    if (back === 'idle') setModo('enviando');
    const r = await fetch(`/api/posts/${p.id}/${path}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body ?? {}),
    }).catch(() => null);
    const j = r ? await readJSON(r) : { error: 'Sem conexão com o servidor. Tente de novo.' };
    if (!r?.ok) { setMsg(j.error); setModo(back); return; }
    setMsg(j?.message ?? null); setNota(''); setModo('idle');
    router.refresh();
  }

  return (
    <article className="painel aprovar" id={`p-${p.id}`}>
      {p.videoUrl
        ? <video src={p.videoUrl} poster={p.artUrl ?? undefined} controls playsInline preload="none" style={{ width: '100%', borderRadius: 14, background: '#000', aspectRatio: '9/16', objectFit: 'cover' }} aria-label={`Vídeo do reels: ${p.title}`} />
        : p.artUrl
        ? <img src={p.artUrl} alt={`Arte: ${p.title}`} />
        : <div className="vazio" style={{ aspectRatio: '4/5', placeItems: 'center' }}><p>Arte sendo gerada</p></div>}
      <div className="pilha" style={{ gap: 14 }}>
        <div>
          <span className="status aguardando">{p.kind} · {p.when}</span>
          <h3 style={{ marginTop: 10, fontSize: 19 }}>{p.title}</h3>
        </div>
        <p className="legenda-post">{p.caption}</p>
        {p.reason && <p className="porque">Por que este post: {p.reason}</p>}
        {p.isReel && !p.videoUrl && <p className="muted" style={{ margin: 0, fontSize: 14 }}>Ao aprovar, a Postiva monta o vídeo com fotos, as frases e o seu logo (leva cerca de 1 minuto) e agenda.</p>}
        {msg && <p role="alert" style={{ color: 'var(--vermelho)', margin: 0 }}>{msg}</p>}
        {modo === 'ajuste' ? (
          <div className="pilha" style={{ gap: 8 }}>
            <label htmlFor={`n-${p.id}`}>O que você não gostou?</label>
            <span className="muted" style={{ fontSize: 13 }}>A nova versão volta para você aprovar, e o seu motivo ensina o que a sua empresa gosta.</span>
            <textarea id={`n-${p.id}`} rows={3} value={nota} onChange={(e) => setNota(e.target.value)} placeholder="Ex.: a foto não tem a ver com o produto, texto muito longo, quero falar do delivery" />
            <div className="acoes">
              <button className="btn" disabled={nota.trim().length < 4 || refazendo} onClick={async () => { setRefazendo(true); await chamar('change', { note: nota }, 'ajuste'); setRefazendo(false); }}>{refazendo ? 'Enviando…' : 'Pedir nova versão'}</button>
              <button className="btn ghost" onClick={() => setModo('idle')}>Cancelar</button>
            </div>
          </div>
        ) : (
          <div className="acoes">
            <button className="btn ok" disabled={modo === 'enviando'} onClick={() => chamar('approve')}>{modo === 'enviando' ? (p.isReel && !p.videoUrl ? 'Montando o vídeo…' : 'Enviando…') : 'Aprovar'}</button>
            <button className="btn ghost" disabled={modo === 'enviando'} onClick={() => setModo('ajuste')}>Não gostei, refazer</button>
          </div>
        )}
      </div>
    </article>
  );
}
