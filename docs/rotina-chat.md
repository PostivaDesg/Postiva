# Rotina da Postiva no modo chat (sem API paga)

O site (Next.js na Vercel, banco Supabase `ccazsjfhbxsrnonakbub`) está em **modo chat**
(`app_settings.modo_ia = 'chat'`): ele não chama a API do Claude nem a do Metricool.
Duas tarefas agendadas do Claude fazem o trabalho:

1. **Semana nova** (quinta 8h47): monta a semana seguinte (sábado a sexta) de cada empresa ativa e
   entrega direto para o cliente aprovar (`status = 'aguardando'`).
2. **Conferência** (todo dia 9h43 e 15h43): refaz o que o cliente pediu (`status = 'ajuste'`),
   cria os pedidos rápidos (`status = 'pedido'`) e agenda no Metricool o que foi aprovado (`status = 'aprovado'`).

Os textos completos de cada tarefa estão nos prompts das tarefas agendadas; este arquivo é a referência.

## Status dos posts
rascunho → (gestor libera) → aguardando → aprovado → agendado
aguardando → ajuste (cliente pediu refação, motivo em `change_note`) → aguardando
pedido (pedido rápido do cliente, assunto em `quick_request`) → aguardando
expirado = descartado da rodada antiga

## Entregar arte no site
`insert into art_imports (post_id, url, kind)` com `kind` 'arte' (PNG) ou 'video' (MP4). Um gatilho chama a
função `importar-arte`, que baixa, guarda no Storage e grava `art_png_path`/`art_version` (ou `video_path`).

## Link público de arquivo do Storage (para o Metricool)
`insert into media_links (bucket, path)` e `select net.http_post(url:='https://ccazsjfhbxsrnonakbub.supabase.co/functions/v1/links-midia', body:='{}'::jsonb)`;
depois ler `media_links.url` (vale 10 dias; o Metricool copia o arquivo na hora do agendamento).

## Modelos do Canva por empresa
`companies.canva_brand_template_ids` (jsonb): post_produto, story_produto, story_foto, post_foto, logo_asset.

## Empresa ativa ou desativada
`companies.ativa` (boolean, padrão true) é o botão "Ativar/Desativar empresa" do gestor (página da empresa e lista de Empresas).
As rotinas agendadas só fazem artes, refações, pedidos e agendamentos de empresas com `ativa = true`.
Ao desativar, o gestor escolhe o motivo (`motivo_inativa`: falta_pagamento | teste_expirado | manutencao | outro, mais um
recado opcional em `nota_inativa`) e o cliente vê um aviso grande por cima do painel com esse motivo.
Desativar NÃO apaga nada: as peças futuras (aguardando, aprovado, agendado) viram `pausado`, com o status antigo em
`status_antes_pausa`. A rotina de conferência pausa no Metricool (vira rascunho, `metricool_pausado = true`) e, quando a
empresa é reativada, devolve o status, reativa no Metricool e remarca para o mesmo horário no próximo dia livre o que já
passou da data.

## Teste grátis de 7 dias
O cadastro público (/cadastro) cria a empresa com `subscriptions.status = 'teste'` e `trial_ends_at` = agora + 7 dias, sem
pedir CPF nem forma de pagamento. Quando vence, o cliente vê um aviso com os planos e escolhe um (`plano_escolhido`); se
`app_settings` tiver `mp_link_<plano>` (link de pagamento do Mercado Pago), ele vai direto para o pagamento. Depois do
pagamento, o gestor muda a assinatura para 'ativa'. Teste vencido não recebe artes das rotinas.

## NanoFarma: stories de oferta com preço do site
3 stories por dia (09:00, 13:00 e 18:00) com preço lido no site drogariananofarma.com.br (a rotina de quinta roda no
computador do gestor para abrir o site no navegador), no modelo `story_oferta` (EAHZJ6OsOYQ), sem pessoa, validade de
1 semana (sábado a sexta da semana-alvo). Posts e reels nunca têm preço e sempre têm pessoa + embalagem.

## Drogaria do Povão: 2 stories por semana com preço do site
Terça e sexta às 13:00, com preço lido em companies.site_url (catálogo nappsolutions), produtos de giro alto
(fralda, dipirona, soro fisiológico…), sem repetir o mesmo produto na mesma semana. Posts e reels sem preço.
