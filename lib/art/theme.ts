// Modelo visual de cada empresa (TemplateSpec), DESENHADO PELO CLAUDE a partir do logo, das cores
// e dos exemplos de Instagram que o cliente enviou (lib/art/design.ts). Ninguém desenha à mão.
// O gerador (lib/art/layouts.tsx) lê este modelo e aplica em todos os layouts da empresa.
import { FONT_FAMILIES, type FontFamily } from './fonts';

export interface TemplateSpec {
  palette: { primary: string; secondary: string; bg: string; ink: string };
  display: FontFamily;
  body: FontFamily;
  headlineCase: 'upper' | 'normal';
  headlineAlign: 'left' | 'center';
  logoPosition: 'top-left' | 'top-center' | 'top-right' | 'bottom-left' | 'bottom-right';
  photoShape: 'full' | 'rounded' | 'circle' | 'arch' | 'tilted';
  accentShape: 'none' | 'circle' | 'bar' | 'corner' | 'dots' | 'stripes' | 'wave';
  frame: 'none' | 'thin' | 'thick' | 'inset';
  textBox: 'none' | 'solid' | 'outline' | 'underline';
  radius: number;      // 0 a 64
  density: 'airy' | 'balanced' | 'bold'; // quanto espaço vazio
  layouts: string[];   // 5 layouts escolhidos do catálogo (lib/styles.ts)
  notes: string;       // o que o Claude viu nos exemplos (para o briefing)
}

export interface Theme extends TemplateSpec { onPrimary: string; onSecondary: string }

const HEX = /^#[0-9a-f]{6}$/i;
function lum(hex: string) {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
export const contrast = (a: string, b: string) => { const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m); return (x + 0.05) / (y + 0.05); };
export const textOn = (bg: string) => (contrast(bg, '#FFFFFF') >= contrast(bg, '#141414') ? '#FFFFFF' : '#141414');

const pickEnum = <T extends string>(v: unknown, ok: readonly T[], d: T): T => (ok.includes(v as T) ? (v as T) : d);
const isFont = (f: unknown): f is FontFamily => typeof f === 'string' && f in FONT_FAMILIES;

/** Valida e completa o modelo (o que vier errado do Claude ou do banco cai num padrão seguro). */
export function normalizeSpec(raw: any, fallbackLayouts: string[]): TemplateSpec {
  const hex = (c: unknown, d: string) => (typeof c === 'string' && HEX.test(c.trim()) ? c.trim().toUpperCase() : d);
  const primary = hex(raw?.palette?.primary, '#2448E0');
  const bg = hex(raw?.palette?.bg, '#F7F6F2');
  let ink = hex(raw?.palette?.ink, '#141414');
  if (contrast(ink, bg) < 4.5) ink = textOn(bg); // texto sempre legível
  let secondary = hex(raw?.palette?.secondary, textOn(primary) === '#FFFFFF' ? '#F2B705' : '#141414');
  if (secondary === primary) secondary = textOn(primary) === '#FFFFFF' ? '#F2B705' : '#141414';
  return {
    palette: { primary, secondary, bg, ink },
    display: isFont(raw?.display) ? raw.display : 'Montserrat',
    body: isFont(raw?.body) ? raw.body : 'Inter',
    headlineCase: pickEnum(raw?.headlineCase, ['upper', 'normal'] as const, 'normal'),
    headlineAlign: pickEnum(raw?.headlineAlign, ['left', 'center'] as const, 'left'),
    logoPosition: pickEnum(raw?.logoPosition, ['top-left', 'top-center', 'top-right', 'bottom-left', 'bottom-right'] as const, 'top-left'),
    photoShape: pickEnum(raw?.photoShape, ['full', 'rounded', 'circle', 'arch', 'tilted'] as const, 'rounded'),
    accentShape: pickEnum(raw?.accentShape, ['none', 'circle', 'bar', 'corner', 'dots', 'stripes', 'wave'] as const, 'none'),
    frame: pickEnum(raw?.frame, ['none', 'thin', 'thick', 'inset'] as const, 'none'),
    textBox: pickEnum(raw?.textBox, ['none', 'solid', 'outline', 'underline'] as const, 'none'),
    radius: Math.max(0, Math.min(64, Number(raw?.radius) || 0)),
    density: pickEnum(raw?.density, ['airy', 'balanced', 'bold'] as const, 'balanced'),
    layouts: Array.isArray(raw?.layouts) && raw.layouts.length >= 3 ? raw.layouts.slice(0, 6) : fallbackLayouts,
    notes: typeof raw?.notes === 'string' ? raw.notes.slice(0, 1500) : '',
  };
}

export function toTheme(spec: TemplateSpec): Theme {
  return { ...spec, onPrimary: textOn(spec.palette.primary), onSecondary: textOn(spec.palette.secondary) };
}
