import './globals.css';
import type { ReactNode } from 'react';
import { BRAND } from '@/lib/brand-config';

export const metadata = { title: BRAND.name, description: BRAND.slogan };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
