/* eslint-disable @next/next/no-img-element, jsx-a11y/alt-text */
// Os layouts das artes. Cada um aplica o modelo desenhado para a empresa (Theme):
// cores, fontes, posição do logo, formato das fotos, formas de destaque, moldura e caixa de texto.
// Satori (next/og) só entende flexbox: todo bloco com mais de um filho tem display: flex.
import React, { type ReactElement } from 'react';
import type { Theme } from './theme';

export interface ArtInput {
  layout: string;
  format: 'post' | 'story';      // 1080x1350 ou 1080x1920 (story e capa de reels)
  theme: Theme;
  brandName: string;
  logo?: string | null;          // data URL
  photo?: string | null;         // data URL ou URL pública
  headline: string;
  sub?: string | null;
  cta?: string | null;
  priceFrom?: string | null;     // "R$ 59,90"
  priceTo?: string | null;
  validity?: string | null;      // "Válido de 20/10 a 26/10 ou enquanto durar o estoque"
  dateLabel?: string | null;
  credit?: string | null;        // "Arte: Postiva Design"
  items?: string[] | null;       // lista-numerada
}

export const SIZE = { post: { w: 1080, h: 1350 }, story: { w: 1080, h: 1920 } };

// ---------- peças comuns ----------
const pad = (t: Theme) => (t.density === 'airy' ? 96 : t.density === 'bold' ? 56 : 72);
const cased = (t: Theme, s: string) => (t.headlineCase === 'upper' ? s.toUpperCase() : s);
/** Tamanho do título pelo comprimento do texto, para nunca estourar a arte. */
const fit = (text: string, base: number, min = 44) => Math.max(min, Math.round(base * Math.min(1, Math.sqrt(18 / Math.max(6, text.length)))));

function Headline({ t, text, size, color, align }: { t: Theme; text: string; size: number; color: string; align?: 'left' | 'center' }) {
  const a = align ?? t.headlineAlign;
  const base: Record<string, any> = {
    display: 'flex', fontFamily: t.display, fontWeight: 700, fontSize: size, lineHeight: 1.05, color,
    letterSpacing: t.headlineCase === 'upper' ? 1 : -1, textAlign: a, justifyContent: a === 'center' ? 'center' : 'flex-start',
  };
  if (t.textBox === 'solid') Object.assign(base, { background: t.palette.primary, color: t.onPrimary, padding: '18px 28px', borderRadius: Math.min(t.radius, 24) });
  if (t.textBox === 'outline') Object.assign(base, { border: `5px solid ${color}`, padding: '18px 28px', borderRadius: Math.min(t.radius, 24) });
  if (t.textBox === 'underline') Object.assign(base, { borderBottom: `10px solid ${t.palette.secondary}`, paddingBottom: 10 });
  return <div style={base}>{cased(t, text)}</div>;
}

function Body({ t, text, size = 40, color, align }: { t: Theme; text?: string | null; size?: number; color: string; align?: 'left' | 'center' }) {
  if (!text) return null;
  const a = align ?? t.headlineAlign;
  return <div style={{ display: 'flex', fontFamily: t.body, fontSize: size, lineHeight: 1.3, color, textAlign: a, justifyContent: a === 'center' ? 'center' : 'flex-start' }}>{text}</div>;
}

function Cta({ t, text, invert }: { t: Theme; text?: string | null; invert?: boolean }) {
  if (!text) return null;
  const bg = invert ? t.onPrimary : t.palette.secondary;
  return (
    <div style={{ display: 'flex', alignSelf: t.headlineAlign === 'center' ? 'center' : 'flex-start', background: bg, color: invert ? t.palette.primary : t.onSecondary,
      fontFamily: t.body, fontWeight: 700, fontSize: 34, padding: '18px 34px', borderRadius: Math.max(8, Math.min(t.radius, 60)) }}>{text}</div>
  );
}

