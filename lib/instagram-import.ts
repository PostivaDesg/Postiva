// Fotos reais da própria empresa, tiradas do Instagram dela (posts e capas de reels, listados pelo Metricool).
// O Claude olha cada foto e separa: loja, equipe, produto (com o nome) ou descarta (texto grande por cima, arte pronta,
// foto ruim). As boas viram fotos da marca (company_assets) e passam a entrar nas artes no lugar de foto de banco.
import { readFile } from 'fs/promises';
import path from 'path';
import { supabaseAdmin } from './supabase';
import { anthropic, MODEL } from './claude';
import { imageMime, MAX_ART_IMAGE } from './art/image-bytes';
import { runLimited } from './art/stock';

/** Coloca na fila as fotos do Instagram da empresa (lista salva em data/instagram/<empresa>.json). */
export async function queueInstagramImports(companyId: string) {
  const file = path.join(process.cwd(), 'data', 'instagram', `${companyId}.json`);
  const list = JSON.parse(await readFile(file, 'utf8').catch(() => '[]')) as { url: string; caption?: string }[];
  if (!list.length) return 0;
  const db = supabaseAdmin();
  const { data: have } = await db.from('asset_imports').select('url').eq('company_id', companyId);
  const known = new Set((have ?? []).map((h) => h.url));
  const fresh = list.filter((x) => !known.has(x.url));
  if (fresh.length) await db.from('asset_imports').insert(fresh.map((x) => ({ company_id: companyId, url: x.url, caption: x.caption ?? null })));
  return fresh.length;
}

type Verdict = { usar: boolean; tipo: 'loja' | 'equipe' | 'produto' | 'outro'; nome: string; motivo?: string };

async function judgePhoto(bytes: Uint8Array, mime: string, caption: string | null): Promise<Verdict> {
  const res = await anthropic.messages.create({
    model: MODEL, max_tokens: 700,
    messages: [{ role: 'user', content: [
      { type: 'image', source: { type: 'base64', media_type: mime as 'image/jpeg' | 'image/png', data: Buffer.from(bytes).toString('base64') } },
      { type: 'text', text: `Foto do Instagram de uma farmácia/loja (legenda original: "${(caption ?? '').slice(0, 200)}").
Ela pode servir de FOTO para artes novas desta mesma loja?
SERVE: foto real (inclusive frame de vídeo) da fachada, do balcão, das prateleiras, da equipe, de produtos na loja, mesmo com marcas nas embalagens
e mesmo com o logo da própria Drogaria do Povão pequeno num canto.
NÃO SERVE: arte pronta/montagem (faixa ou bloco de texto grande, título por cima), fundo de banco de imagens com texto, foto muito borrada, preço grande em destaque.
Classifique: "loja" (fachada, balcão, prateleiras, interior), "equipe" (funcionários, atendimento), "produto" (produtos/embalagens em destaque) ou "outro".
Para produto, "nome" é o produto em português como é vendido (ex.: "shampoo Pantene"); para os outros, uma descrição curta da cena.
Responda SÓ com JSON: {"usar": true/false, "tipo": "...", "nome": "...", "motivo": "se não usar, por quê, em até 12 palavras"}` },
    ] }],
  });
  const text = res.content.filter((c) => c.type === 'text').map((c) => (c as { text: string }).text).join('');
  const j = JSON.parse(text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1)) as Verdict;
  return { usar: !!j.usar, tipo: ['loja', 'equipe', 'produto', 'outro'].includes(j.tipo) ? j.tipo : 'outro', nome: String(j.nome ?? '').slice(0, 80), motivo: j.motivo };
}

/** Processa a fila (até o tempo acabar). Devolve quantas ainda faltam. */
export async function processInstagramImports(companyId: string, timeLeft: () => number) {
  const db = supabaseAdmin();
  const { data: rows } = await db.from('asset_imports').select('id, url, caption').eq('company_id', companyId).eq('status', 'pendente').limit(60);
  const todo = rows ?? [];
  await runLimited(todo, 4, async (r) => {
    if (timeLeft() < 30_000) return;
    try {
      const resp = await fetch(r.url, { signal: AbortSignal.timeout(15000) });
      if (!resp.ok) throw new Error(`download ${resp.status}`);
      const bytes = new Uint8Array(await resp.arrayBuffer());
      const mime = bytes.length <= MAX_ART_IMAGE ? imageMime(bytes) : null;
      if (!mime) throw new Error('formato não suportado');
      const v = await judgePhoto(bytes, mime, r.caption);
      if (!v.usar) { await db.from('asset_imports').update({ status: 'descartada', note: v.motivo ?? null }).eq('id', r.id); return; }
      const kind = v.tipo === 'outro' ? 'loja' : v.tipo; // cena da própria loja sem categoria clara vale como "loja"
      const storagePath = `${companyId}/instagram/${r.id}.${mime === 'image/png' ? 'png' : 'jpg'}`;
      const { error } = await db.storage.from('marcas').upload(storagePath, bytes, { contentType: mime, upsert: true });
      if (error) throw new Error(error.message);
      await db.from('company_assets').insert({ company_id: companyId, kind, source: 'instagram', storage_path: storagePath, name: v.nome || kind });
      await db.from('asset_imports').update({ status: 'importada', note: `${kind}: ${v.nome}` }).eq('id', r.id);
    } catch (e) {
      await db.from('asset_imports').update({ status: 'erro', note: e instanceof Error ? e.message.slice(0, 200) : 'erro' }).eq('id', r.id);
    }
  });
  const { count } = await db.from('asset_imports').select('id', { count: 'exact', head: true }).eq('company_id', companyId).eq('status', 'pendente');
  return count ?? 0;
}
