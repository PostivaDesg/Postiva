// Diagnóstico da configuração: mostra, em uma tela, o que já está ligado e o que falta.
// Faz só consultas leves (nenhuma gera custo).
import { supabaseAdmin } from './supabase';
import { JWT } from 'google-auth-library';

export interface Check { area: string; item: string; ok: boolean; required: boolean; fix: string }

const has = (k: string) => !!process.env[k]?.trim();

async function ping(fn: () => Promise<boolean>) {
  try { return await fn(); } catch { return false; }
}

export async function runChecks(): Promise<Check[]> {
  const out: Check[] = [];
  const add = (area: string, item: string, ok: boolean, required: boolean, fix: string) => out.push({ area, item, ok, required, fix });

  // Site
  add('Site', 'Endereço do site (NEXT_PUBLIC_SITE_URL)', /^https:\/\//.test(process.env.NEXT_PUBLIC_SITE_URL ?? ''), true, 'Coloque o endereço com https:// (ex.: https://postivadesign.com.br ou o endereço .vercel.app).');
  add('Site', 'Segredo das artes (ART_SECRET)', (process.env.ART_SECRET ?? '').length >= 24, true, 'Invente um texto com 24+ caracteres e salve em ART_SECRET.');
  add('Site', 'Segredo das rotinas (CRON_SECRET)', (process.env.CRON_SECRET ?? '').length >= 24, true, 'Invente outro texto com 24+ caracteres e salve em CRON_SECRET.');

  // Banco
  const dbOk = await ping(async () => {
    const { error } = await supabaseAdmin().from('generation_batches').select('id').limit(1);
    return !error;
  });
  add('Banco (Supabase)', 'Conexão e tabelas instaladas', dbOk, true, 'Confira as 3 chaves do Supabase e rode supabase/instalar.sql no SQL Editor.');
  const storageOk = await ping(async () => {
    const { data } = await supabaseAdmin().storage.listBuckets();
    return !!data?.some((b) => b.id === 'marcas') && !!data?.some((b) => b.id === 'videos');
  });
  add('Banco (Supabase)', 'Armazenamento de fotos e vídeos', storageOk, true, 'Rode supabase/instalar.sql (ele cria os espaços "marcas" e "videos").');

  // Claude
  const claudeOk = await ping(async () => {
    const r = await fetch('https://api.anthropic.com/v1/models?limit=1', {
      headers: { 'x-api-key': process.env.ANTHROPIC_API_KEY ?? '', 'anthropic-version': '2023-06-01' },
    });
    return r.ok;
  });
  add('Claude', 'Chave da API (ANTHROPIC_API_KEY)', claudeOk, true, 'Crie a chave em console.anthropic.com > API Keys, adicione créditos e defina um limite de gasto.');

  // Cobrança
  const asaasOk = await ping(async () => {
    const r = await fetch(`${process.env.ASAAS_BASE_URL ?? 'https://api-sandbox.asaas.com/v3'}/customers?limit=1`, { headers: { access_token: (process.env.ASAAS_API_KEY ?? process.env.ASSAS_API_KEY ?? '') } });
    return r.ok;
  });
  add('Cobrança (Asaas)', 'Chave da API', asaasOk, true, 'Pegue a chave em Asaas > Integrações. Comece pelo sandbox (ASAAS_BASE_URL do sandbox).');
  add('Cobrança (Asaas)', 'Token do webhook (ASAAS_WEBHOOK_TOKEN)', has('ASAAS_WEBHOOK_TOKEN'), true, 'Invente um token e cadastre o webhook no Asaas com ele.');
  add('Cobrança (Asaas)', 'Ambiente de produção', !(process.env.ASAAS_BASE_URL ?? '').includes('sandbox') && has('ASAAS_BASE_URL'), false, 'Quando tudo funcionar no sandbox, troque para https://api.asaas.com/v3.');
  add('Cobrança (Asaas)', 'Nota fiscal automática', has('ASAAS_MUNICIPAL_SERVICE_ID') && has('ASAAS_INVOICE_TAXES_JSON'), false, 'Peça ao contador o código do serviço e as alíquotas.');

  // Publicação
  add('Publicação (Metricool)', 'Credenciais da API', has('METRICOOL_API_TOKEN') && has('METRICOOL_USER_ID'), true, 'Assine o Metricool Advanced e copie o token e o ID de usuário da área de API.');

  // Fotos e produtos
  const driveOk = await ping(async () => {
    const key = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON ?? '{}');
    if (!key.client_email) return false;
    const t = await new JWT({ email: key.client_email, key: key.private_key, scopes: ['https://www.googleapis.com/auth/drive.readonly'] }).authorize();
    return !!t.access_token;
  });
  add('Fotos (Google Drive)', 'Conta de serviço', driveOk, false, 'Crie a conta de serviço no Google Cloud, ative a Drive API e cole a chave JSON. Sem isso, o cliente envia as fotos pelo painel.');
  add('Promoções (Cosmos)', 'Token do Cosmos (planilha com EAN)', has('COSMOS_TOKEN'), false, 'Cadastre-se em cosmos.bluesoft.com.br e copie o token. Sem isso, só o modo "puxar do site" funciona.');

  // Avisos
  add('Avisos', 'E-mail (Resend)', has('RESEND_API_KEY') && has('GESTOR_EMAIL'), false, 'Crie conta no Resend (grátis), verifique o domínio e preencha RESEND_API_KEY e GESTOR_EMAIL. Sem isso, os avisos ficam só no painel.');

  // Gestor
  const gestorOk = await ping(async () => {
    const { count } = await supabaseAdmin().from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'gestor');
    return (count ?? 0) > 0;
  });
  add('Acesso', 'Usuário gestor criado', gestorOk, true, 'Rode: npx tsx scripts/criar-gestor.ts seu@email.com "Seu nome"');
  return out;
}
