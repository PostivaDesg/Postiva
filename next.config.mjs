/** @type {import('next').NextConfig} */
const nextConfig = {
  // As artes são geradas no servidor com as fontes dos pacotes @fontsource:
  // garante que os arquivos de fonte vão junto para a Vercel.
  outputFileTracingIncludes: {
    '/api/art/**': ['./node_modules/@fontsource/*/files/*-latin-*-normal.woff'],
  },
};
export default nextConfig;
