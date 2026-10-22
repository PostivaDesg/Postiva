'use client';
// Minha marca: cadastro completo, identidade visual (logo, cores, exemplos), modelo desenhado pelo Claude,
// Drive vinculado e envio de fotos.
import { readJSON } from '@/lib/client-fetch';
import { useEffect, useState } from 'react';
import Link from 'next/link';

type Field = [string, string, ('text' | 'area' | 'email' | 'tel' | 'url')?, string?];
const SECTIONS: { title: string; fields: Field[] }[] = [
  { title: 'Empresa', fields: [
    ['legal_name', 'Razão social'], ['cnpj', 'CNPJ'], ['contact_name', 'Responsável'],
    ['contact_email', 'E-mail para avisos', 'email'], ['whatsapp', 'WhatsApp de pedidos (vai no botão dos posts)', 'tel'],
    ['address', 'Endereço completo'], ['opening_hours', 'Horário de funcionamento', 'text', 'Ex.: seg a sáb, 8h às 20h'],
    ['site_url', 'Site ou loja virtual (as fotos dos seus produtos são buscadas nele)', 'url', 'https://'], ['instagram', '@ do Instagram'],
  ] },
  { title: 'Conteúdo', fields: [
    ['objective', 'Objetivo principal no Instagram', 'text', 'Ex.: vender mais, levar pedidos ao WhatsApp, fortalecer a marca'],
    ['audience', 'Quem é o seu cliente?', 'area', 'Idade, bairro, o que procura'],
    ['products', 'Produtos ou serviços e preços', 'area', 'Um por linha. Ex.: Limpeza de pele – R$ 150'],
    ['competitors', 'Principais concorrentes', 'area', 'Só para o Claude saber; nunca são citados'],
    ['forbidden', 'O que nunca pode ser dito ou mostrado', 'area'],
    ['hashtags', 'Hashtags fixas da marca', 'text', 'Ex.: #SuaMarca #SuaCidade'],
  ] },
];

const KINDS: Record<string, string> = { logo: 'Logo', referencia: 'Exemplo', loja: 'Loja', equipe: 'Equipe', produto: 'Produto', outro: 'Outro' };

// O gestor abre a marca de um cliente com /minha-marca?companyId=...
const cidParam = () => (typeof window === 'undefined' ? '' : new URLSearchParams(window.location.search).get('companyId') ?? '');
const withCid = (url: string) => { const c = cidParam(); return c ? `${url}${url.includes('?') ? '&' : '?'}companyId=${c}` : url; };

