// O gerador de artes só lê PNG e JPG. Confere pelos primeiros bytes do arquivo (o tipo informado às vezes mente)
// e recusa arquivo grande demais (deixaria a arte lenta ou estouraria a memória).
export const MAX_ART_IMAGE = 6 * 1024 * 1024;

export function imageMime(bytes: Uint8Array): 'image/png' | 'image/jpeg' | null {
  if (bytes.length > 3 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return 'image/png';
  if (bytes.length > 2 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg';
  return null;
}

/** Bytes → data URL pronta para a arte, ou null se não for PNG/JPG ou for grande demais. */
export function toArtDataUrl(buf: ArrayBuffer | Uint8Array) {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  if (!bytes.length || bytes.length > MAX_ART_IMAGE) return null;
  const mime = imageMime(bytes);
  return mime ? `data:${mime};base64,${Buffer.from(bytes).toString('base64')}` : null;
}

/** Baixa uma imagem da internet (com tempo-limite) e devolve a data URL da arte, ou null. */
export async function remoteToDataUrl(url: string | null | undefined) {
  if (!url) return null;
  if (url.startsWith('data:')) return url;
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(10000) });
    return r.ok ? toArtDataUrl(await r.arrayBuffer()) : null;
  } catch { return null; }
}
