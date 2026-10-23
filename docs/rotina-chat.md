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
