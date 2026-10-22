'use client';
// Criar promoção: puxar do site da empresa ou enviar planilha com EAN.
import { useState } from 'react';
import Link from 'next/link';

type Item = {
  key: string; include: boolean; name: string; ean?: string | null; brand?: string | null; ncm?: string | null;
  photoUrl?: string | null; productUrl?: string | null; priceFrom: number | null; priceTo: number | null;
  isMedicine: boolean; otcConfirmed: boolean; note?: string;
};

const brl = (n: number | null) => (n == null ? '' : n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }));
const num = (s: string) => { const n = Number(s.replace(/\./g, '').replace(',', '.').replace(/[^\d.]/g, '')); return n > 0 ? n : null; };

export default function Promocoes() {
  const [tab, setTab] = useState<'site' | 'planilha'>('site');
  const [url, setUrl] = useState('');
  const [items, setItems] = useState<Item[]>([]);
  const [validFrom, setValidFrom] = useState('');
  const [validUntil, setValidUntil] = useState('');
  const [formats, setFormats] = useState({ postPerItem: true, storySequence: true, reels: false });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const update = (key: string, patch: Partial<Item>) => setItems((xs) => xs.map((x) => (x.key === key ? { ...x, ...patch } : x)));

  async function buscarSite() {
    setBusy(true); setMsg(null);
    const r = await fetch('/api/promocoes/site', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url }) });
    const j = await r.json(); setBusy(false);
    if (!r.ok) return setMsg(j.error);
    setItems(j.products.map((p: any, i: number) => ({
      key: `s${i}`, include: true, name: p.name, ean: p.ean, brand: p.brand, photoUrl: p.photoUrl, productUrl: p.productUrl,
      priceFrom: p.sitePrice ?? null, priceTo: null, isMedicine: false, otcConfirmed: false,
      note: p.sitePrice ? undefined : 'Preço não encontrado no site',
    })));
    setMsg(`Encontrei ${j.products.length} produtos. Digite o preço da promoção de cada um.`);
  }

  async function enviarPlanilha(file: File) {
    setBusy(true); setMsg(null);
    const form = new FormData(); form.append('file', file);
    const r = await fetch('/api/promocoes/planilha', { method: 'POST', body: form });
    const j = await r.json(); setBusy(false);
    if (!r.ok) return setMsg(j.error);
    setItems(j.rows.map((row: any, i: number) => ({
      key: `p${i}`, include: !row.error, name: row.name, ean: row.ean, brand: row.product?.brand, ncm: row.product?.ncm,
      photoUrl: row.product?.photoUrl, priceFrom: row.priceFrom, priceTo: row.priceTo,
      isMedicine: !!row.product?.isMedicine, otcConfirmed: false, note: row.error ?? row.warning,
    })));
    const until = j.rows.find((r: any) => r.validUntil)?.validUntil;
    if (until) setValidUntil(until);
    setMsg(`${j.rows.length} linhas lidas.`);
  }

  async function gerar() {
    const chosen = items.filter((i) => i.include);
    setBusy(true); setMsg(null);
    const r = await fetch('/api/promocoes/gerar', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ source: tab, items: chosen, validFrom, validUntil, formats }),
    });
    const j = await r.json(); setBusy(false);
    if (!r.ok) return setMsg(j.error);
    setMsg(`${j.created} peças criadas. ${j.waitingClient} já estão no seu painel para aprovar` +
      (j.waitingReview ? `; ${j.waitingReview} passam antes pela revisão da equipe.` : '.') +
      (j.cut ? ` ${j.cut} não couberam na cota do mês.` : ''));
    setItems([]);
  }

  const tabStyle = (on: boolean): React.CSSProperties => ({
    flex: '1 1 260px', textAlign: 'left', padding: '14px 16px', borderRadius: 14, cursor: 'pointer',
    background: on ? '#fff' : '#EEF1F5', border: on ? '2px solid #2448E0' : '1px solid #DDE2EA', font: 'inherit',
  });
  const ready = items.some((i) => i.include) && validFrom && validUntil &&
    items.filter((i) => i.include).every((i) => i.priceTo && (!i.isMedicine || i.otcConfirmed));

  return (
    <div className="pilha" style={{}}>
      <h1 style={{ margin: 0 }}>Criar promoção</h1>

      <div role="tablist" style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <button role="tab" aria-selected={tab === 'site'} style={tabStyle(tab === 'site')} onClick={() => { setTab('site'); setItems([]); }}>
          <strong>Puxar do meu site</strong><br /><span className="muted">Link do produto ou da categoria</span>
        </button>
        <button role="tab" aria-selected={tab === 'planilha'} style={tabStyle(tab === 'planilha')} onClick={() => { setTab('planilha'); setItems([]); }}>
          <strong>Planilha com EAN</strong><br /><span className="muted">Código de barras, nome e preços</span>
        </button>
      </div>

      <section className="card" style={{ display: 'grid', gap: 12 }}>
        {tab === 'site' ? (
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'end' }}>
            <div style={{ flex: '1 1 320px' }}><label htmlFor="url">Link do seu site</label><input id="url" type="url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://www.seusite.com.br/categoria" /></div>
            <button className="btn" disabled={busy || !url} onClick={buscarSite}>{busy ? 'Buscando…' : 'Buscar produtos'}</button>
          </div>
        ) : (
          <div style={{ display: 'grid', gap: 8 }}>
            <label htmlFor="file">Planilha (.xlsx ou .csv)</label>
            <input id="file" type="file" accept=".xlsx,.xls,.csv" disabled={busy} onChange={(e) => e.target.files?.[0] && enviarPlanilha(e.target.files[0])} />
            <a href="/modelo-promocao.csv" download>Baixar planilha modelo</a>
          </div>
        )}
        {msg && <p role="status" style={{ margin: 0 }}>{msg}</p>}
      </section>

      {items.length > 0 && (
        <section className="card" style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', minWidth: 760, borderCollapse: 'collapse', fontSize: 14 }}>
            <thead><tr style={{ textAlign: 'left' }}><th>Usar</th><th>Foto</th><th>Produto</th><th>De</th><th>Por</th><th>Aviso</th></tr></thead>
            <tbody>
              {items.map((it) => (
                <tr key={it.key} style={{ borderTop: '1px solid #EEF1F5' }}>
                  <td><input type="checkbox" aria-label={`Usar ${it.name}`} checked={it.include} onChange={(e) => update(it.key, { include: e.target.checked })} /></td>
                  <td>{it.photoUrl ? <img src={it.photoUrl} alt="" width={56} height={56} style={{ objectFit: 'contain' }} /> : <span className="muted">sem foto</span>}</td>
                  <td>{it.name}{it.ean && <div className="muted" style={{ fontSize: 12 }}>EAN {it.ean}</div>}</td>
                  <td><input aria-label="Preço de" style={{ width: 110 }} defaultValue={brl(it.priceFrom)} onBlur={(e) => update(it.key, { priceFrom: num(e.target.value) })} /></td>
                  <td><input aria-label="Preço por" style={{ width: 110 }} defaultValue={brl(it.priceTo)} onBlur={(e) => update(it.key, { priceTo: num(e.target.value) })} /></td>
                  <td style={{ fontSize: 13 }}>
                    {it.note && <div style={{ color: '#9A4E05' }}>{it.note}</div>}
                    {it.isMedicine && (
                      <label style={{ display: 'flex', gap: 6, alignItems: 'center', fontWeight: 600 }}>
                        <input type="checkbox" checked={it.otcConfirmed} onChange={(e) => update(it.key, { otcConfirmed: e.target.checked })} style={{ width: 'auto' }} />
                        É venda livre
                      </label>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {items.length > 0 && (
        <section className="card" style={{ display: 'grid', gap: 14 }}>
          <div className="grid">
            <div><label htmlFor="ini">Começa em</label><input id="ini" type="date" value={validFrom} onChange={(e) => setValidFrom(e.target.value)} /></div>
            <div><label htmlFor="fim">Vale até</label><input id="fim" type="date" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} /></div>
          </div>
          <fieldset style={{ border: 0, padding: 0, margin: 0, display: 'flex', gap: 16, flexWrap: 'wrap' }}>
            <legend style={{ fontWeight: 600, marginBottom: 8 }}>Formato</legend>
            {([['postPerItem', '1 post por produto'], ['storySequence', 'Stories em sequência'], ['reels', 'Reels com todos']] as const).map(([k, l]) => (
              <label key={k} style={{ display: 'flex', gap: 6, alignItems: 'center', fontWeight: 500 }}>
                <input type="checkbox" style={{ width: 'auto' }} checked={formats[k]} onChange={(e) => setFormats({ ...formats, [k]: e.target.checked })} /> {l}
              </label>
            ))}
          </fieldset>
          <button className="btn" disabled={busy || !ready} onClick={gerar}>{busy ? 'Gerando…' : 'Gerar propaganda'}</button>
          <p className="muted" style={{ margin: 0, fontSize: 13 }}>O Claude usa só os preços e a validade informados. As peças contam na cota do seu plano.</p>
        </section>
      )}
    </div>
  );
}
