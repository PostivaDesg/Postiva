import Anthropic from '@anthropic-ai/sdk';
import type { PostKind } from './plans';

export const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// Sonnet 5.5 para legendas e roteiros. Para baratear stories simples, troque por 'claude-haiku-5-5'.
export const MODEL = process.env.CLAUDE_MODEL ?? 'claude-sonnet-5-5';

/**
 * Escrever legendas não exige raciocínio longo. Desligar o raciocínio antecipado e usar esforço médio
 * deixa a geração mais rápida e mais barata (raciocínio é cobrado como texto gerado).
 * O nome dos campos é o da API do Claude (docs: build-with-claude/effort).
 */
export const ECONOMY = MODEL.includes('sonnet-5') ? { thinking: { type: 'between_tools' }, output_config: { effort: 'medium' } } : {};

export interface BrandProfile {
  companyName: string;
  instagram: string | null;
  segment: string | null;
  city: string | null;
  briefing: string;
  tone: string;
  rules: string;
  visual: string;
}

export interface GeneratedPiece {
  kind: PostKind;
  day: string;        // AAAA-MM-DD
  time: string;       // HH:MM
  title: string;
  caption: string;
  art_brief: string;
  reason: string;
  date_label?: string | null; // preenchido quando a peça é de data comemorativa ou feriado
  art_headline?: string;      // texto grande da arte (até 8 palavras)
  art_sub?: string | null;    // texto de apoio (até 16 palavras)
  art_cta?: string | null;    // botão (até 4 palavras), ex.: "Chame no WhatsApp"
  art_items?: string[] | null; // 3 itens curtos quando a arte é uma lista
  art_photo?: string | null;   // busca da foto de banco gratuito, em inglês (ex.: "woman headache office"), ou "loja"/"equipe"
  art_product?: string | null; // nome exato de uma foto de produto da empresa (lista no contexto da semana)
}

/** Instruções fixas da Postiva Design, iguais para todas as empresas. */
const BASE_RULES = `Você é o redator de Instagram da Postiva Design, uma agência que cuida do Instagram de pequenas empresas.
Escreva sempre em português do Brasil, com o tom de voz da marca descrito abaixo.
Nunca invente preço, promoção, resultado ou depoimento que não esteja no briefing.
Respeite TODAS as proibições da marca. Na dúvida, escreva algo mais neutro.
Cada peça precisa de: título interno curto, legenda pronta para publicar (posts e reels) ou texto da tela (stories),
um briefing da arte para o designer (o que a imagem mostra, texto na arte, cores) e uma frase explicando ao cliente por que essa peça foi escolhida.

Para nunca parecer texto de IA:
- Varie a abertura de cada peça (pergunta, número, frase curta, situação do dia a dia). Nunca duas peças seguidas começando igual.
- Evite clichês: "Descubra", "Você sabia?", "Não perca!", "Imperdível", "Venha conferir", "Garanta já", "transforme", "eleve".
- No máximo 2 emojis por legenda, e nenhum em sequência.
- Frases curtas, jeito de falar da cidade e do público da marca. Cite o bairro ou a cidade quando fizer sentido.
- Cada legenda com tamanho diferente: algumas de 1 linha, outras de 4 ou 5.

Texto DENTRO da arte (a arte é gerada automaticamente com o modelo da marca):
- art_headline: até 8 palavras, forte e legível no celular. Nunca repita a legenda inteira.
- art_sub: até 16 palavras, opcional. art_cta: até 4 palavras, opcional.
- art_items: 3 itens curtos só quando a peça for uma lista ou passo a passo.
- Sem preço inventado: preço só aparece se vier da promoção informada.
- art_photo: a foto da arte, como busca curta EM INGLÊS para um banco de fotos (2 a 5 palavras), ex.: "colorful fruit smoothies", "woman headache office", "mother baby bath".
  Fotos reais e com vida, combinando com o assunto da peça. Se a empresa vende produtos, a foto mostra o TIPO DE PRODUTO ligado ao tema
  (ex.: post "comece o dia com energia" numa farmácia → "vitamin c orange tablets"; protetor solar → "sunscreen beach"; fralda → "baby diaper").
  Em datas comemorativas, a foto é do símbolo da data (ex.: Natal → "christmas tree ornaments"; Carnaval → "carnival confetti masks").
  Nunca peça logotipos, marcas, caixas de remédio com nome, texto escrito ou celebridades. Nunca bebida alcoólica, bar, cigarro, armas
  ou qualquer coisa das proibições da marca.
  art_photo é OBRIGATÓRIO em TODA peça, nunca null: arte de cor lisa sem foto não é aceita. Dica, lista ou recado também têm foto da situação
  (ex.: "beba água" → "woman drinking water"; "pedido pelo WhatsApp" → "woman smartphone smiling"; Novembro Azul → "man doctor blue ribbon").
  Se a peça for sobre a própria loja ou a equipe, use exatamente "loja" ou "equipe" (a foto real da empresa entra no lugar).
- art_product: quando a peça falar de UM produto. Se o contexto trouxer "Fotos de produtos da loja" e o produto estiver lá, use o nome EXATO
  da lista. Senão, escreva o produto como ele é vendido (tipo + apresentação, ex.: "vitamina C efervescente 1g", "protetor solar facial FPS 50"),
  para a foto real da embalagem ser buscada. Nunca medicamento de tarja vermelha ou preta. Nunca preço. Peça sem produto: null.
  A foto, o título e a legenda falam da MESMA coisa.
Se o briefing trouxer hashtags fixas da marca, use-as no final da legenda dos posts no feed.

Datas comemorativas e feriados: são peças próprias e exclusivas desta marca, com mensagem afetiva ligada ao que a empresa faz (sem preço, a não ser que haja promoção informada). Marque essas peças com "date_label" igual ao nome da data.`;

