// Moldura das páginas públicas de texto (termos, privacidade).
import type { ReactNode } from 'react';
import Link from 'next/link';
import { PostivaLogo } from './Logo';

export default function LegalPage({ title, updated, children }: { title: string; updated: string; children: ReactNode }) {
  return (
    <main className="legal">
      <header className="legal-topo"><Link href="/" aria-label="Postiva Design, início"><PostivaLogo size={40} /></Link></header>
      <article>
        <h1>{title}</h1>
        <p className="muted">Última atualização: {updated}</p>
        {children}
      </article>
      <footer className="legal-rodape"><Link href="/termos">Termos de uso</Link> · <Link href="/privacidade">Política de privacidade</Link> · <Link href="/">Início</Link></footer>
    </main>
  );
}
