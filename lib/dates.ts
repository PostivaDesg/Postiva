// Calendário de datas comemorativas por segmento e por cidade.
// Entra sozinho no contexto da geração semanal. Edite as listas à vontade.

export type Segment = 'farmacia' | 'estetica' | 'alimentacao' | 'moda' | 'servicos' | 'outro';

interface DateItem { date: string; label: string; note?: string } // date = AAAA-MM-DD

const pad = (n: number) => String(n).padStart(2, '0');
const iso = (y: number, m: number, d: number) => `${y}-${pad(m)}-${pad(d)}`;

/** Páscoa (algoritmo de Meeus/Jones/Butcher). */
function easter(y: number) {
  const a = y % 19, b = Math.floor(y / 100), c = y % 100, d = Math.floor(b / 4), e = b % 4;
  const f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31), day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(Date.UTC(y, month - 1, day));
}
const shift = (d: Date, days: number) => new Date(d.getTime() + days * 864e5).toISOString().slice(0, 10);

/** N-ésimo dia da semana do mês (weekday 0 = domingo). */
function nthWeekday(y: number, m: number, weekday: number, n: number) {
  const first = new Date(Date.UTC(y, m - 1, 1)).getUTCDay();
  return iso(y, m, 1 + ((weekday - first + 7) % 7) + (n - 1) * 7);
}

function national(y: number): DateItem[] {
  const e = easter(y);
  const thanksgiving = nthWeekday(y, 11, 4, 4); // 4ª quinta de novembro
  return [
    { date: iso(y, 1, 1), label: 'Ano Novo' },
    { date: shift(e, -47), label: 'Carnaval' },
    { date: iso(y, 3, 8), label: 'Dia Internacional da Mulher' },
    { date: iso(y, 3, 15), label: 'Dia do Consumidor' },
    { date: shift(e, -2), label: 'Sexta-feira Santa (feriado)' },
    { date: shift(e, 0), label: 'Páscoa' },
    { date: iso(y, 4, 21), label: 'Tiradentes (feriado)' },
    { date: iso(y, 5, 1), label: 'Dia do Trabalhador (feriado)' },
    { date: shift(e, 60), label: 'Corpus Christi (ponto facultativo)' },
    { date: iso(y, 9, 7), label: 'Independência do Brasil (feriado)' },
    { date: iso(y, 11, 2), label: 'Finados (feriado)', note: 'Tom respeitoso, sem venda' },
    { date: iso(y, 11, 15), label: 'Proclamação da República (feriado)' },
    { date: iso(y, 11, 20), label: 'Dia da Consciência Negra (feriado)' },
    { date: iso(y, 4, 7), label: 'Dia Mundial da Saúde' },
    { date: nthWeekday(y, 5, 0, 2), label: 'Dia das Mães' },
    { date: iso(y, 6, 12), label: 'Dia dos Namorados' },
    { date: nthWeekday(y, 8, 0, 2), label: 'Dia dos Pais' },
    { date: iso(y, 9, 15), label: 'Dia do Cliente' },
    { date: iso(y, 10, 1), label: 'Outubro Rosa (mês todo)', note: 'Conscientização, sem tom de venda' },
    { date: iso(y, 10, 12), label: 'Dia das Crianças e Nossa Senhora Aparecida (feriado)' },
    { date: iso(y, 11, 1), label: 'Novembro Azul (mês todo)', note: 'Conscientização, sem tom de venda' },
    { date: shift(new Date(`${thanksgiving}T00:00:00Z`), 1), label: 'Black Friday' },
    { date: iso(y, 12, 25), label: 'Natal' },
    { date: iso(y, 12, 31), label: 'Réveillon' },
  ];
}

const SEGMENT_DATES: Record<Segment, (y: number) => DateItem[]> = {
  farmacia: (y) => [
    { date: iso(y, 1, 20), label: 'Dia do Farmacêutico' },
    { date: iso(y, 8, 29), label: 'Dia Nacional de Combate ao Fumo' },
    { date: iso(y, 11, 14), label: 'Dia Mundial do Diabetes' },
  ],
  alimentacao: (y) => [
    { date: iso(y, 5, 28), label: 'Dia do Hambúrguer' },
    { date: iso(y, 7, 10), label: 'Dia da Pizza' },
  ],
  estetica: () => [], moda: () => [], servicos: () => [], outro: () => [],
};

// Cidades: chave sem acento e sem espaço
const CITY_DATES: Record<string, (y: number) => DateItem[]> = {
  cabofrio: (y) => [
    { date: iso(y, 11, 13), label: 'Aniversário de Cabo Frio' },
    { date: iso(y, 12, 15), label: 'Começo da temporada de verão', note: 'Mais turistas até o Carnaval: reforçar delivery e horário' },
  ],
};

const cityKey = (c?: string | null) => (c ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z]/g, '');

/** Datas que caem entre `start` e `end` (inclusive), com 7 dias de antecedência para preparar. */
export function datesBetween(start: string, end: string, segment?: string | null, city?: string | null) {
  const y = Number(start.slice(0, 4));
  const all = [y, y + 1].flatMap((yy) => [
    ...national(yy),
    ...SEGMENT_DATES[toSegment(segment)](yy),
    ...(CITY_DATES[cityKey(city)]?.(yy) ?? []),
  ]);
  const until = shift(new Date(`${end}T00:00:00Z`), 7);
  return all.filter((d) => d.date >= start && d.date <= until).sort((a, b) => a.date.localeCompare(b.date));
}

/** Texto pronto para o prompt da semana. */
export function datesContext(start: string, end: string, segment?: string | null, city?: string | null) {
  const list = datesBetween(start, end, segment, city);
  if (!list.length) return '';
  return 'Datas desta semana e da próxima (use quando fizer sentido para a marca): ' +
    list.map((d) => `${d.date.split('-').reverse().join('/')} ${d.label}${d.note ? ` (${d.note})` : ''}`).join('; ') + '.';
}

/** Converte o texto livre do cadastro em um segmento conhecido. */
export function toSegment(s?: string | null): Segment {
  if (s && s in SEGMENT_DATES) return s as Segment;
  const k = cityKey(s);
  if (k.includes('farm') || k.includes('drog')) return 'farmacia';
  if (k.includes('estet') || k.includes('saude') || k.includes('clinica') || k.includes('beleza')) return 'estetica';
  if (k.includes('aliment') || k.includes('restaur') || k.includes('lanch') || k.includes('pizz')) return 'alimentacao';
  if (k.includes('moda') || k.includes('roupa') || k.includes('loja')) return 'moda';
  if (k.includes('serv')) return 'servicos';
  return 'outro';
}
