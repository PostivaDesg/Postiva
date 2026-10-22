// Posts esperando aprovação. Reels: a Postiva monta o vídeo; enviar um vídeo próprio é opcional.
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { currentProfile, supabaseAdmin } from '@/lib/supabase';
import { artUrl } from '@/lib/art/url';
import { KIND, quando } from '@/lib/ui';
import PostCard from '../PostCard';
import ApproveAll from '../ApproveAll';
import VideoUpload from '../VideoUpload';

export const dynamic = 'force-dynamic';

export default async function Aprovar() {
  const me = await currentProfile();
  if (!me) redirect('/login');
  if (me.role === 'gestor') redirect('/gestor/revisao');
  const db = supabaseAdmin();
  const [{ data: pending }, { data: reels }] = await Promise.all([
    db.from('posts').select('*').eq('company_id', me.company_id!).eq('status', 'aguardando').order('scheduled_at'),
    db.from('posts').select('id, title, status, video_path, video_auto').eq('company_id', me.company_id!).eq('kind', 'reels').in('status', ['aguardando', 'aprovado']),
  ]);
  const list = pending ?? [];
  // vídeo pronto (automático ou do cliente) aparece no cartão para assistir antes de aprovar
  const videos = new Map<string, string>();
  await Promise.all(list.filter((p) => p.kind === 'reels' && p.video_path).map(async (p) => {
    const { data } = await db.storage.from('videos').createSignedUrl(p.video_path, 3600);
    if (data?.signedUrl) videos.set(p.id, data.signedUrl);
  }));
  const ownVideo = (reels ?? []).filter((r) => !r.video_path || r.video_auto);
  return (
    <div className="pilha">
      <header className="cabecalho">
        <div>
          <h1>Aprovar posts</h1>
          <p>{list.length ? `${list.length} ${list.length === 1 ? 'post espera' : 'posts esperam'} você. Ao aprovar, o post é agendado no horário marcado.` : 'Nenhum post esperando aprovação.'}</p>
        </div>
        {list.length > 1 && <div className="acoes"><ApproveAll count={list.length} /></div>}
      </header>

      {!!ownVideo.length && (
        <details className="painel" aria-label="Usar um vídeo seu no reels">
          <summary style={{ cursor: 'pointer', fontWeight: 700 }}>Quer um reels com um vídeo seu? (opcional)</summary>
          <p className="muted" style={{ margin: '10px 0 14px' }}>A Postiva já monta os reels com fotos, frases e o seu logo. Se preferir usar um vídeo gravado por você, envie aqui e ele substitui o automático.</p>
          <div className="grid">{ownVideo.map((r) => <VideoUpload key={r.id} postId={r.id} title={r.title} />)}</div>
        </details>
      )}

      {list.length ? list.map((p) => (
        <PostCard key={p.id} id={p.id} kind={KIND[p.kind] ?? p.kind} when={quando(p.scheduled_at)}
          title={p.title} caption={p.caption} reason={p.reason} artUrl={p.art_url ?? artUrl(p.id, p.art_version, false)}
          videoUrl={videos.get(p.id) ?? null} isReel={p.kind === 'reels'} />
      )) : (
        <div className="vazio">
          <h3>Tudo aprovado</h3>
          <p>Quando a próxima leva de posts estiver pronta, ela aparece aqui e você recebe um aviso. Precisa de um post fora do calendário?</p>
          <Link className="btn ghost pequeno" href="/pedido">Pedir um post</Link>
        </div>
      )}
    </div>
  );
}
