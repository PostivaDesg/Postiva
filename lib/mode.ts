// Modo "chat": as artes, as refações e o agendamento são feitos pelo Claude numa tarefa agendada
// (sem API paga). O site só guarda o pedido do cliente e mostra o que a tarefa deixou pronto.
// Liga/desliga em app_settings: key 'modo_ia' = 'chat' | 'api'. Sem a chave, vale 'chat'.
import { supabaseAdmin } from './supabase';

export async function chatMode(): Promise<boolean> {
  const { data } = await supabaseAdmin().from('app_settings').select('value').eq('key', 'modo_ia').maybeSingle();
  const v = typeof data?.value === 'string' ? data.value : (data?.value as any)?.toString?.();
  return v !== 'api';
}
