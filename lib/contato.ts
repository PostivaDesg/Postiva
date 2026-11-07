// Contato oficial da Postiva para as páginas públicas (configure NEXT_PUBLIC_CONTACT_EMAIL e NEXT_PUBLIC_CONTACT_WHATSAPP na Vercel).
export const CONTATO = {
  email: process.env.NEXT_PUBLIC_CONTACT_EMAIL ?? '',
  whatsapp: (process.env.NEXT_PUBLIC_CONTACT_WHATSAPP ?? '').replace(/\D/g, ''),
  empresa: process.env.NEXT_PUBLIC_LEGAL_NAME ?? 'Postiva Design',
  cnpj: process.env.NEXT_PUBLIC_LEGAL_CNPJ ?? '',
};
export const canalContato = () =>
  [CONTATO.email && `pelo e-mail ${CONTATO.email}`, CONTATO.whatsapp && `pelo WhatsApp (${CONTATO.whatsapp.slice(-11, -9)}) ${CONTATO.whatsapp.slice(-9, -4)}-${CONTATO.whatsapp.slice(-4)}`]
    .filter(Boolean).join(' ou ') || 'pelos canais de atendimento informados no seu painel';