function Logo({ t, logo, name, light, pos }: { t: Theme; logo?: string | null; name: string; light?: boolean; pos?: Theme['logoPosition'] }) {
  const p = pos ?? t.logoPosition;
  const P = pad(t) * 0.6;
  const place: Record<string, any> = { position: 'absolute', display: 'flex', [p.startsWith('top') ? 'top' : 'bottom']: P };
  if (p.endsWith('left')) place.left = P; else if (p.endsWith('right')) place.right = P; else { place.left = 0; place.right = 0; place.justifyContent = 'center'; }
  return (
    <div style={place}>
      {logo
        ? <img src={logo} style={{ height: 96, maxWidth: 360, objectFit: 'contain' }} />
        : <div style={{ display: 'flex', fontFamily: t.display, fontWeight: 700, fontSize: 40, color: light ? '#FFFFFF' : t.palette.primary }}>{name}</div>}
    </div>
  );
}

function Credit({ t, text, light }: { t: Theme; text?: string | null; light?: boolean }) {
  if (!text) return null;
  const right = t.logoPosition === 'bottom-right';
  return <div style={{ position: 'absolute', bottom: 22, [right ? 'left' : 'right']: 28, display: 'flex', fontFamily: t.body, fontSize: 22, color: light ? '#FFFFFF' : t.palette.ink, opacity: 0.7 }}>{text}</div>;
}

function Photo({ t, src, w, h, shape, fallback }: { t: Theme; src?: string | null; w: number; h: number; shape?: Theme['photoShape']; fallback?: string }) {
  const s = shape ?? t.photoShape;
  const radius = s === 'circle' ? w / 2 : s === 'arch' ? `${w / 2}px ${w / 2}px ${t.radius}px ${t.radius}px` : s === 'full' ? 0 : Math.max(12, t.radius);
  const style: Record<string, any> = { width: w, height: h, borderRadius: radius, objectFit: 'cover', display: 'flex' };
  if (s === 'tilted') Object.assign(style, { transform: 'rotate(-3deg)', border: '18px solid #FFFFFF', boxShadow: '0 20px 40px rgba(0,0,0,0.18)' });
  if (src) return <img src={src} style={style} />;
  // sem foto: bloco na cor da marca com a inicial (nunca uma foto inventada)
  return <div style={{ ...style, background: t.palette.secondary, alignItems: 'center', justifyContent: 'center', color: t.onSecondary, fontFamily: t.display, fontSize: Math.min(w, h) / 2.5, fontWeight: 700 }}>{(fallback ?? '•').slice(0, 1)}</div>;
}

function Accent({ t, W, H, onDark }: { t: Theme; W: number; H: number; onDark?: boolean }) {
  const c = onDark ? t.palette.secondary : t.palette.primary;
  switch (t.accentShape) {
    case 'circle': return <div style={{ position: 'absolute', [t.logoPosition.endsWith('right') ? 'left' : 'right']: -W * 0.18, [t.logoPosition.startsWith('top') ? 'bottom' : 'top']: -W * 0.18, width: W * 0.62, height: W * 0.62, borderRadius: W, background: c, opacity: 0.16, display: 'flex' }} />;
    case 'bar': return <div style={{ position: 'absolute', left: 0, top: 0, width: 26, height: H, background: c, display: 'flex' }} />;
    case 'corner': return <div style={{ position: 'absolute', right: 0, bottom: 0, width: W * 0.2, height: W * 0.2, background: c, borderTopLeftRadius: W * 0.2, opacity: 0.9, display: 'flex' }} />;
    case 'dots': return ( // sempre no canto oposto ao logo
      <div style={{ position: 'absolute', [t.logoPosition.endsWith('right') ? 'left' : 'right']: 60, [t.logoPosition.startsWith('top') ? 'bottom' : 'top']: 60, display: 'flex', flexWrap: 'wrap', width: 150, gap: 18 }}>
        {Array.from({ length: 16 }).map((_, i) => <div key={i} style={{ width: 20, height: 20, borderRadius: 10, background: c, opacity: 0.5, display: 'flex' }} />)}
      </div>);
    case 'stripes': return (
      <div style={{ position: 'absolute', left: 0, bottom: 0, display: 'flex', flexDirection: 'column', gap: 14, width: W }}>
        {[0, 1, 2].map((i) => <div key={i} style={{ height: 14, width: W * (0.5 - i * 0.12), background: c, opacity: 0.8 - i * 0.2, display: 'flex' }} />)}
      </div>);
    case 'wave': return <div style={{ position: 'absolute', left: -W * 0.2, bottom: -H * 0.08, width: W * 1.4, height: H * 0.22, borderRadius: '50%', background: c, opacity: 0.14, display: 'flex' }} />;
    default: return null;
  }
}

