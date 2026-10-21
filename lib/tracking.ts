// Medir vendas: cada post ganha um link curto que conta o clique e abre o WhatsApp
// da empresa com uma mensagem pronta. Não usa API do WhatsApp (custo zero): é um link wa.me comum.
//
// Atenção: no Instagram, link na legenda do feed não é clicável. Use o link:
//   - no adesivo de link dos stories (cada story tem o seu);
//   - na bio (link fixo da empresa, companies.bio_code);
//   - no botão de contato dos anúncios, se a empresa impulsionar.
import { randomBytes } from 'crypto';

const ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789'; // sem letras e números parecidos

export function newTrackingCode(size = 7) {
  const bytes = randomBytes(size);
  return Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join('');
}

export function trackedLink(code: string) {
  return `${process.env.NEXT_PUBLIC_SITE_URL ?? 'https://postivadesign.com.br'}/r/${code}`;
}

/** Link do WhatsApp da empresa com mensagem pronta (o código ajuda a empresa a saber de onde veio). */
export function whatsappLink(phone: string, message: string) {
  let digits = phone.replace(/\D/g, '');
  if (digits.length <= 11) digits = `55${digits}`; // número brasileiro sem DDI
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}
