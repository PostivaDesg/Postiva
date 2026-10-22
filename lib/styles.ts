// Identidade visual por empresa: para nenhuma marca parecer com outra, e nenhum post parecer "feito por IA".
//
// Como funciona:
// 1. Cada empresa recebe uma DIREÇÃO DE ARTE do seu segmento (a menos usada entre as empresas
//    do mesmo segmento e da mesma cidade). Duas farmácias de Cabo Frio nunca saem iguais.
// 2. Cada direção tem vários LAYOUTS. O sistema faz rodízio: o mesmo layout não se repete
//    nos últimos posts daquela empresa.
// 3. DATAS COMEMORATIVAS e FERIADOS têm layouts próprios. Na mesma data, cada empresa recebe
//    um layout diferente das outras, e a arte leva a assinatura da Postiva Design.
import { supabaseAdmin } from './supabase';
import type { Segment } from './dates';
import type { PostKind } from './plans';
import { BRAND } from './brand-config';

export interface ArtDirection {
  id: string;
  name: string;
  brief: string;      // vai no briefing da arte (designer/Canva)
  layouts: string[];  // ids de LAYOUTS
}

export const LAYOUTS: Record<string, string> = {
  'foto-faixa': 'foto cheia com degradê da cor da marca subindo do rodapé, título em faixas uma por linha e logo centralizado embaixo',
  'foto-cheia': 'foto ocupando a arte inteira, texto curto numa faixa no rodapé',
  'divisao-vertical': 'arte dividida ao meio: foto de um lado, texto do outro',
  'cartao-central': 'cartão central com bordas arredondadas sobre fundo de cor da marca',
  'tipografico': 'só tipografia grande, sem foto, uma palavra em destaque',
  'produto-flutuante': 'produto recortado no centro, sombra suave, fundo liso',
  'colagem': 'colagem de 2 a 3 fotos com recortes irregulares',
  'moldura': 'foto com moldura grossa na cor da marca e texto na moldura',
  'diagonal': 'faixa diagonal de cor cruzando a foto, texto na faixa',
  'lista-numerada': 'lista numerada de 3 itens, ícones simples',
  'faixa-preco': 'produto à esquerda, faixa de preço grande à direita',
  'citacao': 'frase entre aspas grandes, nome/assinatura embaixo',
  'polaroid': 'foto em estilo polaroid levemente inclinada, legenda manuscrita',
};

export const DATE_LAYOUTS: Record<string, string> = {
  'data-tipografica': 'nome da data em tipografia grande e expressiva, sem foto',
  'data-foto-equipe': 'foto real da equipe ou da loja com mensagem curta da data',
  'data-ilustrada': 'ilustração simples e plana ligada à data, cores da marca',
  'data-minimalista': 'fundo liso, ícone pequeno e uma frase curta, muito espaço vazio',
  'data-moldura': 'moldura decorativa temática com a mensagem no centro',
  'data-produto': 'produto da loja ligado à data, sem preço, com mensagem afetiva',
  'data-colagem': 'colagem de elementos da data em recortes de papel',
  'data-carta': 'formato de bilhete ou carta escrita à mão',
  'data-festiva': 'foto temática cheia da data, título manuscrito grande, logo e cidade no rodapé',
};

const D = (id: string, name: string, brief: string, layouts: string[]): ArtDirection => ({ id, name, brief, layouts });

export const ART_DIRECTIONS: Record<Segment, ArtDirection[]> = {
  farmacia: [
    D('farm-clean', 'Clínica e limpa', 'fundo branco, uma cor de destaque, ícones finos, fotos de produto em fundo limpo', ['produto-flutuante', 'faixa-preco', 'lista-numerada', 'cartao-central', 'tipografico']),
    D('farm-pop', 'Varejo vibrante', 'cores fortes da marca, tipografia pesada, preço sempre em destaque', ['faixa-preco', 'diagonal', 'produto-flutuante', 'moldura', 'tipografico']),
    D('farm-cuidado', 'Cuidado próximo', 'tons suaves, fotos de pessoas reais e da equipe, cantos arredondados', ['foto-cheia', 'divisao-vertical', 'citacao', 'cartao-central', 'polaroid']),
  ],
  estetica: [
    D('est-luxo', 'Elegante editorial', 'muito espaço vazio, serifada fina, fotos em tons neutros', ['foto-cheia', 'tipografico', 'divisao-vertical', 'citacao', 'moldura']),
    D('est-natural', 'Natural e leve', 'tons terrosos, texturas orgânicas, luz natural', ['polaroid', 'colagem', 'cartao-central', 'foto-cheia', 'lista-numerada']),
    D('est-moderna', 'Moderna geométrica', 'formas geométricas, cor de destaque viva, sans-serif', ['diagonal', 'divisao-vertical', 'tipografico', 'lista-numerada', 'cartao-central']),
  ],
  alimentacao: [
    D('ali-rustico', 'Rústico apetitoso', 'madeira, papel kraft, fotos quentes em close', ['foto-cheia', 'polaroid', 'colagem', 'faixa-preco', 'moldura']),
    D('ali-street', 'Street food', 'cores saturadas, tipografia de cartaz, recortes', ['diagonal', 'produto-flutuante', 'faixa-preco', 'tipografico', 'colagem']),
    D('ali-caseiro', 'Caseiro afetivo', 'tons pastel, letras manuscritas, toalha de mesa', ['polaroid', 'citacao', 'foto-cheia', 'cartao-central', 'lista-numerada']),
  ],
  moda: [
    D('moda-editorial', 'Editorial', 'fotos grandes, tipografia fina, layout de revista', ['foto-cheia', 'divisao-vertical', 'tipografico', 'moldura', 'colagem']),
    D('moda-urbana', 'Urbana', 'contraste alto, textura de concreto, tipografia condensada', ['diagonal', 'colagem', 'foto-cheia', 'tipografico', 'faixa-preco']),
  ],
  servicos: [
    D('serv-confianca', 'Confiança', 'azul ou verde sóbrio, ícones, fotos de trabalho real', ['lista-numerada', 'divisao-vertical', 'citacao', 'cartao-central', 'foto-cheia']),
    D('serv-direto', 'Direto ao ponto', 'tipografia grande, uma cor forte, pouco texto', ['tipografico', 'diagonal', 'cartao-central', 'lista-numerada', 'moldura']),
  ],
  outro: [
    D('geral-a', 'Clássico da marca', 'cores e fontes da marca, composição equilibrada', ['foto-cheia', 'cartao-central', 'divisao-vertical', 'tipografico', 'lista-numerada']),
    D('geral-b', 'Ousado', 'cor forte de fundo, tipografia grande, recortes', ['diagonal', 'colagem', 'tipografico', 'moldura', 'produto-flutuante']),
  ],
};