function Frame({ t, W, H, bg, children }: { t: Theme; W: number; H: number; bg: string; children: any }) {
  const border = t.frame === 'thin' ? `6px solid ${t.palette.primary}` : t.frame === 'thick' ? `28px solid ${t.palette.primary}` : 'none';
  return (
    <div style={{ width: W, height: H, display: 'flex', position: 'relative', background: bg, border, overflow: 'hidden', fontFamily: t.body }}>
      {t.frame === 'inset' && <div style={{ position: 'absolute', left: 30, top: 30, right: 30, bottom: 30, border: `3px solid ${t.palette.primary}`, borderRadius: t.radius, display: 'flex' }} />}
      {children}
    </div>
  );
}

function PriceTag({ t, from, to, big = 120 }: { t: Theme; from?: string | null; to?: string | null; big?: number }) {
  if (!to) return null;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: t.headlineAlign === 'center' ? 'center' : 'flex-start' }}>
      {from && <div style={{ display: 'flex', fontFamily: t.body, fontSize: 40, color: t.palette.ink, textDecoration: 'line-through', opacity: 0.7 }}>de {from}</div>}
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 14, background: t.palette.secondary, color: t.onSecondary, padding: '10px 30px', borderRadius: Math.min(t.radius, 30) }}>
        <span style={{ fontFamily: t.body, fontSize: 40, fontWeight: 700 }}>por</span>
        <span style={{ fontFamily: t.display, fontSize: big, fontWeight: 700, letterSpacing: -2 }}>{to}</span>
      </div>
    </div>
  );
}

const Small = ({ t, text, color }: { t: Theme; text?: string | null; color: string }) =>
  text ? <div style={{ display: 'flex', fontFamily: t.body, fontSize: 26, color, opacity: 0.85 }}>{text}</div> : null;

// ---------- layouts ----------
type L = (a: ArtInput, W: number, H: number) => ReactElement;
const P = (a: ArtInput) => pad(a.theme);
const col = (gap: number, extra: Record<string, any> = {}) => ({ display: 'flex', flexDirection: 'column' as const, gap, ...extra });

