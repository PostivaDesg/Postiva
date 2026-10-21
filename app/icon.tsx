// Ícone do app (gerado no servidor, sem arquivo de imagem).
import React from 'react';
import { ImageResponse } from 'next/og';

export const size = { width: 512, height: 512 };
export const contentType = 'image/png';

export default function Icon() {
  return new ImageResponse(
    <div style={{ width: 512, height: 512, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0E1726', borderRadius: 112 }}>
      <div style={{ display: 'flex', fontSize: 300, fontWeight: 700, color: '#FFFFFF', fontFamily: 'sans-serif', letterSpacing: -12 }}>p</div>
      <div style={{ display: 'flex', position: 'absolute', top: 96, right: 120, width: 70, height: 70, borderRadius: 35, background: '#FF5A36' }} />
    </div>,
    size,
  );
}
