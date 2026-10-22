'use client';
// Itens do menu com o item da página atual marcado (aria-current).
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';

export type NavItem = { href: string; label: string; icon: ReactNode; count?: number; group?: string };

export default function NavLinks({ items }: { items: NavItem[] }) {
  const path = usePathname();
  const active = (href: string) => {
    const base = href.split('?')[0];
    if (base === '/gestor' || base === '/painel') return path === base; // Início/Visão geral só na própria página
    // a página de uma empresa (/gestor/<id>) fica dentro de "Empresas"
    if (base === '/gestor/empresas') return path.startsWith('/gestor/empresas') || /^\/gestor\/[0-9a-f-]{36}/.test(path);
    return path === base || path.startsWith(base + '/');
  };
  let lastGroup: string | undefined;
  return (
    <nav className="nav" aria-label="Menu principal">
      {items.map((it) => {
        const head = it.group && it.group !== lastGroup ? <p className="nav-grupo" key={`g-${it.group}`}>{it.group}</p> : null;
        lastGroup = it.group ?? lastGroup;
        return [head,
          <Link key={it.href} href={it.href} aria-current={active(it.href) ? 'page' : undefined}>
            {it.icon}<span>{it.label}</span>{!!it.count && <span className="conta" aria-label={`${it.count} pendentes`}>{it.count}</span>}
          </Link>];
      })}
    </nav>
  );
}
