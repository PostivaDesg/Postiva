// Tarefa em segundo plano da empresa: 1) refaz as fotos dos posts pedidos (em lotes) 2) monta as artes no Canva
// 3) monta os vídeos dos reels que faltam. Chamada pelo próprio site com o CRON_SECRET.
import { NextResponse, after } from 'next/server';
import { isCron } from '@/lib/cron';
import { kickArtes, type ArtesJob } from '@/lib/jobs';
import { refazerFotos } from '@/lib/refazer';
import { canvaArt, companyUsesCanva } from '@/lib/canva-art';
import { buildReel } from '@/lib/reels';
import { supabaseAdmin } from '@/lib/supabase';
import { processInstagramImports } from '@/lib/instagram-import';

export const maxDuration = 300;
const BUDGET = 230_000; // deixa folga para gravar e chamar a próxima rodada

export async function POST(req: Request) {
  if (!isCron(req)) return NextResponse.json({ error: 'não autorizado' }, { status: 401 });
  const job = await req.json() as ArtesJob;
  if (!job.companyId) return NextResponse.json({ error: 'sem empresa' }, { status: 400 });
  // segurança contra laço infinito: a tarefa inteira não passa de 1 hora
  const started = job.started ?? new Date().toISOString();
  if (Date.now() - Date.parse(started) > 3600_000) return NextResponse.json({ stopped: true });

  after(async () => {
    const t0 = Date.now();
    const left = () => BUDGET - (Date.now() - t0);
    const db = supabaseAdmin();
    let fotos = [...(job.fotos ?? [])];
    try {
      // 0) fotos reais do Instagram da empresa (antes de escolher as fotos dos posts)
      if (job.importar) {
        const faltam = await processInstagramImports(job.companyId, left);
        if (faltam > 0) return void (await kickArtes({ ...job, started }));
        job.importar = false;
      }

      // 1) fotos, de 8 em 8 posts
      while (fotos.length && left() > 120_000) {
        const lote = fotos.slice(0, 8);
        await refazerFotos(job.companyId, lote).catch((e) => console.error('[jobs] fotos', e));
        fotos = fotos.slice(8);
      }
      if (fotos.length) return void (await kickArtes({ ...job, fotos, started }));

      // 2) artes no Canva (rascunhos e posts esperando aprovação cuja arte está faltando ou velha)
      if (await companyUsesCanva(job.companyId)) {
        const { data } = await db.from('posts').select('id, art_png_path, art_version').eq('company_id', job.companyId)
          .in('status', ['rascunho', 'aguardando']).order('scheduled_at').limit(150);
        const pending = (data ?? []).filter((p) => !String(p.art_png_path ?? '').includes(`-v${p.art_version ?? 1}.png`));
        const failed = new Set<string>();
        for (const p of pending) {
          if (left() < 40_000) return void (await kickArtes({ ...job, fotos: [], started }));
          await canvaArt(p.id).catch((e) => { failed.add(p.id); console.error('[jobs] canva', p.id, e instanceof Error ? e.message : e); });
        }
      }

      // 3) vídeos dos reels sem vídeo
      if (job.reels !== false) {
        const { data: reels } = await db.from('posts').select('id').eq('company_id', job.companyId).eq('kind', 'reels')
          .in('status', ['rascunho', 'aguardando']).is('video_path', null).limit(10);
        for (const r of reels ?? []) {
          if (left() < 90_000) return void (await kickArtes({ ...job, fotos: [], started }));
          await buildReel(r.id).catch((e) => console.error('[jobs] reels', r.id, e));
        }
      }
    } catch (e) {
      console.error('[jobs] artes', e);
    }
  });
  return NextResponse.json({ ok: true, started });
}
