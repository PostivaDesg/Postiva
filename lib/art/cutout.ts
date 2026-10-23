// Tira o fundo da foto da embalagem. Foto de produto de loja virtual quase sempre vem em fundo branco (ou
// cinza bem claro, liso): o fundo é o que está ligado à borda da imagem e tem cor clara e sem saturação.
// Pinta esse fundo de transparente (com borda suave) e recorta a sobra, para a embalagem "entrar" na foto.
// Sem custo (roda na própria Vercel com o sharp). Se o fundo não for liso, devolve null e a foto fica como está.
import sharp from 'sharp';

const isBg = (r: number, g: number, b: number, ref: [number, number, number], tol: number) => {
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  return max - min < 28 && Math.abs(r - ref[0]) < tol && Math.abs(g - ref[1]) < tol && Math.abs(b - ref[2]) < tol;
};

export async function cutoutProduct(bytes: Uint8Array): Promise<Uint8Array | null> {
  try {
    const img = sharp(bytes).ensureAlpha();
    const meta = await img.metadata();
    const scale = Math.min(1, 1400 / Math.max(meta.width ?? 1, meta.height ?? 1));
    const { data, info } = await img.resize({ width: Math.round((meta.width ?? 1) * scale) }).raw().toBuffer({ resolveWithObject: true });
    const W = info.width, H = info.height, px = new Uint8ClampedArray(data.buffer, data.byteOffset, data.length);

    // cor de referência do fundo: média das bordas claras
    let n = 0, sr = 0, sg = 0, sb = 0, already = 0;
    const border: number[] = [];
    for (let x = 0; x < W; x++) border.push(x, (H - 1) * W + x);
    for (let y = 0; y < H; y++) border.push(y * W, y * W + W - 1);
    for (const i of border) {
      const o = i * 4;
      if (px[o + 3] < 20) { already++; continue; }
      if (Math.min(px[o], px[o + 1], px[o + 2]) > 200) { sr += px[o]; sg += px[o + 1]; sb += px[o + 2]; n++; }
    }
    if (already > border.length * 0.6) return square(await sharp(bytes).trim().png().toBuffer()); // já vem sem fundo
    if (n < border.length * 0.6) return null; // fundo não é claro e liso: não mexe
    const ref: [number, number, number] = [sr / n, sg / n, sb / n];

    // preenchimento a partir das bordas
    const seen = new Uint8Array(W * H);
    const stack: number[] = [];
    for (const i of border) {
      const o = i * 4;
      if (!seen[i] && isBg(px[o], px[o + 1], px[o + 2], ref, 26)) { seen[i] = 1; stack.push(i); }
    }
    while (stack.length) {
      const i = stack.pop()!;
      const x = i % W, y = (i / W) | 0;
      for (const j of [x > 0 ? i - 1 : -1, x < W - 1 ? i + 1 : -1, y > 0 ? i - W : -1, y < H - 1 ? i + W : -1]) {
        if (j < 0 || seen[j]) continue;
        const o = j * 4;
        if (isBg(px[o], px[o + 1], px[o + 2], ref, 26)) { seen[j] = 1; stack.push(j); }
      }
    }
    let bgCount = 0;
    for (let i = 0; i < W * H; i++) if (seen[i]) { px[i * 4 + 3] = 0; bgCount++; }
    if (bgCount < W * H * 0.15 || bgCount > W * H * 0.97) return null; // nada para tirar, ou sumiu o produto
    // borda suave: pixel do produto encostado no fundo fica meio transparente
    for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
      const i = y * W + x;
      if (seen[i]) continue;
      if (seen[i - 1] || seen[i + 1] || seen[i - W] || seen[i + W]) px[i * 4 + 3] = Math.min(px[i * 4 + 3], 150);
    }
    const out = await sharp(Buffer.from(px.buffer, px.byteOffset, px.length), { raw: { width: W, height: H, channels: 4 } })
      .png().toBuffer();
    return square(await sharp(out).trim({ threshold: 1 }).png().toBuffer());
  } catch {
    return null;
  }
}

/** Deixa a embalagem num quadrado transparente: o campo "produto" do modelo do Canva é quadrado e
 *  preenche cortando; assim a embalagem inteira aparece, sem cortar tampa nem fundo. */
async function square(png: Buffer): Promise<Uint8Array> {
  const m = await sharp(png).metadata();
  const w = m.width ?? 1, h = m.height ?? 1, side = Math.round(Math.max(w, h) * 1.06);
  const left = Math.floor((side - w) / 2), top = Math.floor((side - h) / 2);
  return new Uint8Array(await sharp(png).extend({ left, right: side - w - left, top, bottom: side - h - top, background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer());
}
