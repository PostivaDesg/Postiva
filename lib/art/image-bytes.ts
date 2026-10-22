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

/** Largura e altura de um PNG/JPG pelos bytes (sem bibliotecas). */
export function imageSize(bytes: Uint8Array): { w: number; h: number } | null {
  const mime = imageMime(bytes);
  if (mime === 'image/png' && bytes.length > 24) {
    const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    return { w: v.getUint32(16), h: v.getUint32(20) };
  }
  if (mime === 'image/jpeg') {
    let i = 2;
    while (i + 9 < bytes.length) {
      if (bytes[i] !== 0xff) { i++; continue; }
      const m = bytes[i + 1];
      const len = (bytes[i + 2] << 8) | bytes[i + 3];
      if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc) {
        return { h: (bytes[i + 5] << 8) | bytes[i + 6], w: (bytes[i + 7] << 8) | bytes[i + 8] };
      }
      i += 2 + len;
    }
  }
  return null;
}
