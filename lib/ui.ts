// Textos e formatos usados em várias telas.
export const KIND: Record<string, string> = { story: 'Story', post: 'Post', reels: 'Reels' };
export const STATUS: Record<string, string> = {
  rascunho: 'Em revisão', aguardando: 'Esperando você', ajuste: 'Em ajuste', aprovado: 'Aprovado',
  agendado: 'Agendado', publicado: 'Publicado',
};
export const STATUS_GESTOR: Record<string, string> = { ...STATUS, rascunho: 'Rascunho', aguardando: 'Com o cliente' };
export const tz = 'America/Sao_Paulo';
export const quando = (iso: string) => new Date(iso).toLocaleString('pt-BR', { timeZone: tz, weekday: 'short', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
export const diaCurto = (iso: string) => new Date(iso).toLocaleDateString('pt-BR', { timeZone: tz, day: '2-digit', month: '2-digit' });
export const brl = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
/** AAAA-MM-DD no horário de Brasília */
export const ymd = (d: Date) => new Date(d.getTime() - 3 * 3600e3).toISOString().slice(0, 10);
/** Últimos n dias (AAAA-MM-DD), do mais antigo ao de hoje */
export const lastDays = (n: number) => Array.from({ length: n }, (_, i) => ymd(new Date(Date.now() - (n - 1 - i) * 864e5)));
/** Segunda-feira da semana atual (Brasília) */
export function mondayOf(d = new Date()) {
  const br = new Date(d.getTime() - 3 * 3600e3);
  const back = (br.getUTCDay() + 6) % 7;
  return new Date(br.getTime() - back * 864e5).toISOString().slice(0, 10);
}
export const addDays = (day: string, n: number) => new Date(Date.parse(`${day}T12:00:00Z`) + n * 864e5).toISOString().slice(0, 10);
