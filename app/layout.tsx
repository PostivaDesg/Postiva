import './globals.css';
import type { ReactNode } from 'react';
import { Bricolage_Grotesque, Figtree } from 'next/font/google';
import { BRAND } from '@/lib/brand-config';

const display = Bricolage_Grotesque({ subsets: ['latin'], weight: ['600', '700', '800'], variable: '--font-display', display: 'swap' });
const body = Figtree({ subsets: ['latin'], weight: ['400', '500', '600', '700', '800'], variable: '--font-body', display: 'swap' });

export const metadata = { title: BRAND.name, description: BRAND.slogan };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR" className={`${display.variable} ${body.variable}`}>
      <body>{children}</body>
    </html>
  );
}
