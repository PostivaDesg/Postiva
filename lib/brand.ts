// Monta o "perfil do Claude" juntando o que o gestor configurou (brand_profiles)
// com o que o cliente preencheu em "Minha marca" (companies).
import type { BrandProfile } from './claude';

export function buildBrand(company: any, brand: any): BrandProfile {
  const extra = [
    company.address && `Endereço: ${company.address}`,
    company.opening_hours && `Horário: ${company.opening_hours}`,
    company.whatsapp && `WhatsApp para pedidos (pode aparecer no CTA): ${company.whatsapp}`,
    company.site_url && `Site: ${company.site_url}`,
    company.objective && `Objetivo principal no Instagram: ${company.objective}`,
    company.audience && `Público: ${company.audience}`,
    company.products && `Produtos e preços informados pelo cliente:\n${company.products}`,
    company.competitors && `Concorrentes (nunca citar pelo nome): ${company.competitors}`,
    company.forbidden && `O cliente pediu para nunca dizer ou mostrar: ${company.forbidden}`,
    company.hashtags && `Hashtags fixas da marca (usar no fim das legendas do feed): ${company.hashtags}`,
    company.template_spec?.notes && `Modelo visual da marca: ${company.template_spec.notes}`,
  ].filter(Boolean).join('\n');

  return {
    companyName: company.name, instagram: company.instagram, segment: company.segment, city: company.city,
    briefing: [brand?.briefing, extra].filter(Boolean).join('\n\n'),
    tone: brand?.tone ?? '', rules: brand?.rules ?? '', visual: brand?.visual ?? '',
  };
}
