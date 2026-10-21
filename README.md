# Postiva Design — código base

> Seu post, com design, todo dia.

O nome da marca fica em `lib/brand-config.ts` (ou nas variáveis `NEXT_PUBLIC_BRAND_*`): troque ali para mudar em todo o site.

Site da Postiva Design: login por empresa, planos com cota, geração de conteúdo com a API do Claude,
aprovação pelo cliente, agendamento no Metricool, artes geradas pelo próprio site e cobrança recorrente no Asaas.

## Planos

| Plano | Preço | Stories | Posts | Reels |
| --- | --- | --- | --- | --- |
| Basic | R$ 400 | 3/dia | — | 1/semana |
| Intermediário | R$ 600 | 5/dia | 1/dia | 1/semana |
| Avançado | R$ 800 | 6/dia | 2/dia | 2/semana |
| Pleno | R$ 1.000 | 6/dia | 2/dia | 2/semana + análise humanizada |

Extras vendidos à parte (`ADDONS` em `lib/plans.ts`): respostas automáticas no direct e arte avulsa.

## Para o cliente

- **Painel** (`/painel`): cota do mês, posts para aprovar, calendário, avisos e cliques no WhatsApp.
- **Aprovar ou pedir ajuste**: o ajuste é refeito pelo Claude e volta para aprovação.
- **Criar promoção** (`/promocoes`), de dois jeitos:
  1. **Puxar do site**: link de um produto ou categoria do site da empresa.
  2. **Planilha com EAN**: EAN, nome, preço de, preço por e validade (modelo em `public/modelo-promocao.csv`). Foto, nome e NCM vêm do Cosmos (Bluesoft).
- **Pedido rápido** (`/pedido`): "preciso de um post sobre X amanhã". Desconta da cota e passa pela sua revisão.
- **Minha marca** (`/minha-marca`): cadastro completo, pasta do Google Drive vinculada e envio de fotos.
- **Aprovar todos** de uma vez, ou ligar a **aprovação automática** depois de 24, 48 ou 72h sem resposta (opcional, desligada por padrão).
- **Relatório do mês** (`/relatorio`): posts publicados, cliques no WhatsApp e o que mais trouxe contato. Salva em PDF pelo navegador.
- **Minha conta** (`/conta`): trocar a senha provisória.
- **App no celular**: o painel pode ser instalado na tela inicial (sem loja de aplicativos).
- **Medir vendas**: cada post tem um link curto (`/r/código`) que conta o clique e abre o WhatsApp da empresa com mensagem pronta. É um link comum do WhatsApp, sem custo. No Instagram, link na legenda do feed não é clicável: use no adesivo de link dos stories e na bio (link fixo da empresa no painel).

## Para você (gestor)

- **Todas as empresas** (`/gestor`): receita, custo de IA, horas de revisão, margem por cliente, cliques e alertas.
- **Fila única de revisão** (`/gestor/revisao`): rascunhos de todas as empresas numa tela. Edite, libere ou descarte. O tempo de revisão é contado para a margem.
- **Nova empresa** (`/gestor/nova`): cria login, perfil do Claude já com o **modelo do segmento**, direção de arte, assinatura no Asaas com 7 dias de teste e **nota fiscal automática**.
- **Configurar empresa** (`/gestor/[id]`): perfil do Claude, direção de arte, desenhar o modelo visual, abrir a Minha marca do cliente, relatório, assinatura nas artes e geração manual da semana.
- **Diagnóstico** (`/gestor/diagnostico`): o que está configurado e o que falta, com a correção de cada item.

## Artes geradas pelo próprio site (sem desenhar modelo à mão)

1. Em **Minha marca**, o cliente envia o logo, escolhe as cores, cola o link de um Instagram que admira e envia 3 a 5 **prints de posts que gosta**.
2. Ele clica em **Desenhar meu modelo**. O Claude olha o logo e os exemplos e desenha um **modelo exclusivo** da empresa (`lib/art/design.ts`): cores, fontes, posição do logo, formato das fotos, formas de destaque, moldura, caixa de texto e os 5 layouts que combinam com os exemplos.
3. O cliente vê a **prévia** (4 layouts + 2 de datas) e aprova, ou escreve o que quer mudar e pede outra versão (até 5 por dia).
4. Daí em diante toda arte é gerada pelo site (`lib/art/layouts.tsx`, 20 layouts), com as fotos da empresa em rodízio. Sem Canva e sem custo por imagem. O Claude não abre o link do Instagram (o Instagram exige login); por isso os prints são o que guia o desenho.

