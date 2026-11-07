// Motivos de desativação de uma empresa (escolhidos pelo gestor e mostrados ao cliente no aviso do painel).
export const MOTIVOS_INATIVA = {
  falta_pagamento: {
    label: 'Falta de pagamento',
    titulo: 'Conta suspensa por falta de pagamento',
    texto: 'Encontramos uma pendência no pagamento da sua assinatura. A criação das artes e os agendamentos estão pausados até a regularização. Fale com a equipe da Postiva para regularizar e voltar a postar.',
  },
  teste_expirado: {
    label: 'Período de teste expirado',
    titulo: 'Seu período de teste terminou',
    texto: 'Para continuar recebendo as artes e os agendamentos do seu Instagram, escolha um plano com a equipe da Postiva.',
  },
  manutencao: {
    label: 'Manutenção',
    titulo: 'Sua conta está em manutenção',
    texto: 'Nossa equipe está fazendo ajustes na sua conta. A criação das artes volta em breve, sem você precisar fazer nada.',
  },
  outro: {
    label: 'Outro motivo',
    titulo: 'Sua conta está pausada',
    texto: 'A criação das artes e os agendamentos estão pausados. Fale com a equipe da Postiva para saber mais.',
  },
} as const;

export type MotivoInativa = keyof typeof MOTIVOS_INATIVA;

export function motivoInativa(m: string | null | undefined) {
  return MOTIVOS_INATIVA[(m && m in MOTIVOS_INATIVA ? m : 'outro') as MotivoInativa];
}

export function parseMotivo(v: FormDataEntryValue | null): MotivoInativa {
  const s = String(v ?? '');
  return (s in MOTIVOS_INATIVA ? s : 'outro') as MotivoInativa;
}
