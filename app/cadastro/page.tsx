'use client';
// Cadastro público: a empresa cria a própria conta, escolhe o plano e começa com 7 dias de teste.
import { useEffect, useState } from 'react';
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
  if (p.extras) partes.push(...p.extras.map((e) => e.toLowerCase()));
  return partes.join(' · ');
}

export default function Cadastro() {
  const router = useRouter();
  const [v, setV] = useState<Record<string, string>>({ plan: 'basic', segment: 'Farmácia' });
  const [busy, setBusy] = useState(false);
  // plano escolhido na página inicial (/cadastro?plano=avancado)
  useEffect(() => {
    const pl = new URLSearchParams(window.location.search).get('plano');
    if (pl && pl in PLANS) setV((old) => ({ ...old, plan: pl }));
  }, []);
  const [msg, setMsg] = useState<string | null>(null);
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setV({ ...v, [k]: e.target.value });

  async function criar(e: React.FormEvent) {
    e.preventDefault();
    if (v.password !== v.password2) return setMsg('As duas senhas não são iguais.');
    setBusy(true); setMsg(null);
    const r = await postJSON('/api/cadastro', { ...v, acceptedTerms: v.acceptedTerms === 'true' });
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
          {campo('siteUrl', 'Site ou catálogo on-line', { type: 'url', required: false, hint: 'Se tiver, usamos as fotos e os preços dos produtos nas artes.' })}
        </fieldset>

        <fieldset style={{ border: 0, padding: 0, margin: 0, display: 'grid', gap: 14 }}>
          <legend style={{ fontWeight: 700, marginBottom: 8 }}>Sobre o seu negócio</legend>
          <p className="muted" style={{ margin: 0, fontSize: 13.5 }}>Com isso as artes do teste já saem com a cara da sua empresa.</p>
          {campo('address', 'Endereço (rua, número e bairro)', { auto: 'street-address' })}
          {campo('openingHours', 'Horário de funcionamento', { hint: 'Ex.: Seg a sáb, 8h às 22h; domingo, 8h às 14h' })}
          <div><label htmlFor="delivery">Como o cliente compra</label>
            <select id="delivery" value={v.delivery ?? ''} onChange={set('delivery')} required>
              <option value="" disabled>Escolha</option>
              <option>Presencial e WhatsApp</option><option>Presencial, WhatsApp e entrega</option>
              <option>Presencial, WhatsApp, entrega e iFood</option><option>Só presencial</option>
            </select></div>
          <div><label htmlFor="products">Os 3 produtos ou serviços que mais vendem</label>
            <textarea id="products" rows={2} required value={v.products ?? ''} onChange={(e) => setV({ ...v, products: e.target.value })}
              placeholder="Ex.: fraldas, dipirona, protetor solar" /></div>
          {campo('audience', 'Quem é o seu cliente', { required: false, hint: 'Ex.: famílias do bairro, idosos, turistas no verão' })}
        </fieldset>

        <fieldset style={{ border: 0, padding: 0, margin: 0, display: 'grid', gap: 14 }}>
          <legend style={{ fontWeight: 700, marginBottom: 8 }}>Seu acesso</legend>
          {campo('clientName', 'Seu nome', { auto: 'name' })}
          {campo('clientEmail', 'E-mail', { type: 'email', auto: 'email' })}
          {campo('password', 'Senha (8 ou mais caracteres)', { type: 'password', auto: 'new-password' })}
          {campo('password2', 'Repita a senha', { type: 'password', auto: 'new-password' })}
        </fieldset>

        <fieldset style={{ border: 0, padding: 0, margin: 0, display: 'grid', gap: 10 }}>
          <legend style={{ fontWeight: 700, marginBottom: 8 }}>Plano para testar</legend>
          {(Object.keys(PLANS) as PlanId[]).map((id) => (
            <label key={id} style={{ display: 'flex', gap: 12, alignItems: 'flex-start', padding: 12, borderRadius: 12, cursor: 'pointer',
              border: `2px solid ${v.plan === id ? 'var(--tinta, #2E2A6B)' : 'var(--linha, #E3E1EE)'}` }}>
              <input type="radio" name="plan" value={id} checked={v.plan === id} onChange={set('plan')} style={{ marginTop: 4 }} />
              <span><strong>{PLANS[id].name} · {brl(PLANS[id].priceBRL)}/mês</strong>{PLANS[id].badge && <span className="plano-selo" style={{ marginLeft: 8 }}>{PLANS[id].badge}</span>}<br /><span className="muted" style={{ fontSize: 14 }}>{resumo(id)}</span></span>
            </label>
          ))}
          <p className="muted" style={{ margin: 0, fontSize: 13.5 }}>Escolha o plano para testar. Nos 7 dias você não paga nada e não precisa de cartão; no fim do teste você confirma o plano e faz o pagamento.</p>
        </fieldset>

        {/* campo escondido contra robôs */}
        <input type="text" name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" value={v.website ?? ''} onChange={set('website')}
          style={{ position: 'absolute', left: '-9999px', width: 1, height: 1, opacity: 0 }} />

        <label style={{ display: 'flex', gap: 10, alignItems: 'flex-start', fontWeight: 500 }}>
          <input type="checkbox" required checked={v.acceptedTerms === 'true'} onChange={(e) => setV({ ...v, acceptedTerms: e.target.checked ? 'true' : '' })} style={{ width: 'auto', marginTop: 4 }} />
          <span>Li e aceito os <Link href="/termos" target="_blank">Termos de uso</Link> e a <Link href="/privacidade" target="_blank">Política de privacidade</Link>.</span>
        </label>

        {msg && <p role="alert" style={{ margin: 0, color: 'var(--vermelho, #C62828)' }}>{msg}</p>}
        <button className="btn" disabled={busy}>{busy ? 'Criando sua conta…' : 'Começar meus 7 dias grátis'}</button>
      </form>
    </main>
  );
}
