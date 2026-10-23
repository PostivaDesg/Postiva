'use client';
// Cadastro público: a empresa cria a própria conta, escolhe o plano e começa com 7 dias de teste.
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createBrowserClient } from '@supabase/ssr';
import { PostivaLogo } from '@/components/Logo';
import { PLANS, type PlanId } from '@/lib/plans';
import { postJSON } from '@/lib/client-fetch';

const brl = (n: number | null) => (n == null ? '' : n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }));

function resumo(id: PlanId) {
  const p = PLANS[id];
  const partes = [`${p.storiesPerDay} stories por dia`];
  if (p.postsPerDay) partes.push(`${p.postsPerDay} ${p.postsPerDay === 1 ? 'post' : 'posts'} por dia`);
  partes.push(`${p.reelsPerWeek} ${p.reelsPerWeek === 1 ? 'reels' : 'reels'} por semana`);
  if (p.humanAnalysis) partes.push('análise mensal com especialista');
  return partes.join(' · ');
}

export default function Cadastro() {
  const router = useRouter();
  const [v, setV] = useState<Record<string, string>>({ plan: 'basic', billingType: 'PIX', segment: 'Farmácia' });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setV({ ...v, [k]: e.target.value });

  async function criar(e: React.FormEvent) {
    e.preventDefault();
    if (v.password !== v.password2) return setMsg('As duas senhas não são iguais.');
    setBusy(true); setMsg(null);
    const r = await postJSON('/api/cadastro', v);
    if (!r.ok) { setBusy(false); return setMsg(r.error); }
    const sb = createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
    const { error } = await sb.auth.signInWithPassword({ email: v.clientEmail.trim().toLowerCase(), password: v.password });
    if (error) { setBusy(false); return router.push('/login'); }
    router.push('/minha-marca');
    router.refresh();
  }

  const campo = (k: string, label: string, opts: { type?: string; required?: boolean; auto?: string; hint?: string } = {}) => (
    <div>
      <label htmlFor={k}>{label}{opts.required === false ? <span className="muted"> (opcional)</span> : null}</label>
      <input id={k} type={opts.type ?? 'text'} autoComplete={opts.auto} required={opts.required !== false}
        value={v[k] ?? ''} onChange={set(k)} />
      {opts.hint && <p className="muted" style={{ margin: '4px 0 0', fontSize: 13 }}>{opts.hint}</p>}
    </div>
  );

  return (
    <main className="entrada">
      <section className="lado">
        <PostivaLogo size={54} invert />
        <div>
          <h1>Comece com 7 dias grátis.</h1>
          <p>Crie a conta da sua empresa. A gente monta os posts da semana com a sua marca, você aprova pelo celular e eles saem no horário certo.</p>
        </div>
        <div />
      </section>
      <form onSubmit={criar} style={{ width: 'min(520px, 100% - 32px)' }}>
        <div><h2 style={{ fontSize: 28 }}>Criar conta</h2>
          <p className="muted" style={{ margin: '6px 0 0' }}>Já tem conta? <Link href="/login">Entrar</Link></p></div>

        <fieldset style={{ border: 0, padding: 0, margin: 0, display: 'grid', gap: 14 }}>
          <legend style={{ fontWeight: 700, marginBottom: 8 }}>Sua empresa</legend>
          {campo('name', 'Nome da empresa')}
          <div><label htmlFor="segment">Segmento</label>
            <select id="segment" value={v.segment} onChange={set('segment')}>
              {['Farmácia', 'Estética', 'Restaurante', 'Moda', 'Serviços', 'Outro'].map((s) => <option key={s}>{s}</option>)}
            </select></div>
          {campo('city', 'Cidade')}
          {campo('whatsapp', 'WhatsApp da empresa', { type: 'tel', hint: 'Vai no botão dos posts para o cliente chamar.' })}
          {campo('instagram', '@ do Instagram', { required: false })}
          {campo('siteUrl', 'Site', { type: 'url', required: false })}
        </fieldset>

        <fieldset style={{ border: 0, padding: 0, margin: 0, display: 'grid', gap: 14 }}>
          <legend style={{ fontWeight: 700, marginBottom: 8 }}>Seu acesso</legend>
          {campo('clientName', 'Seu nome', { auto: 'name' })}
          {campo('clientEmail', 'E-mail', { type: 'email', auto: 'email' })}
          {campo('password', 'Senha (8 ou mais caracteres)', { type: 'password', auto: 'new-password' })}
          {campo('password2', 'Repita a senha', { type: 'password', auto: 'new-password' })}
        </fieldset>

        <fieldset style={{ border: 0, padding: 0, margin: 0, display: 'grid', gap: 10 }}>
          <legend style={{ fontWeight: 700, marginBottom: 8 }}>Plano</legend>
          {(Object.keys(PLANS) as PlanId[]).map((id) => (
            <label key={id} style={{ display: 'flex', gap: 12, alignItems: 'flex-start', padding: 12, borderRadius: 12, cursor: 'pointer',
              border: `2px solid ${v.plan === id ? 'var(--tinta, #2E2A6B)' : 'var(--linha, #E3E1EE)'}` }}>
              <input type="radio" name="plan" value={id} checked={v.plan === id} onChange={set('plan')} style={{ marginTop: 4 }} />
              <span><strong>{PLANS[id].name} · {brl(PLANS[id].priceBRL)}/mês</strong><br /><span className="muted" style={{ fontSize: 14 }}>{resumo(id)}</span></span>
            </label>
          ))}
          <div><label htmlFor="billing">Pagamento depois do teste</label>
            <select id="billing" value={v.billingType} onChange={set('billingType')}>
              <option value="PIX">Pix</option><option value="CREDIT_CARD">Cartão de crédito</option>
            </select></div>
          {campo('cpfCnpj', 'CPF ou CNPJ', { hint: 'Para emitir a cobrança e a nota fiscal. Nada é cobrado nos 7 dias de teste.' })}
        </fieldset>

        {/* campo escondido contra robôs */}
        <input type="text" name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" value={v.website ?? ''} onChange={set('website')}
          style={{ position: 'absolute', left: '-9999px', width: 1, height: 1, opacity: 0 }} />

        {msg && <p role="alert" style={{ margin: 0, color: 'var(--vermelho, #C62828)' }}>{msg}</p>}
        <button className="btn" disabled={busy}>{busy ? 'Criando sua conta…' : 'Criar conta e começar o teste'}</button>
      </form>
    </main>
  );
}