export default function MinhaMarca() {
  const [v, setV] = useState<Record<string, string>>({});
  const [colors, setColors] = useState<string[]>(['#2448E0', '#F2B705']);
  const [assets, setAssets] = useState<{ id: string; kind: string; source: string; name: string; url?: string | null }[]>([]);
  const [driveEmail, setDriveEmail] = useState<string | null>(null);
  const [driveUrl, setDriveUrl] = useState('');
  const [linked, setLinked] = useState(false);
  const [kind, setKind] = useState('loja');
  const [model, setModel] = useState<{ status: string; notes: string | null; previews: { layout: string; url: string }[] }>({ status: 'pendente', notes: null, previews: [] });
  const [feedback, setFeedback] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  async function load() {
    const r = await fetch(withCid('/api/marca')).catch(() => null); const j = r ? await readJSON(r) : { error: 'Sem conexão com o servidor. Tente de novo.' };
    if (!r?.ok) return setMsg(j.error);
    const c = j.company ?? {};
    setV(Object.fromEntries(Object.entries(c).filter(([, x]) => !Array.isArray(x)).map(([k, x]) => [k, x == null ? '' : String(x)])));
    if (c.brand_colors?.length) setColors(c.brand_colors);
    setAssets(j.assets ?? []); setDriveEmail(j.driveEmail); setLinked(!!c.drive_folder_id);
    const m = await fetch(withCid('/api/marca/modelo')).then(readJSON).catch(() => ({}));
    if (m.previews) setModel(m);
  }
  useEffect(() => { load(); }, []);

  async function call(tag: string, url: string, init: RequestInit, ok: (j: any) => string) {
    setBusy(tag); setMsg(null);
    const r = await fetch(url, init).catch(() => null); const j = r ? await readJSON(r) : { error: 'Sem conexão com o servidor. Tente de novo.' }; setBusy(null);
    setMsg(r?.ok ? ok(j) : j.error);
    if (r?.ok) await load();
    return r?.ok ? j : null;
  }
  const json = (body: object): RequestInit => ({ method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...body, companyId: cidParam() || undefined }) });
  const salvar = (e?: React.FormEvent) => { e?.preventDefault(); return call('salvar', '/api/marca', json({ ...v, brand_colors: colors.join(',') }), () => 'Dados salvos.'); };
  const vincular = () => call('drive', '/api/marca/drive', json({ url: driveUrl }), (j) => `Pasta vinculada. ${j.images} imagens encontradas.`);
  const enviar = (files: FileList, k: string) => {
    const form = new FormData(); form.append('kind', k); if (cidParam()) form.append('companyId', cidParam());
    Array.from(files).forEach((f) => form.append('files', f));
    return call('upload', '/api/marca/upload', { method: 'POST', body: form }, (j) => `${j.saved} arquivos enviados.${j.errors?.length ? ' ' + j.errors.join(' ') : ''}`);
  };
  async function desenhar(again: boolean) {
    await salvar();
    const j = await call('modelo', '/api/marca/modelo', json({ action: 'desenhar', feedback: again ? feedback : undefined }),
      () => 'Modelo pronto! Veja a prévia abaixo.');
    if (j) { setModel(j); setFeedback(''); }
  }
  const aprovar = () => call('aprovar', '/api/marca/modelo', json({ action: 'aprovar' }), () => 'Modelo aprovado. Todos os próximos posts usam ele.');

  const count = (k: string) => assets.filter((a) => a.kind === k).length;
  const checks = [count('logo') > 0, colors.length > 0, count('referencia') > 0, model.status === 'aprovado',
    ['loja', 'equipe', 'produto'].some((k) => count(k) > 0), !!(v.whatsapp && v.address), !!(v.products && v.audience)];
  const done = checks.filter(Boolean).length;

  return (
    <div className="pilha" style={{ maxWidth: 980 }}>
      <header className="cabecalho">
        <div>
          <h1>Minha marca</h1>
          <p>Quanto mais completo, mais os posts ficam com a cara da sua empresa. Você pode voltar aqui quando quiser.</p>
        </div>
        <div className="medidor" style={{ minWidth: 240 }}>
          <div><span>Marca preenchida</span><span className="muted">{done} de {checks.length}</span></div>
          <progress max={checks.length} value={done} aria-label={`Marca preenchida: ${done} de ${checks.length}`} />
        </div>
      </header>
      {msg && <p role="status" className="painel" style={{ margin: 0, padding: '12px 16px', position: 'sticky', top: 12, zIndex: 5, borderColor: 'var(--fucsia)', boxShadow: '0 8px 24px rgba(23,21,59,.12)' }}>{msg}</p>}

      <section className="painel pilha" style={{ gap: 16 }}>
        <div className="painel-titulo" style={{ marginBottom: 0 }}><div><h2>Identidade visual</h2><p>O logo, as cores e os exemplos são a base do seu modelo exclusivo.</p></div></div>
        <div className="grid">
          <div><label htmlFor="logo">Logo (PNG com fundo transparente, de preferência)</label>
            <input id="logo" type="file" accept="image/png,image/jpeg" disabled={!!busy} onChange={(e) => e.target.files?.length && enviar(e.target.files, 'logo')} />
            <p style={{ fontSize: 13, margin: '6px 0 0' }}>{count('logo') ? <span className="status aprovado">Logo enviado</span> : <span className="status aguardando">Nenhum logo ainda</span>}</p></div>
          <div><span style={{ fontWeight: 600, fontSize: 14, display: 'block', marginBottom: 6 }}>Cores da marca (até 4)</span>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              {colors.map((c, i) => (
                <input key={i} type="color" aria-label={`Cor ${i + 1}`} value={c} style={{ width: 52, height: 46, padding: 3, borderRadius: 12 }}
                  onChange={(e) => setColors(colors.map((x, j) => (j === i ? e.target.value.toUpperCase() : x)))} />
              ))}
              {colors.length < 4 && <button type="button" className="btn ghost pequeno" onClick={() => setColors([...colors, '#FFFFFF'])}>Adicionar cor</button>}
              {colors.length > 1 && <button type="button" className="btn ghost pequeno" onClick={() => setColors(colors.slice(0, -1))}>Remover a última</button>}
            </div></div>
        </div>
        <div><label htmlFor="ref">Tem algum exemplo que gostaria de seguir? Deixe o link do Instagram aqui</label>
          <input id="ref" placeholder="https://instagram.com/perfil-que-voce-admira" value={v.reference_instagram ?? ''} onChange={(e) => setV({ ...v, reference_instagram: e.target.value })} /></div>
        <div><label htmlFor="prints">E envie 3 a 5 prints de posts que você gosta (são eles que guiam o desenho do seu modelo)</label>
          <input id="prints" type="file" multiple accept="image/png,image/jpeg" disabled={!!busy} onChange={(e) => e.target.files?.length && enviar(e.target.files, 'referencia')} />
          <p className="muted" style={{ fontSize: 13, margin: '6px 0 0' }}>{count('referencia')} exemplos enviados.</p></div>
        <button className="btn" disabled={!!busy} onClick={() => desenhar(false)} style={{ justifySelf: 'start' }}>
          {busy === 'modelo' ? 'Desenhando seu modelo…' : model.previews.length ? 'Desenhar de novo do zero' : 'Desenhar meu modelo'}
        </button>
      </section>

      {model.previews.length > 0 && (
        <section className="painel pilha" style={{ gap: 14 }} aria-label="Prévia do modelo">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <h2 style={{ margin: 0 }}>Seu modelo</h2>
            <span className={`status ${model.status === 'aprovado' ? 'aprovado' : 'aguardando'}`}>{model.status === 'aprovado' ? 'Aprovado' : 'Esperando sua aprovação'}</span>
          </div>
          {model.notes && <p className="muted" style={{ margin: 0 }}>{model.notes}</p>}
          <div style={{ display: 'grid', gap: 10, gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))' }}>
            {model.previews.map((p) => <img key={p.url} src={p.url} alt={`Exemplo do layout ${p.layout}`} loading="lazy" style={{ width: '100%', borderRadius: 14, border: '1px solid var(--linha)' }} />)}
          </div>
          <p className="muted" style={{ margin: 0, fontSize: 13 }}>Os textos são de exemplo. As duas últimas mostram como ficam as datas comemorativas.</p>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'end' }}>
            {model.status !== 'aprovado' && <button className="btn ok" disabled={!!busy} onClick={aprovar}>Aprovar este modelo</button>}
            <div style={{ flex: '1 1 280px' }}><label htmlFor="fb">Quer mudar algo?</label>
              <input id="fb" value={feedback} onChange={(e) => setFeedback(e.target.value)} placeholder="Ex.: mais moderno, menos texto, usar mais o azul" /></div>
            <button className="btn ghost" disabled={!!busy || !feedback.trim()} onClick={() => desenhar(true)}>Pedir outra versão</button>
          </div>
        </section>
      )}

      <form onSubmit={salvar} style={{ display: 'grid', gap: 20 }}>
        {SECTIONS.map((s) => (
          <section key={s.title} className="painel pilha" style={{ gap: 14 }}>
            <h2 style={{ margin: 0 }}>{s.title}</h2>
            {s.fields.map(([k, label, type, ph]) => (
              <div key={k}><label htmlFor={k}>{label}</label>
                {type === 'area'
                  ? <textarea id={k} rows={4} placeholder={ph} value={v[k] ?? ''} onChange={(e) => setV({ ...v, [k]: e.target.value })} />
                  : <input id={k} type={type ?? 'text'} placeholder={ph} value={v[k] ?? ''} onChange={(e) => setV({ ...v, [k]: e.target.value })} />}
              </div>
            ))}
          </section>
        ))}
        <section className="painel pilha" style={{ gap: 10 }}>
          <h2 style={{ margin: 0 }}>Aprovação</h2>
          <label htmlFor="auto">Se eu não responder, aprovar sozinho depois de:</label>
          <select id="auto" value={v.auto_approve_hours ?? ''} onChange={(e) => setV({ ...v, auto_approve_hours: e.target.value })}> 
            <option value="">Nunca (só publica o que eu aprovar)</option>
            <option value="24">24 horas</option><option value="48">48 horas</option><option value="72">72 horas</option>
          </select>
          <p className="muted" style={{ margin: 0, fontSize: 13 }}>Evita perder o horário do post quando você estiver sem tempo de olhar o painel.</p>
        </section>
        <button className="btn" disabled={!!busy} style={{ justifySelf: 'start' }}>Salvar dados</button>
      </form>

      <section className="painel pilha" style={{ gap: 12 }}>
        <h2 style={{ margin: 0 }}>Google Drive {linked && <span className="badge" style={{ background: '#E5F5EC', color: 'var(--verde)' }}>Vinculado</span>}</h2>
        <ol style={{ margin: 0, paddingLeft: 18, lineHeight: 1.7 }}>
          <li>Crie uma pasta no seu Drive com fotos da loja, da equipe e dos produtos.</li>
          <li>Clique em Compartilhar e adicione <strong>{driveEmail ?? 'o e-mail da Postiva Design'}</strong> como Leitor.</li>
          <li>Copie o link da pasta e cole abaixo.</li>
        </ol>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'end' }}>
          <div style={{ flex: '1 1 320px' }}><label htmlFor="drive">Link da pasta</label><input id="drive" value={driveUrl} onChange={(e) => setDriveUrl(e.target.value)} placeholder="https://drive.google.com/drive/folders/…" /></div>
          <button className="btn" disabled={!!busy || !driveUrl} onClick={vincular} type="button">{linked ? 'Atualizar' : 'Vincular'}</button>
        </div>
        <p className="muted" style={{ margin: 0, fontSize: 13 }}>Fotos novas na pasta entram nos próximos posts. A Postiva Design só lê; nada é apagado do seu Drive.</p>
      </section>

      <section className="painel pilha" style={{ gap: 12 }}>
        <div className="painel-titulo" style={{ marginBottom: 0 }}><div><h2>Fotos da sua empresa</h2><p>Fotos reais deixam os posts com a cara da sua loja. Em foto de produto, o nome do arquivo vira o nome do produto (ex.: "Vitamina C 1g.jpg").</p></div></div>
        <div className="grid">
          <div><label htmlFor="kind">Tipo</label>
            <select id="kind" value={kind} onChange={(e) => setKind(e.target.value)}> 
              <option value="loja">Loja, fachada ou balcão</option><option value="equipe">Equipe</option>
              <option value="produto">Produto (nome do arquivo = nome do produto)</option><option value="outro">Outro</option>
            </select></div>
          <div><label htmlFor="files">Imagens (PNG ou JPG, até 6 MB cada)</label>
            <input id="files" type="file" multiple accept="image/png,image/jpeg" disabled={!!busy} onChange={(e) => e.target.files?.length && enviar(e.target.files, kind)} /></div>
        </div>
        <p className="muted" style={{ margin: 0 }}>{assets.length} arquivos na sua marca ({assets.filter((a) => a.source === 'drive').length} do Drive).</p>
        {assets.some((a) => a.url) && (
          <div style={{ display: 'grid', gap: 10, gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))' }}>
            {assets.filter((a) => a.url).slice(0, 40).map((a) => (
              <figure key={a.id} style={{ margin: 0, display: 'grid', gap: 4 }}>
                <img src={a.url!} alt={a.name} loading="lazy" style={{ width: '100%', aspectRatio: '1', objectFit: a.kind === 'logo' ? 'contain' : 'cover', borderRadius: 12, border: '1px solid var(--linha)', background: '#fff' }} />
                <figcaption style={{ fontSize: 12 }}><span className="status">{KINDS[a.kind] ?? a.kind}</span></figcaption>
              </figure>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
