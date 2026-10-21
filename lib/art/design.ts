// O Claude DESENHA o modelo visual de cada empresa a partir do que o cliente enviou:
// logo, cores, prints de posts que ele gosta e o perfil de inspiração.
// Uma chamada ao Claude por modelo (alguns centavos). Nenhum trabalho manual.
import Anthropic from '@anthropic-ai/sdk';
import { supabaseAdmin } from '../supabase';
import { downloadFile } from '../drive';
import { ART_DIRECTIONS, LAYOUTS } from '../styles';
import { toSegment } from '../dates';
import { FONT_FAMILIES } from './fonts';
import { normalizeSpec, type TemplateSpec } from './theme';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const MODEL = process.env.CLAUDE_MODEL ?? 'claude-sonnet-5-5';
const MAX_IMAGE = 4_500_000;
const TYPES = ['image/png', 'image/jpeg', 'image/webp'] as const;
type ImgType = (typeof TYPES)[number];

async function assetBytes(a: { storage_path: string | null; drive_file_id: string | null; name: string }) {
  try {
    if (a.storage_path) {
      const { data } = await supabaseAdmin().storage.from('marcas').download(a.storage_path);
      if (!data) return null;
      return { bytes: await data.arrayBuffer(), type: (data.type || 'image/jpeg') as string };
    }
    if (a.drive_file_id) {
      const ext = a.name.toLowerCase().split('.').pop();
      const type = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';
      return { bytes: await downloadFile(a.drive_file_id), type };
    }
  } catch { /* imagem indisponível: segue sem ela */ }
  return null;
}

/** Imagens que o Claude vai olhar: logo + até 5 referências (ou fotos da marca, se não houver referência). */
async function referenceImages(companyId: string) {
  const { data: assets } = await supabaseAdmin().from('company_assets')
    .select('id, kind, storage_path, drive_file_id, name').eq('company_id', companyId).order('created_at', { ascending: false }).limit(60);
  const pick = [
    ...(assets ?? []).filter((a) => a.kind === 'logo').slice(0, 1),
    ...(assets ?? []).filter((a) => a.kind === 'referencia').slice(0, 5),
  ];
  if (pick.length < 3) pick.push(...(assets ?? []).filter((a) => a.kind === 'loja' || a.kind === 'produto').slice(0, 3 - pick.length));
  const out: { label: string; data: string; type: ImgType }[] = [];
  for (const a of pick) {
    const b = await assetBytes(a);
    if (!b || b.bytes.byteLength > MAX_IMAGE || !TYPES.includes(b.type as ImgType)) continue;
    out.push({ label: a.kind === 'logo' ? 'LOGO da empresa' : a.kind === 'referencia' ? 'EXEMPLO que o cliente gostaria de seguir' : 'Foto real da empresa', data: Buffer.from(b.bytes).toString('base64'), type: b.type as ImgType });
  }
  return out;
}

/**
 * Desenha (ou redesenha) o modelo da empresa e salva como "aguardando aprovação".
 * `feedback`: o que o cliente/gestor pediu para mudar na versão anterior.
 */