function brandBlock(b: BrandProfile) {
  return `# Marca: ${b.companyName}
Instagram: ${b.instagram ?? '-'} · Segmento: ${b.segment ?? '-'} · Cidade: ${b.city ?? '-'}

## Briefing
${b.briefing}

## Tom de voz
${b.tone}

## Proibições e regras
${b.rules}

## Identidade visual
${b.visual}`;
}

/**
 * Gera o conteúdo de uma semana respeitando a cota.
 * O perfil da marca vai em cache, então as chamadas seguintes da mesma empresa ficam mais baratas.
 */
export interface WeekOpts {
  brand: BrandProfile;
  weekStart: string; // AAAA-MM-DD (segunda-feira)
  quota: Record<PostKind, number>;
  bestTimes?: string; // ex.: "stories 9h e 18h; posts 12h e 19h" (vindo do Metricool)
  extraContext?: string; // datas comemorativas, promoções da semana
  days?: { from: string; to: string; count: number; part: string }; // só um pedaço da semana (geração na hora, em paralelo)
}

/** Monta o pedido da semana (usado na geração imediata e no envio em lote de domingo). */
export function weekParams(opts: WeekOpts) {
  const { brand, weekStart, quota } = opts;
  const span = opts.days
    ? `Crie o conteúdo SÓ dos dias ${opts.days.from} a ${opts.days.to} (${opts.days.count} dias) da semana que começa em ${weekStart}. ${opts.days.part}`
    : `Crie o conteúdo da semana que começa em ${weekStart} (7 dias).`;
  const userPrompt = `${span}
Quantidades EXATAS: ${quota.story} stories, ${quota.post} posts no feed, ${quota.reels} reels.
Distribua por igual entre os dias.
Melhores horários da conta: ${opts.bestTimes ?? 'stories 09:00, 13:00 e 18:00; posts 12:00 e 19:00; reels 11:00'}.
${opts.extraContext ? `Contexto da semana: ${opts.extraContext}` : ''}

Responda SÓ com um array JSON, sem texto antes ou depois, neste formato:
[{"kind":"story|post|reels","day":"AAAA-MM-DD","time":"HH:MM","title":"...","caption":"...","art_brief":"...","reason":"...","art_headline":"...","art_sub":null,"art_cta":null,"art_items":null,"art_photo":"...","art_product":null,"date_label":null}]
(Em peça de data comemorativa ou feriado, "date_label" é o nome da data, ex.: "Dia das Crianças".)
Seja objetivo no art_brief (1 ou 2 frases): a arte é gerada automaticamente.`;
  return {
    model: MODEL,
    max_tokens: 32000,
    ...ECONOMY,
    system: [
      { type: 'text' as const, text: BASE_RULES },
      { type: 'text' as const, text: brandBlock(brand), cache_control: { type: 'ephemeral' as const } },
    ],
    messages: [{ role: 'user' as const, content: userPrompt }],
  };
}

