// Google Drive da empresa: o cliente compartilha UMA pasta com o e-mail da conta de serviço
// da Postiva Design (DRIVE_SERVICE_EMAIL). Ninguém precisa entregar senha nem conectar a própria conta.
//
// Configuração (uma vez): no Google Cloud, crie uma conta de serviço, ative a Google Drive API,
// gere uma chave JSON e cole o conteúdo em GOOGLE_SERVICE_ACCOUNT_JSON.
import { JWT } from 'google-auth-library';

const API = 'https://www.googleapis.com/drive/v3';

function client() {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!raw) throw new Error('Drive não configurado (GOOGLE_SERVICE_ACCOUNT_JSON).');
  const key = JSON.parse(raw) as { client_email: string; private_key: string };
  return new JWT({ email: key.client_email, key: key.private_key, scopes: ['https://www.googleapis.com/auth/drive.readonly'] });
}

export const serviceEmail = () => {
  try { return (JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON ?? '{}') as { client_email?: string }).client_email ?? null; }
  catch { return null; }
};

/** Aceita o link da pasta ("https://drive.google.com/drive/folders/ID?usp=…") ou só o ID. */
export function folderIdFromUrl(input: string) {
  const s = input.trim();
  const m = s.match(/\/folders\/([A-Za-z0-9_-]{10,})/) ?? s.match(/[?&]id=([A-Za-z0-9_-]{10,})/);
  if (m) return m[1];
  return /^[A-Za-z0-9_-]{10,}$/.test(s) ? s : null;
}

export interface DriveImage { id: string; name: string; mimeType: string; modifiedTime: string }

/** Lista as imagens da pasta (e de uma subpasta de nível 1, como "Fotos da loja"). */
export async function listImages(folderId: string): Promise<DriveImage[]> {
  const auth = client();
  const list = async (q: string) => {
    const out: any[] = [];
    let pageToken: string | undefined;
    do {
      const url = new URL(`${API}/files`);
      url.searchParams.set('q', q);
      url.searchParams.set('fields', 'nextPageToken, files(id, name, mimeType, modifiedTime)');
      url.searchParams.set('pageSize', '200');
      url.searchParams.set('supportsAllDrives', 'true');
      url.searchParams.set('includeItemsFromAllDrives', 'true');
      if (pageToken) url.searchParams.set('pageToken', pageToken);
      const r = await auth.request<{ files: any[]; nextPageToken?: string }>({ url: url.toString() });
      out.push(...r.data.files);
      pageToken = r.data.nextPageToken;
    } while (pageToken && out.length < 1000);
    return out;
  };
  const safe = folderId.replace(/'/g, '');
  const root = await list(`'${safe}' in parents and trashed = false`);
  const subfolders = root.filter((f) => f.mimeType === 'application/vnd.google-apps.folder').slice(0, 20);
  const nested = (await Promise.all(subfolders.map((f) => list(`'${f.id}' in parents and trashed = false and mimeType contains 'image/'`)))).flat();
  return [...root, ...nested].filter((f) => String(f.mimeType).startsWith('image/'));
}

/** Baixa um arquivo da pasta (para enviar ao Canva como foto do post). */
export async function downloadFile(fileId: string) {
  const r = await client().request<ArrayBuffer>({
    url: `${API}/files/${encodeURIComponent(fileId)}?alt=media&supportsAllDrives=true`, responseType: 'arraybuffer',
  });
  return r.data;
}
