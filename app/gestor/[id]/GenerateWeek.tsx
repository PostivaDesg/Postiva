'use client';
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
    const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const j = await r.json();
    setStatus(r.ok ? ok(j) : j.error);
    router.refresh();
  }

  return (
    <section className="card" style={{ display: 'grid', gap: 14 }}>
      <h2 style={{ margin: 0 }}>Modelo visual e relatório</h2>
      <p className="muted" style={{ margin: 0 }}>O Claude desenha o modelo a partir do logo, das cores e dos exemplos que o cliente enviou em "Minha marca".</p>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button className="btn ghost" onClick={() => post('/api/marca/modelo', { action: 'desenhar', companyId }, () => 'Modelo desenhado. O cliente vê a prévia em Minha marca para aprovar.')}>Desenhar modelo desta empresa</button>
        <a className="btn ghost" href={`/minha-marca?companyId=${companyId}`} style={{ display: 'inline-flex', alignItems: 'center', textDecoration: 'none' }}>Abrir Minha marca desta empresa</a>
        <a className="btn ghost" href={`/relatorio?companyId=${companyId}`} style={{ display: 'inline-flex', alignItems: 'center', textDecoration: 'none' }}>Relatório do mês</a>
      </div>
      <h2 style={{ margin: '10px 0 0' }}>Gerar semana</h2>
      <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
        <div><label htmlFor="week">Semana começando em</label><input id="week" type="date" value={week} onChange={(e) => setWeek(e.target.value)} /></div>
        <div><label htmlFor="extra">Contexto da semana (opcional)</label><input id="extra" placeholder="Ex.: Dia das Crianças, promoção X" value={extra} onChange={(e) => setExtra(e.target.value)} /></div>
      </div>
      <button className="btn" style={{ justifySelf: 'start' }}
        onClick={() => post('/api/gestor/generate-week', { companyId, weekStart: week, extraContext: extra }, (j) => `${j.created} peças criadas como rascunho.`)}>
        Gerar com o Claude
      </button>
      {status && <p role="status" style={{ margin: 0 }}>{status}</p>}

      <h3 style={{ margin: '10px 0 0' }}>Rascunhos para revisar ({drafts.length})</h3>
      <ul style={{ margin: 0, paddingLeft: 18, lineHeight: 1.6 }}>
        {drafts.map((d) => <li key={d.id}><strong>{d.kind}</strong> · {d.scheduled_at.slice(0, 16).replace('T', ' ')} · {d.title}</li>)}
      </ul>
      {drafts.length > 0 && (
        <button className="btn ok" style={{ justifySelf: 'start' }}
          onClick={() => post('/api/gestor/release', { companyId, postIds: drafts.map((d) => d.id) }, (j) => `${j.released} posts enviados para o cliente aprovar.`)}>
          Liberar todos para o cliente
        </button>
      )}
    </section>
  );
}