export function directionById(id?: string | null) {
  for (const list of Object.values(ART_DIRECTIONS)) {
    const d = list.find((x) => x.id === id);
    if (d) return d;
  }
  return ART_DIRECTIONS.outro[0];
}

/** Escolhe a direção menos usada no mesmo segmento e cidade (chamado ao cadastrar a empresa). */
export async function pickDirection(segment: Segment, city?: string | null) {
  const options = ART_DIRECTIONS[segment] ?? ART_DIRECTIONS.outro;
  const { data } = await supabaseAdmin().from('companies').select('art_style, city').in('art_style', options.map((o) => o.id));
  const sameCity = (c: { city: string | null }) => !city || (c.city ?? '').toLowerCase() === city.toLowerCase();
  const count = (id: string) => (data ?? []).filter((c) => c.art_style === id && sameCity(c)).length;
  return [...options].sort((a, b) => count(a.id) - count(b.id))[0].id;
}

/**
 * Distribui layouts para as peças novas de uma empresa, sem repetir os últimos usados.
 * Peças de data comemorativa recebem um layout de data que nenhuma outra empresa usou na mesma data.
 */
export async function assignLayouts(
  companyId: string, styleId: string | null,
  pieces: { kind: PostKind; date_label?: string | null; day: string }[],
  specLayouts?: string[] | null, // layouts que o Claude escolheu ao desenhar o modelo da empresa
) {
  const db = supabaseAdmin();
  const base = directionById(styleId);
  const custom = (specLayouts ?? []).filter((l) => l in LAYOUTS);
  const dir = custom.length >= 3 ? { ...base, layouts: custom } : base;
  const { data: recent } = await db.from('posts').select('layout, kind').eq('company_id', companyId)
    .not('layout', 'is', null).order('created_at', { ascending: false }).limit(30);
  const history: Record<string, string[]> = {};
  for (const r of recent ?? []) (history[r.kind] ??= []).push(r.layout);

  const out: { layout: string; brief: string; isDate: boolean }[] = [];
  const localDates: string[] = []; // a mesma empresa com story + post da mesma data: layouts diferentes
  for (const p of pieces) {
    if (p.date_label) {
      const layout = await uniqueDateLayout(p.date_label, p.day, companyId, localDates);
      localDates.push(layout);
      out.push({ layout, brief: `${DATE_LAYOUTS[layout]}; estilo da marca: ${dir.brief}`, isDate: true });
      continue;
    }
    const used = history[p.kind] ??= [];
    // o layout usado há mais tempo (ou nunca usado) vai primeiro
    const layout = [...dir.layouts].sort((a, b) => rank(used, a) - rank(used, b))[0];
    used.unshift(layout);
    out.push({ layout, brief: `${LAYOUTS[layout]}; estilo da marca: ${dir.brief}`, isDate: false });
  }
  return out;
}

const rank = (used: string[], l: string) => { const i = used.indexOf(l); return i < 0 ? -1e9 : -i; };

/** Na mesma data comemorativa, cada empresa recebe um layout diferente das demais. */
async function uniqueDateLayout(label: string, day: string, companyId: string, alsoTaken: string[] = []) {
  const from = new Date(Date.parse(day) - 10 * 864e5).toISOString();
  const to = new Date(Date.parse(day) + 10 * 864e5).toISOString();
  const { data } = await supabaseAdmin().from('posts').select('layout, company_id')
    .eq('date_label', label).gte('scheduled_at', from).lte('scheduled_at', to).neq('company_id', companyId);
  const taken = [...(data ?? []).map((r) => r.layout), ...alsoTaken, ...alsoTaken]; // os da própria empresa pesam mais
  const all = Object.keys(DATE_LAYOUTS);
  // livre primeiro; se todos já saíram (muitas empresas), o menos repetido
  return [...all].sort((a, b) => taken.filter((t) => t === a).length - taken.filter((t) => t === b).length)[0];
}

/** Texto da assinatura que vai nas artes de datas (e em todas, se a empresa autorizar). */
export const CREDIT_TEXT = BRAND.credit;