const LAYOUTS: Record<string, L> = {
  'foto-cheia': (a, W, H) => { const t = a.theme; return (
    <Frame t={t} W={W} H={H} bg={t.palette.primary}>
      <Photo t={t} src={a.photo} w={W} h={H} shape="full" fallback={a.brandName} />
      <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: H * 0.55, display: 'flex', backgroundImage: 'linear-gradient(to bottom, rgba(0,0,0,0), rgba(0,0,0,0.78))' }} />
      <div style={{ position: 'absolute', left: P(a), right: P(a), bottom: P(a) + 30, ...col(22) }}>
        <Headline t={t} text={a.headline} size={fit(a.headline, 112)} color="#FFFFFF" />
        <Body t={t} text={a.sub} color="#FFFFFF" /><Cta t={t} text={a.cta} />
      </div>
      <Logo t={t} logo={a.logo} name={a.brandName} light pos={t.logoPosition.startsWith('bottom') ? 'top-left' : t.logoPosition} />
      <Credit t={t} text={a.credit} light />
    </Frame>); },

  'divisao-vertical': (a, W, H) => { const t = a.theme; return (
    <Frame t={t} W={W} H={H} bg={t.palette.bg}>
      <div style={{ display: 'flex', width: W, height: H }}>
        <Photo t={t} src={a.photo} w={W * 0.5} h={H} shape="full" fallback={a.brandName} />
        <div style={{ width: W * 0.5, padding: P(a), ...col(26, { justifyContent: 'center' }) }}>
          <Headline t={t} text={a.headline} size={fit(a.headline, 84, 40)} color={t.palette.ink} align="left" />
          <Body t={t} text={a.sub} size={34} color={t.palette.ink} align="left" /><Cta t={t} text={a.cta} />
        </div>
      </div>
      <Logo t={t} logo={a.logo} name={a.brandName} pos="bottom-right" /><Credit t={t} text={a.credit} />
    </Frame>); },

  'cartao-central': (a, W, H) => { const t = a.theme; return (
    <Frame t={t} W={W} H={H} bg={t.palette.primary}>
      <Accent t={t} W={W} H={H} onDark />
      <div style={{ position: 'absolute', left: 80, right: 80, top: H * 0.16, bottom: H * 0.16, background: t.palette.bg, borderRadius: Math.max(t.radius, 16), padding: 64, ...col(28, { justifyContent: 'center', alignItems: t.headlineAlign === 'center' ? 'center' : 'flex-start' }) }}>
        {a.photo && <Photo t={t} src={a.photo} w={W - 160 - 128} h={H * 0.28} />}
        <Headline t={t} text={a.headline} size={fit(a.headline, 92)} color={t.palette.ink} />
        <Body t={t} text={a.sub} color={t.palette.ink} /><Cta t={t} text={a.cta} />
      </div>
      <Logo t={t} logo={a.logo} name={a.brandName} light /><Credit t={t} text={a.credit} light />
    </Frame>); },

  'tipografico': (a, W, H) => { const t = a.theme; return (
    <Frame t={t} W={W} H={H} bg={t.palette.bg}>
      <Accent t={t} W={W} H={H} />
      <div style={{ position: 'absolute', left: P(a), right: P(a), top: 0, bottom: 0, ...col(34, { justifyContent: 'center' }) }}>
        <Headline t={t} text={a.headline} size={fit(a.headline, 150, 64)} color={t.palette.primary} />
        <Body t={t} text={a.sub} size={44} color={t.palette.ink} /><Cta t={t} text={a.cta} />
      </div>
      <Logo t={t} logo={a.logo} name={a.brandName} /><Credit t={t} text={a.credit} />
    </Frame>); },

  'produto-flutuante': (a, W, H) => { const t = a.theme; return (
    <Frame t={t} W={W} H={H} bg={t.palette.bg}>
      <Accent t={t} W={W} H={H} />
      <div style={{ position: 'absolute', left: P(a), right: P(a), top: P(a) + 90, bottom: P(a), ...col(30, { alignItems: 'center', justifyContent: 'space-between' }) }}>
        <div style={{ display: 'flex', width: W * 0.62, height: W * 0.62, borderRadius: W, background: t.palette.primary, opacity: 0.12, position: 'absolute', top: 40 }} />
        <img src={a.photo ?? undefined} style={{ width: W * 0.6, height: H * (a.format === 'story' ? 0.36 : 0.42), objectFit: 'contain', display: a.photo ? 'flex' : 'none' }} />
        <div style={col(18, { alignItems: 'center' })}>
          <Headline t={t} text={a.headline} size={fit(a.headline, 76, 40)} color={t.palette.ink} align="center" />
          {a.priceTo ? <PriceTag t={{ ...t, headlineAlign: 'center' }} from={a.priceFrom} to={a.priceTo} big={100} /> : <Body t={t} text={a.sub} color={t.palette.ink} align="center" />}
          <Small t={t} text={a.validity} color={t.palette.ink} />
        </div>
      </div>
      <Logo t={t} logo={a.logo} name={a.brandName} /><Credit t={t} text={a.credit} />
    </Frame>); },

  'faixa-preco': (a, W, H) => { const t = a.theme; return (
    <Frame t={t} W={W} H={H} bg={t.palette.bg}>
      <div style={{ display: 'flex', flexDirection: 'column', width: W, height: H }}>
        <div style={{ display: 'flex', height: H * 0.56, alignItems: 'center', justifyContent: 'center', background: t.palette.primary }}>
          <div style={{ display: 'flex', marginTop: 70 }}><Photo t={t} src={a.photo} w={W * 0.66} h={H * 0.4} shape={t.photoShape === 'full' ? 'rounded' : t.photoShape} fallback={a.brandName} /></div>
        </div>
        <div style={{ padding: P(a), ...col(22, { flex: 1, justifyContent: 'center' }) }}>
          <Headline t={t} text={a.headline} size={fit(a.headline, 70, 38)} color={t.palette.ink} />
          <PriceTag t={t} from={a.priceFrom} to={a.priceTo} big={96} />
          {!a.priceTo && <Body t={t} text={a.sub} color={t.palette.ink} />}
          <Small t={t} text={a.validity} color={t.palette.ink} />
        </div>
      </div>
      <Logo t={t} logo={a.logo} name={a.brandName} light pos="top-left" /><Credit t={t} text={a.credit} />
    </Frame>); },

  'colagem': (a, W, H) => { const t = a.theme; return (
    <Frame t={t} W={W} H={H} bg={t.palette.secondary}>
      <div style={{ position: 'absolute', left: 70, top: 160, display: 'flex', transform: 'rotate(-4deg)' }}><Photo t={t} src={a.photo} w={W * 0.62} h={H * 0.42} shape="rounded" fallback={a.brandName} /></div>
      <div style={{ position: 'absolute', right: 70, top: H * 0.34, width: W * 0.4, height: W * 0.4, borderRadius: t.radius, background: t.palette.primary, transform: 'rotate(6deg)', display: 'flex' }} />
      <div style={{ position: 'absolute', left: P(a), right: P(a), bottom: P(a) + 30, ...col(20) }}>
        <Headline t={t} text={a.headline} size={fit(a.headline, 100)} color={t.onSecondary} />
        <Body t={t} text={a.sub} color={t.onSecondary} />
      </div>
      <Logo t={t} logo={a.logo} name={a.brandName} pos="top-right" /><Credit t={t} text={a.credit} />
    </Frame>); },

  'moldura': (a, W, H) => { const t = a.theme; const m = 64; return (
    <Frame t={t} W={W} H={H} bg={t.palette.primary}>
      <div style={{ position: 'absolute', left: m, right: m, top: m, height: H * 0.6, display: 'flex' }}><Photo t={t} src={a.photo} w={W - 2 * m} h={H * 0.6} shape="full" fallback={a.brandName} /></div>
      <div style={{ position: 'absolute', left: m, right: m, top: H * 0.6 + m + 40, bottom: m, ...col(18) }}>
        <Headline t={t} text={a.headline} size={fit(a.headline, 84, 40)} color={t.onPrimary} />
        <Body t={t} text={a.sub} size={36} color={t.onPrimary} />
      </div>
      <Logo t={t} logo={a.logo} name={a.brandName} light pos="bottom-right" /><Credit t={t} text={a.credit} light />
    </Frame>); },

  'diagonal': (a, W, H) => { const t = a.theme; return (
    <Frame t={t} W={W} H={H} bg={t.palette.bg}>
      <Photo t={t} src={a.photo} w={W} h={H} shape="full" fallback={a.brandName} />
      <div style={{ position: 'absolute', left: -W * 0.2, top: H * 0.52, width: W * 1.4, height: H * 0.3, background: t.palette.primary, transform: 'rotate(-8deg)', display: 'flex' }} />
      <div style={{ position: 'absolute', left: P(a), right: P(a), top: H * 0.56, ...col(14) }}>
        <Headline t={t} text={a.headline} size={fit(a.headline, 96)} color={t.onPrimary} />
        <Body t={t} text={a.sub} size={36} color={t.onPrimary} />
      </div>
      <Logo t={t} logo={a.logo} name={a.brandName} light /><Credit t={t} text={a.credit} light />
    </Frame>); },

  'lista-numerada': (a, W, H) => { const t = a.theme; const items = (a.items?.length ? a.items : (a.sub ?? '').split(/[;\n]/)).map((s) => s.trim()).filter(Boolean).slice(0, 4); return (
    <Frame t={t} W={W} H={H} bg={t.palette.bg}>
      <Accent t={t} W={W} H={H} />
      <div style={{ position: 'absolute', left: P(a), right: P(a), top: P(a) + 120, bottom: P(a) + 60, ...col(64, { justifyContent: 'center' }) }}>
        <Headline t={t} text={a.headline} size={fit(a.headline, 110, 56)} color={t.palette.primary} />
        <div style={col(44)}>
          {items.map((it, i) => (
            <div key={i} style={{ display: 'flex', gap: 32, alignItems: 'center' }}>
              <div style={{ display: 'flex', width: 110, height: 110, borderRadius: Math.min(55, t.radius + 14), background: t.palette.primary, color: t.onPrimary, alignItems: 'center', justifyContent: 'center', fontFamily: t.display, fontSize: 58, fontWeight: 700 }}>{i + 1}</div>
              <div style={{ display: 'flex', flex: 1, fontFamily: t.body, fontSize: 52, color: t.palette.ink, lineHeight: 1.2 }}>{it}</div>
            </div>))}
        </div>
        <Cta t={t} text={a.cta} />
      </div>
      <Logo t={t} logo={a.logo} name={a.brandName} /><Credit t={t} text={a.credit} />
    </Frame>); },

  'citacao': (a, W, H) => { const t = a.theme; return (
    <Frame t={t} W={W} H={H} bg={t.palette.primary}>
      <Accent t={t} W={W} H={H} onDark />
      <div style={{ position: 'absolute', left: P(a), right: P(a), top: 0, bottom: 0, ...col(28, { justifyContent: 'center' }) }}>
        <div style={{ display: 'flex', fontFamily: 'Playfair Display', fontSize: 240, lineHeight: 0.6, color: t.palette.secondary }}>“</div>
        <Headline t={{ ...t, textBox: 'none' }} text={a.headline} size={fit(a.headline, 86, 44)} color={t.onPrimary} />
        <Body t={t} text={a.sub} size={34} color={t.onPrimary} />
      </div>
      <Logo t={t} logo={a.logo} name={a.brandName} light pos="bottom-left" /><Credit t={t} text={a.credit} light />
    </Frame>); },

  'polaroid': (a, W, H) => { const t = a.theme; return (
    <Frame t={t} W={W} H={H} bg={t.palette.bg}>
      <Accent t={t} W={W} H={H} />
      <div style={{ position: 'absolute', left: W * 0.17, top: H * 0.1, display: 'flex', flexDirection: 'column', background: '#FFFFFF', padding: 30, paddingBottom: 100, transform: 'rotate(-3deg)', boxShadow: '0 24px 50px rgba(0,0,0,0.2)' }}>
        <Photo t={t} src={a.photo} w={W * 0.6} h={W * 0.6} shape="full" fallback={a.brandName} />
        <div style={{ display: 'flex', fontFamily: 'Caveat', fontSize: 56, color: '#222', marginTop: 24 }}>{a.sub?.slice(0, 40) ?? a.brandName}</div>
      </div>
      <div style={{ position: 'absolute', left: P(a), right: P(a), bottom: P(a) + 40, ...col(16) }}>
        <Headline t={t} text={a.headline} size={fit(a.headline, 80, 40)} color={t.palette.ink} />
      </div>
      <Logo t={t} logo={a.logo} name={a.brandName} pos="top-right" /><Credit t={t} text={a.credit} />
    </Frame>); },
};

