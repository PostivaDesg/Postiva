// Aprendizado por empresa: o que o gestor descartou ou editou, o que o cliente pediu para ajustar e o que aprovou.
// Vai resumido no pedido da semana seguinte, para o Claude repetir o que funciona e evitar o que foi recusado.
import { supabaseAdmin } from './supabase';

type Kind = 'descartado' | 'editado' | 'ajuste' | 'aprovado';

export async function recordFeedback(companyId: string, kind: Kind, f: { post_kind?: string | null; title?: string | null; art_photo?: string | null; note?: string | null }) {
  try {
    await supabaseAdmin().from('feedback').insert({
      company_id: companyId, kind, post_kind: f.post_kind ?? null,
      title: f.title?.slice(0, 160) ?? null, art_photo: f.art_photo?.slice(0, 120) ?? null, note: f.note?.slice(0, 400) ?? null,
    });
  } catch { /* aprendizado nunca trava o fluxo */ }
}

/** Resumo dos últimos 90 dias para o pedido da semana (curto: entra no prompt toda semana). */
export async function learningContext(companyId: string) {
  const since = new Date(Date.now() - 90 * 864e5).toISOString();
  const { data } = await supabaseAdmin().from('feedback').select('kind, post_kind, title, art_photo, note')
    .eq('company_id', companyId).gte('created_at', since).order('created_at', { ascending: false }).limit(200);
  if (!data?.length) return '';
  const pick = (k: Kind, n: number) => data.filter((d) => d.kind === k).slice(0, n);
  const line = (d: any) => `- ${d.post_kind ? `[${d.post_kind}] ` : ''}"${d.title ?? ''}"${d.art_photo ? ` (foto: ${d.art_photo})` : ''}${d.note ? ` → ${d.note}` : ''}`;
  const parts: string[] = [];
  const disc = pick('descartado', 15);
  if (disc.length) parts.push(`O gestor DESCARTOU estas peças (não repita o tema, o tipo de foto nem o jeito; o motivo vem depois da seta):\n${disc.map(line).join('\n')}`);
  const adj = pick('ajuste', 10);
  if (adj.length) parts.push(`O CLIENTE pediu estes ajustes (aplique a lição em todas as peças novas):\n${adj.map(line).join('\n')}`);
  const ed = pick('editado', 10);
  if (ed.length) parts.push(`O gestor CORRIGIU estes textos antes de enviar (siga o jeito corrigido):\n${ed.map(line).join('\n')}`);
  const ok = pick('aprovado', 12);
  if (ok.length) parts.push(`O cliente APROVOU estas peças (é o estilo que funciona, varie a partir dele sem copiar):\n${ok.map(line).join('\n')}`);
  return `Aprendizados desta marca:\n${parts.join('\n\n')}`;
}
