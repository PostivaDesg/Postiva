// Diagnóstico: o que já está configurado e o que falta, com a correção de cada item.
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { currentProfile } from '@/lib/supabase';
import { runChecks } from '@/lib/diagnostico';

export const dynamic = 'force-dynamic';

export default async function Diagnostico({ searchParams }: { searchParams: Promise<{ canva?: string }> }) {
  const { canva } = await searchParams;
  const me = await currentProfile();
  if (me?.role !== 'gestor') redirect('/login');
  const checks = await runChecks();
  const missing = checks.filter((c) => c.required && !c.ok).length;
  const areas = Array.from(new Set(checks.map((c) => c.area)));

  return (
    <div className="pilha" style={{maxWidth: 860}}>
      <header className="cabecalho"><div><h1>Diagnóstico da configuração</h1></div></header>
      <p style={{ margin: 0, fontWeight: 600, color: missing ? '#A1281F' : 'var(--verde)' }}>
        {missing ? `${missing} itens obrigatórios faltando.` : 'Tudo o que é obrigatório está funcionando.'}
      </p>
      {canva && <p role="status" style={{ margin: 0, fontWeight: 600, color: canva === 'ok' ? 'var(--verde)' : '#A1281F' }}>{canva === 'ok' ? 'Canva conectado.' : 'Não consegui conectar o Canva. Confira o Client ID, o Client Secret e o endereço de retorno na integração.'}</p>}
      <section className="painel" style={{ display: 'flex', gap: 14, alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 320px' }}><h2 style={{ margin: 0 }}>Canva</h2><p className="muted" style={{ margin: '4px 0 0' }}>As artes das empresas com modelos do Canva são montadas lá. Autorize uma vez com a conta do Canva da Postiva.</p></div>
        <a className="btn" href="/api/canva/connect">Conectar Canva</a>
      </section>
      {areas.map((a) => (
        <section key={a} className="painel" style={{ display: 'grid', gap: 10 }}>
          <h2 style={{ margin: 0 }}>{a}</h2>
          {checks.filter((c) => c.area === a).map((c) => (
            <div key={c.item} style={{ display: 'grid', gap: 2 }}>
              <span style={{ fontWeight: 600, display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                <span className={`status ${c.ok ? 'aprovado' : c.required ? 'problema' : 'aguardando'}`}>{c.ok ? 'Funcionando' : c.required ? 'Falta' : 'Opcional'}</span>
                {c.item}
              </span>
              {!c.ok && <span className="muted" style={{ fontSize: 14 }}>{c.fix}</span>}
            </div>
          ))}
        </section>
      ))}
    </div>
  );
}
