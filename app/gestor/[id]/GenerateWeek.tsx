'use client';
import { readJSON } from '@/lib/client-fetch';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

function nextMonday() {
  const d = new Date();
  d.setDate(d.getDate() + ((8 - d.getDay()) % 7 || 7));
  return d.toISOString().slice(0, 10);
}

export default function GenerateWeek({ companyId, drafts }: {
  companyId: string;
  drafts: { id: string; kind: string; scheduled_at: string; title: string; caption: string }[];
}) {
  const router = useRouter();
  const [week, setWeek] = useState(nextMonday());
  const [extra, setExtra] = useState('');
  const [status, setStatus] = useState<string | null>(null);

  async function post(url: string, body: object, ok: (j: any) => string) {
    setStatus('Trabalhando…');
    const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).catch(() => null);
    if (!r) { setStatus('Sem conexão com o servidor. Tente de novo.'); return; }
    const j = await readJSON(r);
    setStatus(r.ok ? ok(j) : j.error);
    router.refresh();
  }

  // monta os vídeos dos reels um por um (cada um leva uns 30 a 60 segundos)
  async function montarReels(body: object, prefix = '') {
    const r = await fetch('/api/gestor/reels', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ companyId, ...body }) }).catch(() => null);
    const pending: string[] = r?.ok ? (await readJSON(r)).pending ?? [] : [];
    let ok = 0, fail = 0;
    for (let i = 0; i < pending.length; i++) {
      setStatus(`${prefix}Montando o vídeo do reels ${i + 1} de ${pending.length}…`);
      const b = await fetch('/api/gestor/reels', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ companyId, postId: pending[i] }) }).catch(() => null);
      if (b?.ok) ok++; else fail++;
    }
    router.refresh();
    return pending.length ? ` ${ok} ${ok === 1 ? 'vídeo de reels montado' : 'vídeos de reels montados'}${fail ? `, ${fail} com falha (tente "Montar vídeos dos reels")` : ''}.` : '';
  }

  return (
    <section className="painel pilha" style={{ gap: 14 }}>
      <div className="painel-titulo" style={{ marginBottom: 0 }}>
        <div><h2>Gerar semana</h2><p>O Claude escreve as peças e depois escolhe a foto de cada uma. Se a semana já tiver peças, ele completa só o que falta.</p></div>
        <button className="btn ghost pequeno" onClick={() => post('/api/marca/modelo', { action: 'desenhar', companyId }, () => 'Modelo desenhado. O cliente vê a prévia em Minha marca para aprovar.')}>Redesenhar o modelo visual</button>
      </div>
      <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
        <div><label htmlFor="week">Semana começando em</label><input id="week" type="date" value={week} onChange={(e) => setWeek(e.target.value)} /></div>
        <div><label htmlFor="extra">Contexto da semana (opcional)</label><input id="extra" placeholder="Ex.: Dia das Crianças, promoção X" value={extra} onChange={(e) => setExtra(e.target.value)} /></div>
      </div>
      <button className="btn" style={{ justifySelf: 'start' }}
        onClick={async () => {
          setStatus('Escrevendo as peças com o Claude… (2 a 3 minutos)');
          const r = await fetch('/api/gestor/generate-week', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ companyId, weekStart: week, extraContext: extra }) }).catch(() => null);
          if (!r) { setStatus('Sem conexão com o servidor. Tente de novo.'); return; }
          const j = await readJSON(r);
          if (!r.ok) { setStatus(j.error); return; }
          // em seguida, o Claude olha e escolhe a foto de cada peça nova (outra chamada: cabe no tempo da Vercel)
          setStatus(`${j.created} peças escritas. Escolhendo as fotos…`);
          const f = await fetch('/api/gestor/refazer-fotos', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ companyId, postIds: j.ids }) }).catch(() => null);
          const fj = f ? await readJSON(f) : {};
          const base = `${j.created} peças criadas como rascunho, ${fj.withPhoto ?? 0} com foto escolhida.`;
          const reels = await montarReels({ postIds: j.ids }, base + ' ');
          setStatus(base + reels);
        }}>
        Gerar com o Claude
      </button>
      {status && <p role="status" style={{ margin: 0 }}>{status}</p>}

      {drafts.length > 0 && <p className="muted" style={{ margin: 0 }}>{drafts.length} {drafts.length === 1 ? 'rascunho' : 'rascunhos'} desta empresa esperando revisão.</p>}
      {(
        <button className="btn ghost" style={{ justifySelf: 'start' }}
          onClick={() => post('/api/gestor/refazer-fotos', { companyId }, (j) => `Fotos refeitas em ${j.updated} peças (${j.withPhoto} com foto).`)}>
          Refazer fotos (rascunhos e não aprovados)
        </button>
      )}
      {drafts.some((d) => d.kind === 'reels') && (
        <button className="btn ghost" style={{ justifySelf: 'start' }}
          onClick={async () => { setStatus('Procurando reels…'); setStatus((await montarReels({ refazer: true })) || 'Nenhum reels para montar.'); }}>
          Montar vídeos dos reels
        </button>
      )}
      {drafts.length > 0 && (
        <button className="btn ok" style={{ justifySelf: 'start' }}
          onClick={() => post('/api/gestor/release', { companyId, postIds: drafts.map((d) => d.id) }, (j) => `${j.released} posts enviados para o cliente aprovar.`)}>
          Liberar todos para o cliente
        </button>
      )}
    </section>
  );
}