/** Lê a resposta da semana (vale para a chamada direta e para o resultado do lote). */
export function parseWeek(msg: { content: { type: string }[]; usage: { input_tokens: number; output_tokens: number; cache_read_input_tokens?: number | null }; stop_reason?: string | null }) {
  const text = msg.content.filter((c) => c.type === 'text').map((c) => (c as unknown as { text: string }).text).join('');
  if (msg.stop_reason === 'max_tokens') throw new Error('A resposta do Claude veio cortada (semana grande demais). Gere de novo com menos peças.');
  return {
    pieces: parseJsonArray(text) as GeneratedPiece[],
    usage: {
      model: MODEL,
      input_tokens: msg.usage.input_tokens,
      output_tokens: msg.usage.output_tokens,
      cache_read_tokens: msg.usage.cache_read_input_tokens ?? 0,
    },
  };
}

/**
 * Gera o conteúdo de uma semana na hora (botão do gestor).
 * O perfil da marca vai em cache, então as chamadas seguintes da mesma empresa ficam mais baratas.
 */
export async function generateWeek(opts: WeekOpts) {
  // streaming: respostas grandes (semana inteira) passam de 10 minutos no limite do SDK sem ele
  const res = await anthropic.messages.stream(weekParams(opts) as any).finalMessage();
  return parseWeek(res as any);
}

/** Refaz uma peça a partir do pedido de ajuste do cliente. */
export async function revisePiece(brand: BrandProfile, piece: GeneratedPiece, clientNote: string) {
  const res = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 4000,
    ...(ECONOMY as any),
    system: [
      { type: 'text', text: BASE_RULES },
      { type: 'text', text: brandBlock(brand), cache_control: { type: 'ephemeral' } },
    ],
    messages: [{
      role: 'user',
      content: `O cliente pediu um ajuste nesta peça:\n${JSON.stringify(piece)}\n\nPedido do cliente: "${clientNote}"\n\nDevolva SÓ a peça ajustada, como um objeto JSON no mesmo formato.`,
    }],
  });
  const text = res.content.filter((c) => c.type === 'text').map((c) => (c as { text: string }).text).join('');
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  return {
    piece: JSON.parse(text.slice(start, end + 1)) as GeneratedPiece,
    usage: {
      model: MODEL,
      input_tokens: res.usage.input_tokens,
      output_tokens: res.usage.output_tokens,
      cache_read_tokens: res.usage.cache_read_input_tokens ?? 0,
    },
  };
}

/** Pedido rápido do cliente: uma peça sobre um assunto, para uma data. */
export async function generateQuick(brand: BrandProfile, req: { topic: string; kind: PostKind; day: string; extra?: string }) {
  const res = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 4000,
    ...(ECONOMY as any),
    system: [
      { type: 'text', text: BASE_RULES },
      { type: 'text', text: brandBlock(brand), cache_control: { type: 'ephemeral' } },
    ],
    messages: [{
      role: 'user',
      content: `O cliente pediu 1 ${req.kind} para ${req.day} sobre: "${req.topic}".
${req.extra ?? ''}
Se o pedido citar preço, promoção ou dado que não esteja no briefing, use exatamente o que o cliente escreveu; se faltar algo essencial, deixe entre [colchetes].
Responda SÓ com um objeto JSON: {"kind":"${req.kind}","day":"${req.day}","time":"HH:MM","title":"...","caption":"...","art_brief":"...","reason":"...","art_headline":"...","art_sub":null,"art_cta":null,"art_items":null,"art_photo":"...","art_product":null}`,
    }],
  });
  const text = res.content.filter((c) => c.type === 'text').map((c) => (c as { text: string }).text).join('');
  const s = text.indexOf('{'), e = text.lastIndexOf('}');
  return {
    piece: JSON.parse(text.slice(s, e + 1)) as GeneratedPiece,
    usage: { model: MODEL, input_tokens: res.usage.input_tokens, output_tokens: res.usage.output_tokens, cache_read_tokens: res.usage.cache_read_input_tokens ?? 0 },
  };
}

export interface PromoInput {
  name: string;
  brand: string | null;
  priceFrom: number | null;
  priceTo: number;
  photoUrl: string | null;
}

/**
 * Gera as peças de uma promoção. Preço e validade vêm SÓ do site ou da planilha.
 * Cada peça devolve "items": os índices dos produtos que ela anuncia.
 */
