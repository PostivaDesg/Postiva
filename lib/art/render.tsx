// Gera a arte em PNG (next/og, roda no próprio servidor: sem Canva e sem custo por imagem).
import React from 'react';
import { ImageResponse } from 'next/og';
import { renderLayout, SIZE, type ArtInput } from './layouts';
import { fontsFor } from './fonts';

export async function renderArt(input: ArtInput) {
  const { w, h } = SIZE[input.format];
  // Fontes fixas usadas por alguns layouts (aspas e bilhete)
  const fonts = [
    ...(await fontsFor(input.theme.display, input.theme.body)),
    ...(await fontsFor('Playfair Display', 'Caveat')),
  ];
  // o link de cada arte muda a cada versão (v=), então a rede da Vercel pode guardar a imagem para sempre
  return new ImageResponse(renderLayout(input), { width: w, height: h, fonts, headers: { 'Cache-Control': 'public, max-age=31536000, s-maxage=31536000, immutable' } });
}

/** Arquivo pequeno vira data URL (logo, foto do Drive ou do armazenamento). */
export async function toDataUrl(bytes: ArrayBuffer, mime: string) {
  return `data:${mime};base64,${Buffer.from(bytes).toString('base64')}`;
}
