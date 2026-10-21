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
    <main className="wrap" style={{ maxWidth: 860, display: 'grid', gap: 16 }}>
      <Link href="/gestor">← Todas as empresas</Link>
      <h1 style={{ margin: 0 }}>Diagnóstico da configuração</h1>
      <p style={{ margin: 0, fontWeight: 600, color: missing ? '#A1281F' : '#17704A' }}>
        {missing ? `${missing} itens obrigatórios faltando.` : 'Tudo o que é obrigatório está funcionando.'}
      </p>
      {areas.map((a) => (
        <section key={a} className="card" style={{ display: 'grid', gap: 10 }}>
          <h2 style={{ margin: 0, fontSize: 18 }}>{a}</h2>
          {checks.filter((c) => c.area === a).map((c) => (
            <div key={c.item} style={{ display: 'grid', gap: 2 }}>
              <span style={{ fontWeight: 600 }}>
                <span aria-hidden="true" style={{ color: c.ok ? '#17704A' : c.required ? '#A1281F' : '#9A4E05' }}>{c.ok ? '✓' : c.required ? '✗' : '○'}</span>{' '}
                {c.item}{!c.required && <span className="muted" style={{ fontWeight: 400 }}> (opcional)</span>}
              </span>
              {!c.ok && <span className="muted" style={{ fontSize: 14 }}>{c.fix}</span>}
            </div>
          ))}
        </section>
      ))}
    </main>
  );
}
