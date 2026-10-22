'use client';
// Cadastro de empresa nova pelo gestor.
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

const FIELDS: [string, string, string?][] = [
  ['name', 'Nome da empresa'], ['segment', 'Segmento (ex.: Farmácia, Estética, Restaurante)'],
  ['city', 'Cidade'], ['instagram', '@ do Instagram'], ['siteUrl', 'Site (para promoções)', 'url'],
  ['whatsapp', 'WhatsApp da empresa (para o botão dos posts)', 'tel'],
  ['clientName', 'Nome do responsável'], ['clientEmail', 'E-mail de login do cliente', 'email'],
  ['cpfCnpj', 'CPF ou CNPJ (cobrança)'], ['tempPassword', 'Senha provisória (8+ caracteres)', 'text'],
];

export default function NovaEmpresa() {
  const router = useRouter();
  const [v, setV] = useState<Record<string, string>>({ plan: 'basic', billingType: 'PIX' });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setMsg(null);
    const r = await fetch('/api/gestor/companies', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(v) });
    const j = await r.json();
    setBusy(false);
    if (!r.ok) return setMsg(j.error);
    if (j.warnings?.length) alert(`Empresa criada, com avisos:\n\n- ${j.warnings.join('\n- ')}`);
    router.push(`/gestor/${j.companyId}`);
  }

  return (
    <div className="pilha" style={{maxWidth: 720}}>
      <h1 style={{ margin: 0 }}>Nova empresa</h1>
      <p className="muted" style={{ margin: 0 }}>O perfil do Claude já começa com o modelo do segmento. O cliente completa o resto em "Minha marca".</p>
      <form onSubmit={salvar} className="card" style={{ display: 'grid', gap: 14 }}>
        {FIELDS.map(([k, label, type]) => (
          <div key={k}><label htmlFor={k}>{label}</label>
            <input id={k} type={type ?? 'text'} required={['name', 'clientEmail', 'clientName', 'cpfCnpj', 'tempPassword'].includes(k)}
              value={v[k] ?? ''} onChange={(e) => setV({ ...v, [k]: e.target.value })} />
          </div>
        ))}
        <div className="grid">
          <div><label htmlFor="plan">Plano</label>
            <select id="plan" value={v.plan} onChange={(e) => setV({ ...v, plan: e.target.value })} >
              <option value="basic">Basic – R$ 400</option><option value="intermediario">Intermediário – R$ 600</option>
              <option value="avancado">Avançado – R$ 800</option><option value="pleno">Pleno – R$ 1.000</option>
            </select></div>
          <div><label htmlFor="billing">Pagamento</label>
            <select id="billing" value={v.billingType} onChange={(e) => setV({ ...v, billingType: e.target.value })} >
              <option value="PIX">Pix</option><option value="CREDIT_CARD">Cartão de crédito</option>
            </select></div>
        </div>
        {msg && <p role="alert" style={{ color: 'var(--vermelho)', margin: 0 }}>{msg}</p>}
        <button className="btn" disabled={busy}>{busy ? 'Criando…' : 'Criar empresa'}</button>
      </form>
    </div>
  );
}
