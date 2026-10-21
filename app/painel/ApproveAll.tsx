'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function ApproveAll({ count }: { count: number }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  async function go() {
    if (!confirm(`Aprovar os ${count} posts de uma vez? Eles serão agendados nos horários marcados.`)) return;
    setBusy(true);
    await fetch('/api/posts/approve-all', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
    setBusy(false);
    router.refresh();
  }
  return <button className="btn ok" disabled={busy} onClick={go}>{busy ? 'Aprovando…' : `Aprovar todos (${count})`}</button>;
}
