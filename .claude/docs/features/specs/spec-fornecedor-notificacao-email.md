# Spec — Notificação por e-mail ao fornecedor quando chega um pedido direto

**Domínio:** fornecedor | **Feature relacionada:** 010 (fatia "notificações de pedidos diretos podem ser antecipadas para a fase 1") | **Status:** rascunho

## Contexto

A feature 010 do backlog (`feature_list.json`) previa dois eventos de notificação —
"fornecedor recebe quando chega pedido" e "comprador recebe quando oferta é aceita".
O segundo é do fluxo de leilão reverso (fase 2), fora de escopo enquanto pagamento e
leilão ficam por último (decisão do cliente, 2026-07-30). O próprio backlog já
registrava que a fatia de pedidos diretos (loja) pode ser antecipada para a fase 1
sem depender do leilão — é essa fatia que esta spec cobre.

Hoje, quando um comprador finaliza uma compra direta (`POST /orders`), o fornecedor
só fica sabendo se entrar manualmente no painel (`/fornecedor/painel`, aba "Pedidos
Diretos"). Para os testes de usabilidade real do beta (prioridade atual do cliente),
isso é uma lacuna: um fornecedor real não vai ficar recarregando o painel à espera
de pedidos.

**Restrição descoberta durante o brainstorming:** o projeto não tem domínio próprio
registrado (só `*.workers.dev`), e o provedor de e-mail escolhido (Resend) só envia
para endereços reais depois de um domínio verificado — sem domínio, só é possível
enviar para os endereços de teste fixos do próprio Resend (`delivered@resend.dev`
etc.), nunca para um e-mail real de fornecedor. O cliente pretende comprar um
domínio em breve, mas não tem um hoje. Por isso esta spec entrega a integração
completa **atrás de uma flag desligada por padrão** (ver RN-05) — zero risco, zero
trabalho refeito quando o domínio existir.

## Regras de negócio

- **RN-01 — Evento único.** O único gatilho desta fatia é `POST /orders` criar um
  pedido com sucesso (após o `db.batch()` que grava `orders` + `order_items`
  já existente). Não cobre mudança de status, cancelamento, nem qualquer evento do
  leilão/mercado.
- **RN-02 — Best-effort, nunca bloqueia o pedido.** Falha no envio do e-mail (rede,
  API do Resend fora do ar, e-mail inválido) é logada (`console.error`) e **nunca**
  impede a criação do pedido nem altera o código de resposta (`201`) pro comprador.
  O pedido já está gravado no D1 antes do envio ser tentado — a notificação é
  estritamente posterior e desacoplada do sucesso da escrita.
- **RN-03 — E-mail do fornecedor vem do próprio token, capturado na criação do
  produto.** `POST /products` passa a extrair o claim `email` do ID Token do
  Firebase (junto com o `uid` que já extrai hoje) e gravar em `products.supplier_email`.
  Produtos existentes (seed de 24) recebem backfill via migration.
- **RN-04 — Sem query extra no `POST /orders`.** A query que já busca os produtos
  do pedido pra validar preço/dono/fornecedor (RN-P2/P2b/P2c da feature 006) passa
  a trazer `supplier_email` junto — a notificação usa esse valor já carregado, sem
  round-trip adicional ao D1.
- **RN-05 — Flag `NOTIFICATIONS_ENABLED`, desligada por padrão.** Var em
  `back/wrangler.jsonc` (mesmo padrão do `LEILAO_ATIVO` no front). Com a flag
  `false` (default, enquanto não há domínio verificado): o código loga
  `[email] enviaria para <supplier_email>: <assunto>` e **não** chama a API do
  Resend. Com `true`: chama a API de verdade. Nenhuma mudança de código é
  necessária pra ativar depois — só a var.
- **RN-06 — Conteúdo mínimo, sem dados sensíveis do comprador.** O e-mail traz:
  produto(s) × quantidade, valor total, e um link pro painel
  (`/fornecedor/painel`). Não inclui nome, endereço ou contato do comprador — quem
  quiser esses dados abre o painel (já autenticado, já autorizado por dono).

## Fluxos e estados

```
Comprador finaliza compra (checkout)
  → POST /orders (backend)
      → valida itens/preço/fornecedor (já existe)
      → db.batch() grava orders + order_items (já existe)
      → [NOVO] chama notifySupplierOfNewOrder(supplierEmail, itens, total)
          → NOTIFICATIONS_ENABLED=false → loga e retorna (no-op)
          → NOTIFICATIONS_ENABLED=true  → POST na API do Resend
              → sucesso → segue
              → falha   → console.error, segue mesmo assim
      → retorna 201 pro comprador (independente do resultado do envio)
```

Não há estado persistido novo (não há tabela de "notificações enviadas" nesta
fatia — se precisar de reenvio/histórico no futuro, é uma extensão, não um
requisito de agora).

## Critérios de aceite

- [ ] `products.supplier_email` existe, é preenchida em `POST /products` a partir
      do claim `email` do token, e migration de backfill cobre os 24 produtos
      semeados (nenhum `NULL`/vazio).
- [ ] `POST /orders` com `NOTIFICATIONS_ENABLED=false` (default): pedido é criado
      normalmente; nenhuma chamada de rede ao Resend acontece (testável por
      injeção de função fake, como já feito em `orders.scope-fornecedor.test.ts`).
- [ ] `POST /orders` com `NOTIFICATIONS_ENABLED=true` e envio bem-sucedido: função
      de envio é chamada com o `supplier_email` correto, assunto e corpo contendo
      produto/quantidade/total/link do painel.
- [ ] `POST /orders` com `NOTIFICATIONS_ENABLED=true` e envio falhando (mock
      rejeita): pedido ainda é criado com sucesso (`201`), erro é logado.
- [ ] `RESEND_API_KEY` documentado como secret do Wrangler (`wrangler secret put`),
      nunca commitado.
- [ ] Suite completa (front + back) verde; `tsc`/lint limpos; validação humana no
      navegador (pedido real cria com log de "enviaria e-mail" no `wrangler tail`
      ou observability, já que a flag fica desligada em produção até haver domínio).

## Fora de escopo

- Notificação por push (fica pra uma fatia separada, 010b — exige service worker,
  VAPID, tabela de subscriptions; nada disso existe hoje no front).
- Notificação de "oferta aceita" (leilão/mercado, fase 2, bloqueada por D-014).
- Notificação de mudança de status de pedido pro comprador (fora do escopo
  aprovado nesta rodada de brainstorming — ver decisão explícita do cliente).
- Envio real a e-mails de fornecedor de verdade enquanto não houver domínio
  verificado no Resend (coberto pela flag RN-05 — ativar é so virar a var quando o
  domínio existir).
- Histórico/reenvio de notificações, preferências de opt-out do fornecedor,
  digest/agrupamento de múltiplos pedidos num só e-mail.
- Migrar `NEXT_PUBLIC_FIREBASE_*` pra Build Environment Variables do dashboard
  (pendência separada do D-038, não relacionada a esta feature).

## Referências

- `feature_list.json` — feature 010.
- `back/src/routes/orders.ts` — handler `ordersPostHandler`, ponto de integração.
- `back/src/middleware/auth.ts` — `verifyFirebaseIdToken`, vai ganhar extração do
  claim `email`.
- `back/src/schema/products.ts` — ganha coluna `supplier_email`.
- `front/src/lib/feature-flags.ts` — padrão de referência pro `LEILAO_ATIVO`
  (flag central, mesmo espírito aplicado no back via `NOTIFICATIONS_ENABLED`).
- `back/test/orders.scope-fornecedor.test.ts` — padrão de injeção de função fake
  a seguir nos novos testes.
- `.claude/docs/decisoes.md` D-014 (leilão bloqueado), D-037/D-037b (histórico de
  bugs de produção recentes, mesmo espírito de "best-effort, nunca bloqueia" já
  aplicado ali).
