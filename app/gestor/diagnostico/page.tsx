// Diagnóstico: o que já está configurado e o que falta, com a correção de cada item.
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { currentProfile } from '@/lib/supabase';
import { runChecks } from '@/lib/diagnostico';

export const dynamic = 'force-dynamic';

export default async function Diagnostico() {
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
