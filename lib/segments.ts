// Modelos prontos por segmento: preenchem o perfil do Claude de um cliente novo
// para você só ajustar os detalhes. Os [colchetes] são o que falta preencher.
import type { Segment } from './dates';

interface Starter { briefing: string; tone: string; rules: string; visual: string; mix: string }

const COMMON_RULES = `- Nunca inventar preço, desconto, estoque, prazo ou depoimento.
- Usar só informações do briefing, do site ou da planilha de promoção.
- Toda promoção leva a validade: "Válido de X a Y ou enquanto durar o estoque."
- Se faltar informação para uma peça, deixar entre [colchetes] para revisão.`;

export const SEGMENT_STARTERS: Record<Segment, Starter> = {
  farmacia: {
    briefing: `Farmácia em [cidade/bairro]. Vende medicamentos de venda livre, genéricos, perfumaria, dermocosméticos, higiene e conveniência.
Atendimento: [presencial / delivery / WhatsApp]. Horário: [horário]. Endereço: [endereço].`,
    tone: 'Direto, moderno, acessível e humano. Sem formalidade excessiva e sem linguagem corporativa.',
    rules: `${COMMON_RULES}
- Nunca anunciar medicamento de tarja vermelha ou preta.
- Nunca prometer cura, indicação ou benefício terapêutico; orientar a procurar o farmacêutico ou o médico.
- Medicamentos de venda livre: incluir "Se persistirem os sintomas, o médico deverá ser consultado."`,
    visual: '[cores da marca], logo sempre preservado, fotos de produto em fundo limpo, texto legível no celular.',
    mix: 'Produtos e ofertas, dicas de saúde e cuidado, delivery, bastidores da equipe.',
  },
  estetica: {
    briefing: `Clínica de estética em [cidade/bairro]. Procedimentos: [lista com preços]. Profissionais: [nomes e registros].
Agendamento por [WhatsApp/site]. Horário: [horário].`,
    tone: 'Acolhedor, confiável e elegante, sem exagero. Explica com clareza, sem termos técnicos demais.',
    rules: `${COMMON_RULES}
- Nunca prometer resultado garantido nem usar "antes e depois" sem autorização por escrito do paciente.
- Não divulgar preço de procedimento médico quando a regra do conselho profissional proibir.`,
    visual: '[cores da marca], fotos reais da clínica e da equipe, muito espaço em branco.',
    mix: 'Procedimentos explicados, mitos e verdades, bastidores, depoimentos autorizados, agenda aberta.',
  },
  alimentacao: {
    briefing: `Restaurante/lanchonete em [cidade/bairro]. Cardápio: [pratos e preços]. Delivery por [iFood/próprio/WhatsApp].
Horário: [horário].`,
    tone: 'Descontraído, apetitoso e próximo. Frases curtas que dão fome.',
    rules: `${COMMON_RULES}
- Foto sempre do prato real da casa, nunca de banco de imagens.`,
    visual: '[cores da marca], fotos de comida bem iluminadas, close no prato.',
    mix: 'Pratos do dia, combos, bastidores da cozinha, horário e delivery.',
  },
  moda: {
    briefing: `Loja de moda em [cidade/bairro]. Peças: [categorias, numeração, faixa de preço]. Vende por [loja/site/WhatsApp].`,
    tone: 'Inspirador, confiante e próximo. Sugere combinações.',
    rules: `${COMMON_RULES}
- Mostrar só peças que estão em estoque.`,
    visual: '[cores da marca], fotos com modelo ou provador, fundo neutro.',
    mix: 'Lançamentos, looks montados, provador, promoções, bastidores.',
  },
  servicos: {
    briefing: `Empresa de [serviço] em [cidade]. Serviços: [lista e preços]. Atende por [canal].`,
    tone: 'Profissional, claro e prestativo.',
    rules: COMMON_RULES,
    visual: '[cores da marca], fotos reais de trabalhos feitos.',
    mix: 'Trabalhos feitos, dúvidas frequentes, como funciona, depoimentos autorizados.',
  },
  outro: {
    briefing: '[O que a empresa vende, para quem, onde e como atende.]',
    tone: '[Como a marca fala.]',
    rules: COMMON_RULES,
    visual: '[Cores, fontes e estilo das fotos.]',
    mix: '[Assuntos que entram no calendário.]',
  },
};
