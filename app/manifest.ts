// Permite "instalar" o painel no celular como um app (sem loja de aplicativos e sem custo).
import type { MetadataRoute } from 'next';
import { BRAND } from '@/lib/brand-config';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: BRAND.name,
    short_name: BRAND.short,
    description: BRAND.slogan,
    start_url: '/painel',
    display: 'standalone',
    background_color: '#F4F4F8',
    theme_color: '#17153B',
    icons: [{ src: '/icon', sizes: '512x512', type: 'image/png' }],
  };
}