export async function generatePromo(opts: {
  brand: BrandProfile;
  items: PromoInput[];
  validFrom: string;  // AAAA-MM-DD
  validUntil: string; // AAAA-MM-DD
  formats: { postPerItem: boolean; storySequence: boolean; reels: boolean };
  limits: { post: number; story: number; reels: number }; // o que ainda resta na cota
}) {
  const brl = (n: number | null) => (n == null ? null : n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }));
  const list = opts.items.map((it, i) =>
    `${i}. ${it.name}${it.brand ? ` (${it.brand})` : ''} · ${it.priceFrom ? `de ${brl(it.priceFrom)} ` : ''}por ${brl(it.priceTo)}`).join('\n');
  const br = (d: string) => d.split('-').reverse().join('/');
  const want = [
    opts.formats.postPerItem && `1 post no feed por produto (máximo ${opts.limits.post})`,
    opts.formats.storySequence && `stories em sequência, 1 por produto (máximo ${opts.limits.story})`,
    opts.formats.reels && opts.limits.reels > 0 && '1 reels apresentando todos os produtos (roteiro de 15 a 30 segundos, cena por cena)',
  ].filter(Boolean).join('; ');

  const prompt = `Crie a campanha de promoção abaixo.
Validade: de ${br(opts.validFrom)} a ${br(opts.validUntil)}. Use exatamente o texto "Válido de ${br(opts.validFrom)} a ${br(opts.validUntil)} ou enquanto durar o estoque." em toda peça.
Produtos (use os preços EXATAMENTE como estão, sem arredondar e sem inventar desconto em %):
${list}

Peças: ${want}.
Distribua as datas entre ${opts.validFrom} e ${opts.validUntil}. No art_brief, diga que a foto é a do produto (fornecida) e onde vão preço "de" (riscado), preço "por" (em destaque) e a validade.

Responda SÓ com um array JSON:
[{"kind":"story|post|reels","day":"AAAA-MM-DD","time":"HH:MM","title":"...","caption":"...","art_brief":"...","reason":"...","art_headline":"...","art_sub":null,"art_cta":null,"art_items":null,"items":[0]}]`;

  const res = await anthropic.messages.stream({
    model: MODEL,
    max_tokens: 16000,
    ...(ECONOMY as any),
    system: [
      { type: 'text', text: BASE_RULES },
      { type: 'text', text: brandBlock(opts.brand), cache_control: { type: 'ephemeral' } },
    ],
    messages: [{ role: 'user', content: prompt }],
  }).finalMessage();
  const text = res.content.filter((c) => c.type === 'text').map((c) => (c as { text: string }).text).join('');
  return {
    pieces: parseJsonArray(text) as (GeneratedPiece & { items: number[] })[],
    usage: {
      model: MODEL,
      input_tokens: res.usage.input_tokens,
      output_tokens: res.usage.output_tokens,
      cache_read_tokens: res.usage.cache_read_input_tokens ?? 0,
    },
  };
}

function parseJsonArray(text: string) {
  const start = text.indexOf('[');
  const end = text.lastIndexOf(']');
  if (start < 0 || end < 0) throw new Error('O Claude não devolveu um JSON válido.');
  return JSON.parse(text.slice(start, end + 1));
}

/** Tema de foto (busca em inglês) para peças que ficaram sem art_photo. Uma chamada curta para todas. */
export async function photoQueries(items: { headline: string; caption?: string | null; segment?: string | null }[]) {
  if (!items.length) return [] as { q: string; p: string | null }[];
  const list = items.map((it, i) => `${i + 1}. ${it.headline}${it.caption ? ` — ${String(it.caption).slice(0, 140)}` : ''}`).join('\n');
  const res = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 2000,
    messages: [{
      role: 'user',
      content: `Para cada post de Instagram de ${items[0].segment ?? 'uma empresa'} abaixo, leia o título E a legenda e diga:
- "q": a busca de foto de banco EM INGLÊS (2 a 5 palavras) que mostra exatamente o produto, a pessoa ou a cena de que a legenda fala;
- "p": se a legenda fala de UM tipo de produto vendido na loja, o produto em português como é vendido (ex.: "protetor solar facial FPS 50"); senão null.
Sem marcas, sem texto, sem bebida alcoólica, sem remédio de tarja.\n${list}\n\nResponda SÓ com um array JSON de objetos {"n": número do post, "q": "busca", "p": "produto ou null"}, um para cada post.`,
    }],
  });
  const text = res.content.filter((c) => c.type === 'text').map((c) => (c as { text: string }).text).join('');
  try {
    const arr = JSON.parse(text.slice(text.indexOf('['), text.lastIndexOf(']') + 1)) as { n: number; q: string; p?: string | null }[];
    const out: { q: string; p: string | null }[] = items.map(() => ({ q: '', p: null }));
    for (const a of arr ?? []) if (a && Number(a.n) >= 1 && Number(a.n) <= items.length && a.q) out[Number(a.n) - 1] = { q: String(a.q), p: a.p && a.p !== 'null' ? String(a.p) : null };
    return out;
  } catch { return []; }
}
