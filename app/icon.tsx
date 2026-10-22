// Ícone do app e da aba do navegador: o símbolo da Postiva (P no quadro de post + ponto fúcsia).
import React from 'react';
import { ImageResponse } from 'next/og';

export const size = { width: 512, height: 512 };
export const contentType = 'image/png';

export default function Icon() {
  return new ImageResponse(
    <div style={{ width: 512, height: 512, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#17153B' }}>
      <svg width="330" height="412" viewBox="0 0 100 125">
        <rect width="100" height="125" rx="26" fill="#FFFFFF" />
        <path d="M38 96 V38 H56 A14 14 0 0 1 56 66 H38" fill="none" stroke="#17153B" strokeWidth="16" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="74" cy="97" r="8" fill="#D6246E" />
      </svg>
    </div>,
    size,
  );
}
