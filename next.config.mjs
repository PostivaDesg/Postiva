/** @type {import('next').NextConfig} */
const fonts = ['./node_modules/@fontsource/*/files/*-latin-*-normal.woff'];
// rotas que montam o vídeo dos reels: levam o ffmpeg (binário) e as fontes das cenas
const reel = [...fonts, './node_modules/ffmpeg-static/ffmpeg'];
const nextConfig = {
  // ffmpeg-static acha o binário pelo próprio caminho: não pode ser empacotado
  serverExternalPackages: ['ffmpeg-static'],
  // As artes são geradas no servidor com as fontes dos pacotes @fontsource:
  // garante que os arquivos de fonte vão junto para a Vercel.
  outputFileTracingIncludes: {
    '/api/art/**': fonts,
    '/api/gestor/reels': reel,
    '/api/posts/[id]/approve': reel,
    '/api/posts/[id]/change': reel,
    '/api/posts/approve-all': reel,
    '/api/cron/alertas': reel,
    '/api/jobs/artes': reel,
  },
};
export default nextConfig;