Para não parecer IA nem uma empresa igual à outra:
- O Claude recebe os modelos das outras empresas do mesmo segmento e cidade e precisa desenhar um claramente diferente.
- Rodízio de layouts e de fotos: o mesmo não se repete nos últimos posts.
- **Datas comemorativas e feriados**: na mesma data, cada empresa recebe um layout de data diferente das outras, com a assinatura **"Arte: Postiva Design"**.
- Texto sem clichês, aberturas variadas, poucos emojis, tamanhos diferentes.
- Prévia local de todos os layouts: `npx tsx scripts/preview-arts.tsx pasta-de-saida`.

O Canva continua opcional, para quem quiser editar uma arte à mão.

## O que ainda é manual

- Revisar a fila de rascunhos (alguns minutos por cliente por semana).
- Gravar o vídeo dos reels (o cliente ou você); a arte gerada vira a capa.
- A análise humanizada do plano Pleno.

- Conferir na conta Asaas os campos do Pix Automático antes de ir para produção (o envio de posts ao Metricool já segue a documentação oficial).

## Instalação (resumo; o passo a passo completo está no documento "Passo a passo para colocar no ar")

1. **Supabase**: crie o projeto (região São Paulo) e rode `supabase/instalar.sql` inteiro no SQL Editor. Em Authentication > URL Configuration, coloque o endereço do site e adicione `https://SEU-SITE/auth/callback` nas Redirect URLs.
2. **GitHub + Vercel (plano Pro)**: suba esta pasta num repositório privado, importe na Vercel e cole as variáveis do `.env.example`.
3. **Gestor**: no Supabase, Authentication > Add user (marque "auto confirm"). Depois, no SQL Editor:
   ```sql
   insert into profiles (id, role, full_name)
   select id, 'gestor', 'Seu nome' from auth.users where email = 'seu@email.com';
   ```
   (Ou, com Node instalado: `npx tsx scripts/criar-gestor.ts seu@email.com "Seu nome"`.)
4. Entre no site e abra **/gestor/diagnostico**: ele mostra o que falta configurar e como corrigir cada item.
5. **Asaas**: webhook `https://SEU-SITE/api/webhooks/asaas` com o `ASAAS_WEBHOOK_TOKEN`.

Testes para quem for mexer no código:
- `npx tsx scripts/preview-arts.tsx previews` gera exemplos de todos os layouts.
- `scripts/teste-ponta-a-ponta.ts` roda o fluxo inteiro contra um banco de TESTE (31 verificações).

## Rotinas automáticas

O `vercel.json` vem no modo TESTE (plano grátis da Vercel: rotinas 1 vez por dia). Ao passar para o Pro, troque o conteúdo do `vercel.json` pelo do `vercel.pro.json` (rotinas de hora em hora).

| Quando | O que faz |
| --- | --- |
| Domingo, 9h | Envia a semana seguinte de todas as empresas ao Claude em lote (50% mais barato) |
| De hora em hora (no grátis: todo dia 12h) | Grava as semanas prontas e avisa você para revisar |
| A cada 3 horas (no grátis: todo dia 8h) | Aprovação automática (só quem ligou), alertas de atraso, cota e falha de agendamento |

Empresa sem modelo visual aprovado não entra na geração: você recebe o aviso.

## Segurança

- As chaves das APIs ficam só no servidor.
- Cada empresa só enxerga os próprios dados (RLS no banco).
- "Puxar do site" só aceita links do site cadastrado da empresa.
- Medicamento (NCM 3003/3004) só entra em promoção com confirmação de venda livre, e o servidor reconfere o NCM.
- Coloque um limite de gasto mensal no console da Anthropic.
- Antes de vender, revise contrato, termos de uso e política de privacidade (LGPD) com um advogado. Inclua no contrato a assinatura "Arte: Postiva Design" nas artes de datas.
