// Agendamento no Metricool depois que o cliente aprova (plano Advanced, o único com API).
// Formato conferido na documentação do Metricool:
// https://help.metricool.com/wli-scheduler-endpoint-example-on-a-custom-backend-proxy-frko7
//  - data SEM fuso no texto + fuso em campo separado
//  - saveExternalMediaFiles: true para o Metricool baixar a imagem/vídeo do nosso link
//  - Instagram: type POST, REEL ou STORY; story não leva legenda; reels pode ter capa própria

const BASE = process.env.METRICOOL_BASE_URL ?? 'https://app.metricool.com/api';

/** "2026-10-22T09:00:00-03:00" (ou ISO em UTC) → "2026-10-22T09:00:00" no horário de Brasília */
export function localDateTime(iso: string) {
  const d = new Date(Date.parse(iso) - 3 * 3600e3); // Brasil não tem horário de verão desde 2019
  return d.toISOString().slice(0, 19);
}

export async function schedulePost(p: {
  blogId: string;         // marca da empresa no Metricool (companies.metricool_blog_id)
  kind: 'story' | 'post' | 'reels';
  publishAt: string;      // data/hora do post
  caption: string;
  mediaUrl: string;       // arte (post/story) ou vídeo (reels)
  coverUrl?: string | null; // capa do reels (a arte gerada)
}) {
  const type = p.kind === 'story' ? 'STORY' : p.kind === 'reels' ? 'REEL' : 'POST';
  const body: Record<string, unknown> = {
    publicationDate: { dateTime: localDateTime(p.publishAt), timezone: 'America/Sao_Paulo' },
    providers: [{ network: 'instagram' }],
    media: [p.mediaUrl],
    saveExternalMediaFiles: true,
    autoPublish: true,
    draft: false,
    shortener: false,
    instagramData: { type, ...(type === 'REEL' ? { showReelOnFeed: true } : {}) },
  };
  if (type !== 'STORY') body.text = p.caption; // story não tem legenda no Instagram
  if (type === 'REEL' && p.coverUrl) body.videoThumbnailUrl = p.coverUrl;

  const url = `${BASE}/v2/scheduler/posts?blogId=${encodeURIComponent(p.blogId)}&userId=${encodeURIComponent(process.env.METRICOOL_USER_ID ?? '')}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Mc-Auth': process.env.METRICOOL_API_TOKEN ?? '' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Metricool: ${res.status} ${(await res.text()).slice(0, 300)}`);
  return res.json() as Promise<{ id?: string; data?: { id?: string } }>;
}
