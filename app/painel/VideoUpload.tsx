'use client';
// Envio do vídeo do reels direto para o armazenamento (sem passar pelo servidor do site).
import { readJSON } from '@/lib/client-fetch';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createBrowserClient } from '@supabase/ssr';

export default function VideoUpload({ postId, title }: { postId: string; title: string }) {
  const router = useRouter();
  const [status, setStatus] = useState<string | null>(null);

  async function send(file: File) {
    setStatus('Preparando envio…');
    const call = (body: object) => fetch(`/api/posts/${postId}/video`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then(async (r) => ({ ok: r.ok, j: await readJSON(r) }));
    const link = await call({ action: 'link', type: file.type, size: file.size });
    if (!link.ok) return setStatus(link.j.error);
    setStatus('Enviando o vídeo… não feche esta página.');
    const sb = createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
    const { error } = await sb.storage.from('videos').uploadToSignedUrl(link.j.path, link.j.token, file, { contentType: file.type });
    if (error) return setStatus(`Falha no envio: ${error.message}`);
    const done = await call({ action: 'pronto', path: link.j.path });
    if (!done.ok) return setStatus(done.j.error);
    setStatus(done.j.status === 'agendado' ? 'Vídeo recebido e reels agendado!' : 'Vídeo recebido.');
    router.refresh();
  }

  return (
    <div style={{ display: 'grid', gap: 6 }}>
      <label htmlFor={`v-${postId}`}>Vídeo do reels: {title}</label>
      <input id={`v-${postId}`} type="file" accept="video/mp4,video/quicktime" onChange={(e) => e.target.files?.[0] && send(e.target.files[0])} />
      <span className="muted" style={{ fontSize: 13 }}>MP4 ou MOV, vertical (9:16), até 60 segundos. Ele substitui o vídeo que a Postiva montou; a arte continua como capa.</span>
      {status && <span role="status" style={{ fontSize: 14 }}>{status}</span>}
    </div>
  );
}
