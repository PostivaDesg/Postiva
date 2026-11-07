'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function ApproveAll({ count }: { count: number }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  async function go() {
    if (!confirm(`Aprovar os ${count} posts de uma vez? Eles serão agendados nos horários marcados.`)) return;
    setBusy(true);
    const r = await fetch('/api/posts/approve-all', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' }).catch(() => null);
    const j = r ? await r.json().catch(() => ({})) : {};
    setBusy(false);
    if (!r?.ok) alert(j.error ?? 'Não consegui aprovar agora. Tente de novo em alguns minutos.');
    else if (j.total && j.approved < j.total) alert(`${j.approved} de ${j.total} posts aprovados. Toque de novo para aprovar o restante.`);
    router.refresh();
  }
  return <button className="btn ok" disabled={busy} onClick={go}>{busy ? 'Aprovando…' : `Aprovar todos (${count})`}</button>;
}
