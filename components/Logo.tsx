// Logo da Postiva Design (opção A aprovada): o P dentro de um quadro de post 4:5, com o ponto fúcsia do post publicado.
export function PostivaMark({ size = 32, invert = false, title }: { size?: number; invert?: boolean; title?: string }) {
  const frame = invert ? '#FFFFFF' : '#17153B';
  const letter = invert ? '#17153B' : '#FFFFFF';
  const sw = size < 24 ? 18 : 16; // traço um pouco mais grosso quando pequeno
  return (
    <svg width={size * 0.8} height={size} viewBox="0 0 100 125" role={title ? 'img' : undefined} aria-label={title} aria-hidden={title ? undefined : true}>
      <rect width="100" height="125" rx="26" fill={frame} />
      <path d="M38 96 V38 H56 A14 14 0 0 1 56 66 H38" fill="none" stroke={letter} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="74" cy="97" r={sw / 2} fill="#D6246E" />
    </svg>
  );
}

export function PostivaLogo({ size = 34, invert = false }: { size?: number; invert?: boolean }) {
  return (
    <span className="logo" style={{ display: 'inline-flex', alignItems: 'center', gap: size * 0.32 }}>
      <PostivaMark size={size} invert={invert} />
      <span style={{ display: 'grid', lineHeight: 0.95 }}>
        <b style={{ fontFamily: 'var(--display)', fontWeight: 800, fontSize: size * 0.78, letterSpacing: '-0.04em', color: invert ? '#FFFFFF' : 'var(--tinta)' }}>postiva</b>
        <span style={{ fontFamily: 'var(--display)', fontWeight: 500, fontSize: size * 0.3, letterSpacing: '0.28em', color: invert ? '#B9B5E6' : 'var(--muted)', paddingLeft: 2 }}>design</span>
      </span>
    </span>
  );
}
