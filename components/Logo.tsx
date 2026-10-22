// Logo da Postiva Design (versão do Canva aprovada): quadro de post arredondado só no contorno,
// P cheio por dentro e o ponto fúcsia do post publicado. Ao lado, "postiva" bem encorpado e "design" espaçado.
export const MARK_PATH = 'M21 24 H56 A31 32 0 0 1 56 88 H40 V122 H21 Z M40 41 V71 H55 A14 15 0 0 0 55 41 Z';

export function PostivaMark({ size = 32, invert = false, title }: { size?: number; invert?: boolean; title?: string }) {
  const ink = invert ? '#FFFFFF' : '#17153B';
  const small = size < 28; // contorno mais grosso quando pequeno, para não sumir
  return (
    <svg width={(size * 2) / 3} height={size} viewBox="0 0 100 150" role={title ? 'img' : undefined} aria-label={title} aria-hidden={title ? undefined : true}>
      <rect x={small ? 5 : 4} y={small ? 5 : 4} width={small ? 90 : 92} height={small ? 140 : 142} rx="22" fill="none" stroke={ink} strokeWidth={small ? 10 : 7} />
      <path fillRule="evenodd" fill={ink} d={MARK_PATH} />
      <circle cx="73" cy="121" r={small ? 12 : 11} fill="#D6246E" />
    </svg>
  );
}

export function PostivaLogo({ size = 40, invert = false }: { size?: number; invert?: boolean }) {
  return (
    <span className="logo" style={{ display: 'inline-flex', alignItems: 'center', gap: size * 0.22 }}>
      <PostivaMark size={size} invert={invert} />
      <span style={{ display: 'grid', lineHeight: 1 }}>
        <b style={{ fontFamily: 'var(--corpo)', fontWeight: 800, fontSize: size * 0.6, letterSpacing: '-0.035em', color: invert ? '#FFFFFF' : '#17153B' }}>postiva</b>
        <span style={{ fontFamily: 'var(--corpo)', fontWeight: 700, fontSize: size * 0.2, letterSpacing: '0.55em', color: invert ? '#C9C6EE' : '#17153B', marginTop: size * 0.04, paddingLeft: 1 }}>design</span>
      </span>
    </span>
  );
}
