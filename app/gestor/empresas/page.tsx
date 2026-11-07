// Empresas: plano, pagamento, modelo, receita, custos e margem do mês.
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { currentProfile, supabaseAdmin } from '@/lib/supabase';
import { companyEconomics, HOURLY, FIXED } from '@/lib/gestor-data';
import { brl } from '@/lib/ui';
import { MOTIVOS_INATIVA, motivoInativa, parseMotivo } from '@/lib/inativa';

export const dynamic = 'force-dynamic';
const PAG: Record<string, string> = { ativa: 'Em dia', teste: 'Em teste', atrasada: 'Atrasada', cancelada: 'Cancelada' };

// Liga/desliga a produção de uma empresa: as rotinas agendadas só fazem artes de empresa ativa
async function alternarAtiva(form: FormData) {
  'use server';
  const me = await currentProfile();
  if (me?.role !== 'gestor') return;
  const id = String(form.get('id') ?? '');
  if (!id) return;
  const ligar = form.get('ativa') === 'true';
  await supabaseAdmin().from('companies').update(ligar
    ? { ativa: true, motivo_inativa: null, nota_inativa: null, inativa_desde: null }
    : { ativa: false, motivo_inativa: parseMotivo(form.get('motivo')), inativa_desde: new Date().toISOString() },
  ).eq('id', id);
  revalidatePath('/gestor/empresas');
  revalidatePath(`/gestor/${id}`);
}

export default async function Empresas() {
  const me = await currentProfile();
  if (me?.role !== 'gestor') redirect('/login');
  const { rows, total } = await companyEconomics();
  return (
    <div className="pilha">
      <header className="cabecalho">
        <div><h1>Empresas</h1><p>{rows.length} {rows.length === 1 ? 'empresa' : 'empresas'}. Margem = receita − IA − horas de revisão (R$ {HOURLY}/h) − parte dos custos fixos ({brl(FIXED)} divididos entre as pagantes).</p></div>
        <div className="acoes"><Link className="btn" href="/gestor/nova">Nova empresa</Link></div>
      </header>
      <section className="painel rolagem" aria-label="Lista de empresas">
        <table className="tabela" style={{ minWidth: 860 }}>
          <thead><tr><th>Empresa</th><th>Produção</th><th>Plano</th><th>Pagamento</th><th>Modelo visual</th><th className="num">Receita</th><th className="num">IA</th><th className="num">Revisão</th><th className="num">Margem</th><th className="num">Contatos</th><th></th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.c.id}>
                <td><strong>{r.c.name}</strong><div className="muted" style={{ fontSize: 13 }}>{r.c.city ?? ''}</div></td>
                <td>
                  <form action={alternarAtiva} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <input type="hidden" name="id" value={r.c.id} />
                    <input type="hidden" name="ativa" value={r.c.ativa === false ? 'true' : 'false'} />
                    <span className={`status ${r.c.ativa === false ? 'cancelada' : 'aprovado'}`} title={r.c.ativa === false ? motivoInativa(r.c.motivo_inativa).label : undefined}>{r.c.ativa === false ? 'Desativada' : 'Ativa'}</span>
                    {r.c.ativa !== false && (
                      <select name="motivo" aria-label={`Motivo para desativar ${r.c.name}`} defaultValue="falta_pagamento" style={{ width: 'auto', padding: '4px 8px', fontSize: 13 }}>
                        {Object.entries(MOTIVOS_INATIVA).map(([k, m]) => <option key={k} value={k}>{m.label}</option>)}
                      </select>
                    )}
                    <button className="btn ghost pequeno">{r.c.ativa === false ? 'Ativar' : 'Desativar'}</button>
                  </form>
                </td>
                <td>{r.plan}</td>
                <td><span className={`status ${r.status}`}>{PAG[r.status] ?? r.status}</span></td>
                <td>{r.c.template_status === 'aprovado' ? <span className="status aprovado">Aprovado</span> : <span className="status aguardando">Pendente</span>}</td>
                <td className="num">{brl(r.revenue)}</td>
                <td className="num">{brl(r.ai)}</td>
                <td className="num">{r.hours.toFixed(1)} h</td>
                <td className="num" style={{ fontWeight: 650, color: r.margin < 0 ? 'var(--vermelho)' : undefined }}>{brl(r.margin)}</td>
                <td className="num">{r.clicks}</td>
                <td><Link className="btn ghost pequeno" href={`/gestor/${r.c.id}`}>Abrir</Link></td>
              </tr>
            ))}
          </tbody>
          <tfoot><tr><td colSpan={5}><strong>Total do mês</strong></td><td className="num"><strong>{brl(total.revenue)}</strong></td><td className="num">{brl(total.ai)}</td><td></td><td className="num"><strong>{brl(total.margin)}</strong></td><td className="num">{total.clicks}</td><td></td></tr></tfoot>
        </table>
      </section>
    </div>
  );
}