// ---------- datas comemorativas e feriados ----------
const dateTitle = (a: ArtInput) => a.dateLabel ?? a.headline;

const DATE_LAYOUTS: Record<string, L> = {
  'data-tipografica': (a, W, H) => { const t = a.theme; return (
    <Frame t={t} W={W} H={H} bg={t.palette.primary}>
      <Accent t={t} W={W} H={H} onDark />
      <div style={{ position: 'absolute', left: P(a), right: P(a), top: 0, bottom: 0, ...col(30, { justifyContent: 'center' }) }}>
        <Small t={t} text={a.dateLabel} color={t.onPrimary} />
        <Headline t={t} text={a.headline} size={fit(a.headline, 150, 64)} color={t.onPrimary} />
        <Body t={t} text={a.sub} size={40} color={t.onPrimary} />
      </div>
      <Logo t={t} logo={a.logo} name={a.brandName} light /><Credit t={t} text={a.credit} light />
    </Frame>); },
  'data-foto-equipe': (a, W, H) => LAYOUTS['foto-cheia']({ ...a, sub: a.sub ?? a.dateLabel }, W, H),
  'data-ilustrada': (a, W, H) => { const t = a.theme; return (
    <Frame t={t} W={W} H={H} bg={t.palette.bg}>
      {[0, 1, 2, 3, 4].map((i) => <div key={i} style={{ position: 'absolute', display: 'flex', width: 120 + i * 60, height: 120 + i * 60, borderRadius: i % 2 ? t.radius : 400, left: (i * 233) % W - 40, top: (i * 377) % (H * 0.5) + 40, background: i % 2 ? t.palette.secondary : t.palette.primary, opacity: 0.85 - i * 0.12, transform: `rotate(${i * 17}deg)` }} />)}
      <div style={{ position: 'absolute', left: P(a), right: P(a), bottom: P(a) + 40, ...col(20) }}>
        <Headline t={t} text={a.headline} size={fit(a.headline, 104)} color={t.palette.ink} />
        <Body t={t} text={a.sub ?? a.dateLabel} color={t.palette.ink} />
      </div>
      <Logo t={t} logo={a.logo} name={a.brandName} pos="top-right" /><Credit t={t} text={a.credit} />
    </Frame>); },
  'data-minimalista': (a, W, H) => { const t = a.theme; return (
    <Frame t={{ ...t, frame: 'none' }} W={W} H={H} bg={t.palette.bg}>
      <div style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, ...col(40, { justifyContent: 'center', alignItems: 'center', padding: P(a) * 1.4 }) }}>
        <div style={{ display: 'flex', width: 90, height: 90, borderRadius: 45, background: t.palette.primary }} />
        <Headline t={{ ...t, textBox: 'none' }} text={a.headline} size={fit(a.headline, 84, 44)} color={t.palette.ink} align="center" />
        <Small t={t} text={a.dateLabel} color={t.palette.ink} />
      </div>
      <Logo t={t} logo={a.logo} name={a.brandName} pos="bottom-left" /><Credit t={t} text={a.credit} />
    </Frame>); },
  'data-moldura': (a, W, H) => { const t = a.theme; return (
    <Frame t={{ ...t, frame: 'none' }} W={W} H={H} bg={t.palette.secondary}>
      <div style={{ position: 'absolute', left: 50, right: 50, top: 50, bottom: 50, border: `16px solid ${t.palette.primary}`, borderRadius: Math.max(24, t.radius), display: 'flex' }} />
      <div style={{ position: 'absolute', left: 90, right: 90, top: 90, bottom: 90, border: `3px dashed ${t.palette.primary}`, borderRadius: Math.max(16, t.radius - 10), ...col(26, { justifyContent: 'center', alignItems: 'center', padding: 70 }) }}>
        {a.logo
          ? <img src={a.logo} style={{ height: 90, maxWidth: 320, objectFit: 'contain', marginBottom: 30 }} />
          : <div style={{ display: 'flex', fontFamily: t.display, fontSize: 38, fontWeight: 700, color: t.palette.primary, marginBottom: 30 }}>{a.brandName}</div>}
        <Small t={t} text={a.dateLabel} color={t.onSecondary} />
        <Headline t={{ ...t, textBox: 'none' }} text={a.headline} size={fit(a.headline, 100)} color={t.onSecondary} align="center" />
        <Body t={t} text={a.sub} color={t.onSecondary} align="center" />
      </div>
      <Credit t={t} text={a.credit} />
    </Frame>); },
  'data-produto': (a, W, H) => LAYOUTS['produto-flutuante']({ ...a, priceTo: null, priceFrom: null, sub: a.sub ?? a.dateLabel }, W, H),
  'data-colagem': (a, W, H) => LAYOUTS['colagem']({ ...a, sub: a.sub ?? a.dateLabel }, W, H),
  'data-carta': (a, W, H) => { const t = a.theme; return (
    <Frame t={{ ...t, frame: 'none' }} W={W} H={H} bg={t.palette.primary}>
      <div style={{ position: 'absolute', left: 90, right: 90, top: H * 0.14, bottom: H * 0.14, background: '#FFFDF7', transform: 'rotate(-1.5deg)', boxShadow: '0 30px 60px rgba(0,0,0,0.25)', ...col(30, { padding: 80, justifyContent: 'center' }) }}>
        <div style={{ display: 'flex', fontFamily: 'Caveat', fontSize: fit(a.headline, 96, 52), color: '#2B2B2B', lineHeight: 1.1 }}>{a.headline}</div>
        {a.sub && <div style={{ display: 'flex', fontFamily: 'Caveat', fontSize: 52, color: '#4A4A4A' }}>{a.sub}</div>}
        <div style={{ display: 'flex', fontFamily: 'Caveat', fontSize: 48, color: t.palette.primary }}>— com carinho, {a.brandName}</div>
      </div>
      <Credit t={t} text={a.credit} light />
    </Frame>); },
};

