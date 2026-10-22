// Tarefas em segundo plano: continuam rodando mesmo se o gestor fechar a página ou o celular bloquear a tela.
// Cada chamada trabalha até ~4 minutos e, se ainda faltar coisa, chama a si mesma de novo (limite da Vercel: 5 min).
export type ArtesJob = { companyId: string; fotos: string[]; reels?: boolean; started?: string };

export async function kickArtes(job: ArtesJob) {
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://postiva-design.vercel.app';
  // a rota responde na hora (o trabalho segue no "after"), então esperar a resposta é rápido
  await fetch(`${base}/api/jobs/artes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.CRON_SECRET}` },
    body: JSON.stringify(job),
    signal: AbortSignal.timeout(15000),
  }).catch((e) => console.error('[jobs] não consegui iniciar a tarefa', e));
}
