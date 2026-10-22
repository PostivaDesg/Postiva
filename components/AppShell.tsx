// Casca de todas as páginas logadas: barra lateral escura (no celular, barra no topo com menu).
// O menu muda conforme quem entrou: gestor (todas as empresas) ou cliente (a própria empresa).
import type { ReactNode } from 'react';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { currentProfile, supabaseAdmin } from '@/lib/supabase';
import NavLinks, { type NavItem } from './NavLinks';
import SignOut from './SignOut';
import { Icon } from './icons';

export default async function AppShell({ children }: { children: ReactNode }) {
  const me = await currentProfile();
  if (!me) redirect('/login');
  const db = supabaseAdmin();

  let items: NavItem[];
  let who: string;
  let sub: string;
  if (me.role === 'gestor') {
    const [{ count: fila }, { count: empresas }] = await Promise.all([
      db.from('posts').select('id', { count: 'exact', head: true }).eq('status', 'rascunho'),
      db.from('companies').select('id', { count: 'exact', head: true }),
    ]);
    items = [
      { href: '/gestor', label: 'Visão geral', icon: <Icon.inicio /> },
      { href: '/gestor/revisao', label: 'Fila de revisão', icon: <Icon.fila />, count: fila ?? 0 },
      { href: '/gestor/empresas', label: `Empresas (${empresas ?? 0})`, icon: <Icon.empresas /> },
      { href: '/gestor/nova', label: 'Nova empresa', icon: <Icon.nova /> },
      { href: '/gestor/diagnostico', label: 'Diagnóstico', icon: <Icon.diagnostico />, group: 'Sistema' },
    ];
    who = me.full_name ?? 'Gestor';
    sub = 'Gestor da Postiva';
  } else {
    if (!me.company_id) redirect('/login?erro=sem-empresa');
    const [{ data: company }, { count: pend }] = await Promise.all([
      db.from('companies').select('name').eq('id', me.company_id!).single(),
      db.from('posts').select('id', { count: 'exact', head: true }).eq('company_id', me.company_id!).eq('status', 'aguardando'),
    ]);
    items = [
      { href: '/painel', label: 'Início', icon: <Icon.inicio /> },
      { href: '/painel/aprovar', label: 'Aprovar posts', icon: <Icon.aprovar />, count: pend ?? 0 },
      { href: '/painel/calendario', label: 'Calendário', icon: <Icon.calendario /> },
      { href: '/promocoes', label: 'Criar promoção', icon: <Icon.promocao />, group: 'Pedir' },
      { href: '/pedido', label: 'Pedido rápido', icon: <Icon.pedido /> },
      { href: '/minha-marca', label: 'Minha marca', icon: <Icon.marca />, group: 'Sua conta' },
      { href: '/relatorio', label: 'Relatório do mês', icon: <Icon.relatorio /> },
      { href: '/conta', label: 'Senha e acesso', icon: <Icon.conta /> },
    ];
    who = company?.name ?? 'Minha empresa';
    sub = me.full_name ?? '';
  }

  const marca = <Link href={me.role === 'gestor' ? '/gestor' : '/painel'} className="marca" aria-label="Postiva Design, início"><b>postiva</b><i /><span>design</span></Link>;
  return (
    <div className="shell">
      <aside className="sidebar">
        {marca}
        <NavLinks items={items} />
        <div className="quem"><strong>{who}</strong>{sub && <span>{sub}</span>}<SignOut /></div>
      </aside>
      <header className="topo-movel">
        {marca}
        <details>
          <summary>Menu</summary>
          <NavLinks items={items} />
        </details>
      </header>
      <main className="conteudo">{children}</main>
    </div>
  );
}
