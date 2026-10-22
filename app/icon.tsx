// Ícone do app e da aba do navegador: o símbolo da Postiva em branco sobre o azul-tinta.
import React from 'react';
import { ImageResponse } from 'next/og';

export const size = { width: 512, height: 512 };
export const contentType = 'image/png';

export default function Icon() {
  return new ImageResponse(
    <div style={{ width: 512, height: 512, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#17153B' }}>
      <svg width="260" height="390" viewBox="0 0 100 150">
        <rect x="5" y="5" width="90" height="140" rx="22" fill="none" stroke="#FFFFFF" strokeWidth="9" />
        <path fillRule="evenodd" fill="#FFFFFF" d="M21 24 H56 A31 32 0 0 1 56 88 H40 V122 H21 Z M40 41 V71 H55 A14 15 0 0 0 55 41 Z" />
        <circle cx="73" cy="121" r="12" fill="#D6246E" />
      </svg>
    </div>,
    size,
  );
}
