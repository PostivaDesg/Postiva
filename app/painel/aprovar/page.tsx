// Posts esperando aprovação + reels esperando o vídeo.
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
    db.from('posts').select('id, title, status').eq('company_id', me.company_id!).eq('kind', 'reels').is('video_path', null).in('status', ['aguardando', 'aprovado']),
  ]);
  const list = pending ?? [];
  return (
    <div className="pilha">
      <header className="cabecalho">
        <div>
          <h1>Aprovar posts</h1>
          <p>{list.length ? `${list.length} ${list.length === 1 ? 'post espera' : 'posts esperam'} você. Ao aprovar, o post é agendado no horário marcado.` : 'Nenhum post esperando aprovação.'}</p>
        </div>
        {list.length > 1 && <div className="acoes"><ApproveAll count={list.length} /></div>}
      </header>

      {!!reels?.length && (
        <section className="painel" aria-label="Reels esperando vídeo">
          <div className="painel-titulo"><div><h2>Reels esperando o vídeo</h2><p>Grave seguindo o roteiro da legenda e envie aqui. Depois de aprovado, ele é agendado sozinho.</p></div></div>
          <div className="grid">{reels.map((r) => <VideoUpload key={r.id} postId={r.id} title={r.title} />)}</div>
        </section>
      )}

      {list.length ? list.map((p) => (
        <PostCard key={p.id} id={p.id} kind={KIND[p.kind] ?? p.kind} when={quando(p.scheduled_at)}
          title={p.title} caption={p.caption} reason={p.reason} artUrl={p.art_url ?? artUrl(p.id, p.art_version, false)} />
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