export async function designTemplate(companyId: string, feedback?: string) {
  const db = supabaseAdmin();
  const { data: c } = await db.from('companies').select('*').eq('id', companyId).single();
  if (!c) throw new Error('Empresa não encontrada.');

  const segment = toSegment(c.segment);
  const directions = ART_DIRECTIONS[segment];
  const images = await referenceImages(companyId);

  // Modelos de outras empresas do mesmo segmento e cidade: o novo precisa ser diferente
  const { data: others } = await db.from('companies').select('name, template_spec, city')
    .neq('id', companyId).eq('segment', c.segment).not('template_spec', 'is', null).limit(20);
  const sameCity = (others ?? []).filter((o) => !c.city || (o.city ?? '').toLowerCase() === String(c.city).toLowerCase());
  const avoid = sameCity.map((o) => {
    const s = o.template_spec as TemplateSpec;
    return `- ${s.display}/${s.body}, cor ${s.palette?.primary}, logo ${s.logoPosition}, foto ${s.photoShape}, destaque ${s.accentShape}, layouts ${s.layouts?.join(',')}`;
  }).join('\n');

  const prompt = `Você é diretor de arte. Desenhe o MODELO VISUAL de Instagram da empresa abaixo, para posts e stories.

Empresa: ${c.name} · segmento: ${c.segment ?? '-'} · cidade: ${c.city ?? '-'}
Cores informadas pelo cliente: ${(c.brand_colors ?? []).join(', ') || 'não informou (tire do logo)'}
Perfil de inspiração que o cliente citou: ${c.reference_instagram ?? 'nenhum'} (você não consegue abrir o link; use os prints enviados)
Objetivo: ${c.objective ?? '-'} · Público: ${c.audience ?? '-'}

As imagens anexadas são: ${images.map((i, n) => `${n + 1}) ${i.label}`).join('; ') || 'nenhuma'}.
Siga o espírito dos EXEMPLOS (cores, peso das fontes, quanto texto, formas, uso de foto), sem copiar marcas de outras empresas.
Use as cores do logo e as informadas pelo cliente. Garanta contraste para leitura no celular.

${avoid ? `Outras empresas do mesmo segmento e cidade já usam estes modelos. O seu precisa ser CLARAMENTE diferente deles:\n${avoid}\n` : ''}
${feedback ? `Esta é uma NOVA VERSÃO. O pedido de mudança foi: "${feedback}". Mude de forma visível.\n` : ''}
Opções permitidas:
- Fontes (display e body): ${Object.keys(FONT_FAMILIES).join(', ')}
- Layouts (escolha 5 que combinem com os exemplos): ${Object.entries(LAYOUTS).map(([k, v]) => `${k} (${v})`).join('; ')}
- Estilos do segmento como ponto de partida: ${directions.map((d) => `${d.name}: ${d.brief}`).join(' | ')}

Responda SÓ com JSON:
{"palette":{"primary":"#RRGGBB","secondary":"#RRGGBB","bg":"#RRGGBB","ink":"#RRGGBB"},
"display":"","body":"","headlineCase":"upper|normal","headlineAlign":"left|center",
"logoPosition":"top-left|top-center|top-right|bottom-left|bottom-right",
"photoShape":"full|rounded|circle|arch|tilted","accentShape":"none|circle|bar|corner|dots|stripes|wave",
"frame":"none|thin|thick|inset","textBox":"none|solid|outline|underline","radius":0,
"density":"airy|balanced|bold","layouts":["","","","",""],
"notes":"3 a 5 frases: o que você tirou dos exemplos e como o modelo deve ser usado"}`;

  const res = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 3000,
    messages: [{
      role: 'user',
      content: [
        ...images.map((i) => ({ type: 'image' as const, source: { type: 'base64' as const, media_type: i.type, data: i.data } })),
        { type: 'text' as const, text: prompt },
      ],
    }],
  });
  const text = res.content.filter((x) => x.type === 'text').map((x) => (x as { text: string }).text).join('');
  const s = text.indexOf('{'), e = text.lastIndexOf('}');
  if (s < 0) throw new Error('O Claude não devolveu o modelo. Tente de novo.');
  const fallback = directions[0].layouts;
  const spec = normalizeSpec(JSON.parse(text.slice(s, e + 1)), fallback);
  spec.layouts = spec.layouts.filter((l) => l in LAYOUTS);
  if (spec.layouts.length < 3) spec.layouts = fallback;

  await db.from('companies').update({ template_spec: spec, template_status: 'aguardando' }).eq('id', companyId);
  await db.from('ai_usage').insert({
    company_id: companyId, model: MODEL, input_tokens: res.usage.input_tokens,
    output_tokens: res.usage.output_tokens, cache_read_tokens: res.usage.cache_read_input_tokens ?? 0,
  });
  return spec;
}
