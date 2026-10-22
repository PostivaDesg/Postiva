// Reels montado pelo próprio site: capa (a arte do post) + 3 ou 4 cenas com foto e frase + cartão final com o
// logo e o WhatsApp. Cada cena tem um zoom lento e as cenas se cruzam em fade. Sai um MP4 vertical de ~15 s.
// Sem custo por vídeo (ffmpeg roda na própria Vercel). O cliente só envia vídeo se QUISER um reels com ele.
// Música: a API do Instagram/Metricool não coloca música licenciada; o vídeo sai com áudio mudo.
import React from 'react';
import { ImageResponse } from 'next/og';
import { spawn } from 'child_process';
import { mkdtemp, writeFile, readFile, rm } from 'fs/promises';
import { tmpdir } from 'os';
import path from 'path';
import { supabaseAdmin } from './supabase';
import { renderPostArt, companyTheme } from './art/post-art';
import { logoDataUrl } from './art/assets';
import { fontsFor } from './art/fonts';
import { pickStockPhotos, stockDataUrl, bannedWords } from './art/stock';
import type { Theme } from './art/theme';

const W = 1080, H = 1920, FPS = 25, FADE = 0.4;

export type ReelScene = { text: string; photo?: string | null };

function ffmpegPath() {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const p = require('ffmpeg-static') as string | null;
  if (!p) throw new Error('ffmpeg não encontrado no servidor.');
  return p;
}

function run(bin: string, args: string[], timeoutMs = 240000) {
  return new Promise<void>((resolve, reject) => {
    const proc = spawn(bin, args, { stdio: ['ignore', 'ignore', 'pipe'] });
    let err = '';
    proc.stderr.on('data', (d) => { err = (err + d.toString()).slice(-2000); });
    const t = setTimeout(() => { proc.kill('SIGKILL'); reject(new Error('A montagem do vídeo passou do tempo.')); }, timeoutMs);
    proc.on('close', (code) => { clearTimeout(t); code === 0 ? resolve() : reject(new Error(`ffmpeg falhou: ${err.split('\n').slice(-3).join(' ')}`)); });
  });
}

async function png(node: React.ReactElement, theme: Theme) {
  const res = new ImageResponse(node, { width: W, height: H, fonts: await fontsFor(theme.display, theme.body) });
  return Buffer.from(await res.arrayBuffer());
}

function Scene({ t, photo, text, logo, n, total }: { t: Theme; photo: string | null; text: string; logo: string | null; n: number; total: number }) {
  return (
    <div style={{ width: W, height: H, display: 'flex', position: 'relative', background: t.palette.primary, fontFamily: t.body }}>
      {photo && <img src={photo} style={{ position: 'absolute', left: 0, top: 0, width: W, height: H, objectFit: 'cover' }} />}
      <div style={{ position: 'absolute', left: 0, top: 0, width: W, height: H, display: 'flex',
        backgroundImage: `linear-gradient(to bottom, rgba(0,0,0,0.05) 35%, ${t.palette.primary}CC 70%, ${t.palette.primary} 100%)` }} />
      <div style={{ position: 'absolute', left: 80, right: 80, bottom: 380, display: 'flex', flexDirection: 'column', gap: 18 }}>
        <div style={{ display: 'flex', fontFamily: t.display, fontWeight: 700, fontSize: text.length > 34 ? 82 : 100, lineHeight: 1.05, color: '#FFFFFF',
          textTransform: t.headlineCase === 'upper' ? 'uppercase' : 'none', letterSpacing: -1 }}>{text}</div>
        <div style={{ display: 'flex', gap: 10 }}>
          {Array.from({ length: total }).map((_, i) => <div key={i} style={{ display: 'flex', width: i === n ? 60 : 22, height: 10, borderRadius: 5, background: i === n ? t.palette.secondary : 'rgba(255,255,255,0.55)' }} />)}
        </div>
      </div>
      {logo && <div style={{ position: 'absolute', left: 0, right: 0, bottom: 150, display: 'flex', justifyContent: 'center' }}><img src={logo} style={{ height: 120, maxWidth: 420, objectFit: 'contain' }} /></div>}
    </div>
  );
}

function EndCard({ t, logo, name, whatsapp, city }: { t: Theme; logo: string | null; name: string; whatsapp?: string | null; city?: string | null }) {
  return (
    <div style={{ width: W, height: H, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 44, background: t.palette.primary, fontFamily: t.body, padding: 90 }}>
      <div style={{ display: 'flex', background: '#FFFFFF', borderRadius: 48, padding: '44px 56px' }}>
        {logo ? <img src={logo} style={{ height: 220, maxWidth: 640, objectFit: 'contain' }} />
          : <div style={{ display: 'flex', fontFamily: t.display, fontSize: 80, fontWeight: 700, color: t.palette.primary }}>{name}</div>}
      </div>
      <div style={{ display: 'flex', fontFamily: t.display, fontWeight: 700, fontSize: 84, color: t.onPrimary, textAlign: 'center' }}>Chame no WhatsApp</div>
      {whatsapp && <div style={{ display: 'flex', background: t.palette.secondary, color: t.onSecondary, fontSize: 64, fontWeight: 700, borderRadius: 999, padding: '22px 54px' }}>{whatsapp}</div>}
      {city && <div style={{ display: 'flex', fontSize: 40, color: t.onPrimary, opacity: 0.85 }}>{city}</div>}
    </div>
  );
}

