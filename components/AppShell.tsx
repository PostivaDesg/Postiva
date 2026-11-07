// Casca de todas as páginas logadas: barra lateral escura (no celular, barra no topo com menu).
// O menu muda conforme quem entrou: gestor (todas as empresas) ou cliente (a própria empresa).
import type { ReactNode } from 'react';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { currentProfile, supabaseAdmin } from '@/lib/supabase';
import NavLinks, { type NavItem } from './NavLinks';
import SignOut from './SignOut';
import { Icon } from './icons';
import { PostivaLogo } from './Logo';
import { motivoInativa } from '@/lib/inativa';
import { trialDaysLeft, trialExpired } from '@/lib/trial';
import AvisoPlanos from './AvisoPlanos';

export default async function AppShell({ children }: { children: ReactNode }) {
  const me = await currentProfile();
  if (!me) redirect('/login');
  const db = supabaseAdmin();

  let items: NavItem[];
  let who: string;
  let sub: string;
  let aviso: ReactNode = null; // cliente com empresa desativada ou teste vencido: aviso grande por cima de tudo
  let faixa: ReactNode = null; // dias que faltam do teste grátis
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
      { href: '/gestor/planos', label: 'Planos e valores', icon: <Icon.relatorio /> },
    ];
    who = me.full_name ?? 'Gestor';
    sub = 'Gestor da Postiva';
  } else {
    if (!me.company_id) redirect('/login?erro=sem-empresa');
    const [{ data: company }, { count: pend }, { data: assin }] = await Promise.all([
      db.from('companies').select('name, plan, ativa, motivo_inativa, nota_inativa').eq('id', me.company_id!).single(),
      db.from('posts').select('id', { count: 'exact', head: true }).eq('company_id', me.company_id!).eq('status', 'aguardando'),
      db.from('subscriptions').select('status, trial_ends_at, plano_escolhido, pago_ate').eq('company_id', me.company_id!).maybeSingle(),
    ]);
    const restam = trialDaysLeft(assin);
    if (restam != null && restam > 0) {
      faixa = <div className="faixa-teste" role="status">Teste grátis: {restam === 1 ? 'falta 1 dia' : `faltam ${restam} dias`}.</div>;
    }
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
    if (company?.ativa === false && (company.motivo_inativa === 'teste_expirado' || company.motivo_inativa === 'falta_pagamento')) {
      // motivo ligado a pagamento: mostra os planos para o cliente escolher e pagar
      const m = motivoInativa(company.motivo_inativa);
      aviso = <AvisoPlanos atual={company.plan} escolhido={assin?.plano_escolhido} titulo={m.titulo}
        texto="Para continuar recebendo as artes e os agendamentos do seu Instagram, escolha um plano abaixo e faça o pagamento." nota={company.nota_inativa} />;
    } else if (company?.ativa === false) {
      const m = motivoInativa(company.motivo_inativa);
      aviso = (
        <div className="aviso-inativa" role="alertdialog" aria-modal="true" aria-labelledby="aviso-inativa-titulo" aria-describedby="aviso-inativa-texto">
          <div className="aviso-inativa-caixa">
            <span className="aviso-inativa-icone" aria-hidden="true">!</span>
            <h2 id="aviso-inativa-titulo">{m.titulo}</h2>
            <p id="aviso-inativa-texto">{m.texto}</p>
            {company.nota_inativa && <p className="aviso-inativa-nota">{company.nota_inativa}</p>}
            <div className="aviso-inativa-sair"><SignOut /></div>
          </div>
        </div>
      );
    } else if (trialExpired(assin)) {
      aviso = <AvisoPlanos atual={company?.plan} escolhido={assin?.plano_escolhido} />;
    }
  }

  const marca = <Link href={me.role === 'gestor' ? '/gestor' : '/painel'} className="marca" aria-label="Postiva Design, início"><PostivaLogo size={42} invert /></Link>;
  return (
    <div className="shell">
      <aside className="sidebar" inert={aviso ? true : undefined}>
        {marca}
        <NavLinks items={items} />
        <div className="quem"><strong>{who}</strong>{sub && <span>{sub}</span>}<SignOut /></div>
      </aside>
      <header className="topo-movel" inert={aviso ? true : undefined}>
        {marca}
        <details>
          <summary>Menu</summary>
          <NavLinks items={items} />
        </details>
      </header>
      <main className="conteudo" inert={aviso ? true : undefined}>{faixa}{children}</main>
      {aviso}
    </div>
  );
}
