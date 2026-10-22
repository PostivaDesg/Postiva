// Chamada às rotas do site pelo navegador, sem travar a tela quando a resposta não é JSON
// (ex.: tempo esgotado na Vercel devolve uma página de erro em HTML).
export async function postJSON<T = any>(url: string, body?: unknown): Promise<{ ok: boolean; data: T; error: string | null }> {
  try {
    const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body ?? {}) });
    const text = await r.text();
    let data: any = {};
    try { data = text ? JSON.parse(text) : {}; } catch { /* resposta não-JSON */ }
    if (r.ok) return { ok: true, data, error: null };
    const msg = data?.error
      ?? (r.status === 504 || r.status === 408 ? 'Demorou mais que o limite do servidor. O que já ficou pronto foi salvo: recarregue a página e, se faltar algo, tente de novo.'
        : r.status === 401 ? 'Sua sessão expirou. Entre de novo.'
          : `Não foi possível concluir (erro ${r.status}). Tente de novo em instantes.`);
    return { ok: false, data, error: msg };
  } catch {
    return { ok: false, data: {} as T, error: 'Sem conexão com o servidor. Confira a internet e tente de novo.' };
  }
}

/** Lê a resposta como JSON; se vier HTML de erro (tempo esgotado etc.), devolve { error } com uma mensagem clara. */
export async function readJSON(r: Response): Promise<any> {
  const text = await r.text().catch(() => '');
  try { return text ? JSON.parse(text) : {}; } catch {
    return { error: r.status === 504 || r.status === 408
      ? 'Demorou mais que o limite do servidor. O que já ficou pronto foi salvo: recarregue a página e, se faltar algo, tente de novo.'
      : `Não foi possível concluir (erro ${r.status}). Tente de novo em instantes.` };
  }
}