export const LAYOUT_RENDERERS: Record<string, L> = { ...LAYOUTS, ...DATE_LAYOUTS };

/** Layouts que só ficam bons com foto. Sem foto, o sistema usa os outros. */
export const NEEDS_PHOTO = ['foto-cheia', 'divisao-vertical', 'diagonal', 'moldura', 'polaroid', 'colagem', 'faixa-preco', 'produto-flutuante', 'data-foto-equipe', 'data-colagem', 'data-produto'];
const TEXT_ONLY = ['tipografico', 'cartao-central', 'citacao', 'lista-numerada'];
const DATE_TEXT_ONLY = ['data-tipografica', 'data-ilustrada', 'data-minimalista', 'data-moldura', 'data-carta'];

export function renderLayout(a: ArtInput) {
  const { w, h } = SIZE[a.format];
  let layout = a.layout;
  // segurança: layout com foto sem foto disponível → um layout só de texto (variado, não sempre o mesmo)
  if (!a.photo && NEEDS_PHOTO.includes(layout)) {
    const pool = a.dateLabel ? DATE_TEXT_ONLY : TEXT_ONLY;
    const hash = [...a.headline].reduce((s, c) => (s * 31 + c.charCodeAt(0)) >>> 0, 7);
    layout = pool[hash % pool.length];
  }
  const fn = LAYOUT_RENDERERS[layout] ?? (a.dateLabel ? DATE_LAYOUTS['data-tipografica'] : LAYOUTS['tipografico']);
  return fn(a, w, h);
}