/** Monta o vídeo do reels, envia ao armazenamento e grava no post (video_path + video_auto). */
export async function buildReel(postId: string) {
  const db = supabaseAdmin();
  const { data: post } = await db.from('posts').select('*').eq('id', postId).single();
  if (!post || post.kind !== 'reels') throw new Error('Post não é um reels.');
  const { data: company } = await db.from('companies').select('*').eq('id', post.company_id).single();
  if (!company) throw new Error('Empresa não encontrada.');
  const theme = await companyTheme(company);
  const logo = await logoDataUrl(company.id);

  // Cenas: as que o Claude escreveu; sem elas, frases curtas tiradas da legenda
  let scenes: ReelScene[] = Array.isArray(post.reel_scenes) ? post.reel_scenes : [];
  if (!scenes.length) {
    scenes = String(post.caption ?? '').split(/(?<=[.!?])\s+|\n+/).map((s) => s.replace(/#\S+/g, '').trim())
      .filter((s) => s.length > 8 && s.length < 70).slice(0, 3).map((text) => ({ text, photo: post.art_photo }));
  }
  scenes = scenes.slice(0, 4);
  const photos = await pickStockPhotos(company.id, scenes.map((s) => s.photo ?? post.art_photo), bannedWords(company.forbidden));
  const dataUrls = await Promise.all(photos.map((p) => stockDataUrl(p)));

  const dir = await mkdtemp(path.join(tmpdir(), 'reel-'));
  try {
    const files: { file: string; dur: number }[] = [];
    // capa = a própria arte do post (formato vertical)
    const cover = await renderPostArt(postId);
    if (cover) { const f = path.join(dir, 's0.png'); await writeFile(f, Buffer.from(await cover.arrayBuffer())); files.push({ file: f, dur: 2.6 }); }
    for (let i = 0; i < scenes.length; i++) {
      const f = path.join(dir, `s${i + 1}.png`);
      await writeFile(f, await png(<Scene t={theme} photo={dataUrls[i]} text={scenes[i].text} logo={logo} n={i} total={scenes.length} />, theme));
      files.push({ file: f, dur: 3 });
    }
    const end = path.join(dir, 'end.png');
    await writeFile(end, await png(<EndCard t={theme} logo={logo} name={company.name} whatsapp={company.whatsapp} city={company.city} />, theme));
    files.push({ file: end, dur: 2.6 });

    // ffmpeg: zoom lento em cada imagem + fade entre elas + áudio mudo (compatibilidade)
    const args: string[] = ['-y'];
    files.forEach((f) => args.push('-i', f.file));
    args.push('-f', 'lavfi', '-i', 'anullsrc=r=44100:cl=stereo');
    const parts: string[] = files.map((f, i) => {
      const frames = Math.round(f.dur * FPS);
      return `[${i}:v]scale=${Math.round(W * 1.12)}:${Math.round(H * 1.12)},zoompan=z='min(zoom+0.0011,1.1)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=${frames}:s=${W}x${H}:fps=${FPS},setsar=1,format=yuv420p[v${i}]`;
    });
    let last = 'v0', offset = 0;
    for (let i = 1; i < files.length; i++) {
      offset += files[i - 1].dur - FADE;
      const out = i === files.length - 1 ? 'vout' : `x${i}`;
      parts.push(`[${last}][v${i}]xfade=transition=fade:duration=${FADE}:offset=${offset.toFixed(2)}[${out}]`);
      last = out;
    }
    if (files.length === 1) parts.push('[v0]copy[vout]');
    const total = files.reduce((s, f) => s + f.dur, 0) - FADE * (files.length - 1);
    const mp4 = path.join(dir, 'reel.mp4');
    args.push('-filter_complex', parts.join(';'), '-map', '[vout]', '-map', `${files.length}:a`, '-t', total.toFixed(2),
      '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '23', '-pix_fmt', 'yuv420p', '-r', String(FPS),
      '-c:a', 'aac', '-b:a', '96k', '-movflags', '+faststart', mp4);
    await run(ffmpegPath(), args);

    const bytes = await readFile(mp4);
    const storagePath = `${company.id}/${post.id}-auto.mp4`;
    const { error } = await db.storage.from('videos').upload(storagePath, bytes, { contentType: 'video/mp4', upsert: true });
    if (error) throw new Error(`Falha ao guardar o vídeo: ${error.message}`);
    await db.from('posts').update({ video_path: storagePath, video_auto: true }).eq('id', post.id);
    return { path: storagePath, seconds: Math.round(total), sizeMB: +(bytes.length / 1048576).toFixed(1) };
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}
