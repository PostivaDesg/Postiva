// Link assinado de cada arte: o Metricool e o painel abrem a imagem sem login,
// mas ninguém consegue adivinhar o link de outra arte.
import { createHmac, timingSafeEqual } from 'crypto';

const secret = () => process.env.ART_SECRET ?? process.env.CRON_SECRET ?? 'troque-ART_SECRET';
const sign = (payload: string) => createHmac('sha256', secret()).update(payload).digest('base64url').slice(0, 32);

export function artUrl(postId: string, version = 1, absolute = true) {
  const path = `/api/art/${postId}?v=${version}&s=${sign(`${postId}.${version}`)}`;
  return absolute ? `${process.env.NEXT_PUBLIC_SITE_URL ?? ''}${path}` : path;
}

export function previewUrl(companyId: string, layout: string, rev: string) {
  return `/api/art/preview?c=${companyId}&l=${encodeURIComponent(layout)}&r=${rev}&s=${sign(`p.${companyId}.${layout}.${rev}`)}`;
}

export function verify(payload: string, s: string | null) {
  if (!s) return false;
  const a = Buffer.from(sign(payload)), b = Buffer.from(s);
  return a.length === b.length && timingSafeEqual(a, b);
}
