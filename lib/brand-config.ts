// Nome e dados da marca em UM lugar só. Para trocar o nome, mude aqui (ou nas variáveis NEXT_PUBLIC_BRAND_*).
export const BRAND = {
  name: process.env.NEXT_PUBLIC_BRAND_NAME ?? 'Postiva Design',
  short: process.env.NEXT_PUBLIC_BRAND_SHORT ?? 'Postiva',
  slogan: process.env.NEXT_PUBLIC_BRAND_SLOGAN ?? 'Seu post, com design, todo dia.',
  site: process.env.NEXT_PUBLIC_SITE_URL ?? 'https://postivadesign.com.br',
  emailFrom: process.env.EMAIL_FROM ?? 'Postiva Design <avisos@postivadesign.com.br>',
  /** Assinatura nas artes de datas comemorativas */
  credit: process.env.CREDIT_TEXT ?? 'Arte: Postiva Design',
};
