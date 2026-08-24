# Spec — App Mobile: Chat-Agent de Compra (PWA) — Fatia 1

**Dominio:** frontend (comprador) / mobile · **Feature relacionada:** 018 · **Status:** APROVADA (2026-08-02)

## Contexto

O `app/` na raiz do repo existe desde a fundacao do projeto como placeholder ("aplicativo mobile —
futuro"), sem nenhuma decisao de stack tomada. Esta spec resolve essa decisao para a primeira fatia.

O pedido do cliente nao e "portar a loja pra mobile" — e um **canal conversacional**: o comprador manda
foto do produto (ou descreve o que quer) e um agente conduz a conversa ate identificar o produto certo
no catalogo real, entregando o comprador no fluxo de compra que ja existe. Nao e um app separado com
logica de negocio propria; e uma nova porta de entrada para o marketplace que ja esta em producao
(features 006, 013-017).

Brainstorming (2026-07-23/24) decidiu, nesta ordem:

1. **Publico:** comprador (nao fornecedor).
2. **Escopo do checkout:** o agente resolve so "o que comprar" (busca por texto/foto, escolha de
   produto/quantidade). Endereco, revisao, pagamento e confirmacao continuam 100% no checkout que ja
   existe (S5a/S5b, D-023) — o chat nao reimplementa nada disso.
3. **Tecnologia do cliente:** PWA — uma rota nova dentro do `front/` ja existente, nao um app nativo
   separado. Decisao explicita de **nao** usar React Native/Expo nesta fatia (avaliado e descartado por
   ora — ver "Alternativas descartadas").
4. **Motor do chat:** LLM real com tool-use (nao um fluxo scriptado com botoes fixos).
5. **Modelo:** Workers AI nativo (`@cf/meta/llama-4-scout-17b-16e-instruct`), nao a API da Anthropic
   direto. Pesquisado na documentacao da Cloudflare (2026-07-24): o modelo suporta function calling e
   vision nativamente, e chamado via binding `env.AI.run()` do proprio Worker (sem conta/chave de
   terceiro), e cabe na cota gratis diaria (10.000 neurons/dia) do plano ja em uso.
6. **Gate de login:** obrigatorio para entrar na tela do assistente (nao e como o catalogo, que deixa
   navegar deslogado). Simplifica: nao precisa preservar historico de conversa durante um redirect de
   login no meio do fluxo.

## Arquitetura

```
front/ (PWA)                              back/ (Worker Cloudflare, Hono)
  /assistente (rota protegida)              POST /chat/message
    ChatUI (historico local, envia          ├─ middleware auth (Firebase ID Token, ja existe)
     texto/foto + historico completo         ├─ chama env.AI.run(llama-4-scout, tools=[...])
     a cada turno — stateless)                │    ├─ tool search_products → Drizzle → D1 (products)
    intercepta acao estruturada               │    └─ tool get_product → idem
     select_product_for_purchase              └─ quando o modelo chama select_product_for_purchase,
     ──► cart-context.addItem()                    responde com { action: 'select_product', productId, quantity }
     ──► router.push('/checkout')                  em vez de (ou alem de) texto
              │
              ▼
     checkout existente (S5a/S5b) — inalterado
```

- **Nao e um novo dominio de dados.** `search_products`/`get_product` leem a MESMA tabela `products` no
  D1 que a fatia P1-P3 ja criou e populou (24 produtos reais, `GET /products` publico ja existe em
  `back/src/routes/products.ts`). Nao ha catalogo paralelo pro chat.
- **Sem tabela nova no D1 nesta fatia.** A conversa e stateless no servidor: o cliente reenvia o
  historico completo a cada mensagem. Se precisar de continuidade entre dispositivos no futuro, isso se
  adiciona depois sem quebrar o contrato de `/chat/message`.
- **Interface de tool-calling agnostica de provedor.** A chamada ao modelo fica isolada atras de uma
  funcao (`runChatCompletion(messages, tools)`) que hoje implementa com `env.AI`. Se a qualidade do
  modelo aberto nao bastar no QA manual, troca-se essa implementacao por Claude via AI Gateway sem mudar
  o contrato da rota nem o front.

## Fluxo

1. Comprador logado abre `/assistente` (redirect pro `/login?redirect=/assistente` se deslogado, mesmo
   padrao ja usado no catalogo/checkout).
2. Manda texto ("preciso de fralda tamanho M") e/ou foto da embalagem.
3. Front chama `POST /chat/message` com `{ messages: [...historico], image?: base64 }` e o Bearer token.
4. Worker roda o modelo com as tools; se a foto/texto for ambigua, o modelo responde pedindo mais
   informacao (marca, tamanho) — isso e so mais uma mensagem de chat, sem estado especial no servidor.
5. Quando o modelo tem certeza, chama `select_product_for_purchase(productId, quantity)`. O Worker
   devolve essa acao estruturada pro front.
6. Front intercepta a acao: `addItem` no cart-context (mesma funcao que "Comprar agora"/"Adicionar a
   sacola" ja usam) + `router.push('/checkout')`.
7. Dali em diante e o checkout de sempre — sem participacao do chat.

## Tratamento de erro e casos-limite

- **Foto ambigua ou produto nao reconhecido:** tratado como conversa (o modelo pergunta de novo), nao
  como erro tecnico.
- **`search_products` sem resultado:** tool retorna lista vazia; o modelo informa e sugere buscar por
  categoria — sem excecao no backend.
- **Modelo/Workers AI indisponivel (timeout, erro, cota estourada):** rota retorna erro tipado
  (`AgentUnavailableError`, mesmo padrao dos erros tipados ja usados em `HttpOrderRepository`); front
  mostra mensagem de sistema no chat com botao de retry. O historico local no cliente nao se perde
  (stateless no servidor).
- **Produto/estoque mudou entre a busca no chat e a selecao:** nao duplica validacao — o `POST /orders`
  ja revalida preco/existencia/fornecedor (RN-P2 da fatia Produtos); se falhar, o erro aparece no
  checkout normalmente, como ja acontece hoje pra qualquer entrada (catalogo web ou chat).
- **Custo por mensagem:** logar tokens/neurons consumidos por conversa (log do Worker) desde o primeiro
  deploy, para nao descobrir o custo real so em producao.

## Testes

- **Testavel (mesmo padrao de `back/test` e `front` hoje):**
  - Tools (`search_products`, `get_product`) contra D1/miniflare — deterministico, mesmo estilo dos
    testes de `products.ts`/`orders.ts` existentes.
  - Contrato Zod de request/response de `POST /chat/message` (`packages/contracts`).
  - Roteamento da acao estruturada no front: dado um payload fixo `{ action: 'select_product', ... }`,
    o cart-context recebe o item certo e navega pro checkout — logica determinista, testavel sem LLM de
    verdade (mocka a resposta do Worker).
- **Nao testavel por unit test:** se o modelo "entende" a foto ou a frase certa. Exige **checklist
  manual de QA** (10-15 casos: pedido direto por nome, foto de embalagem legivel, foto ambigua, produto
  fora de estoque, categoria errada) rodado a cada mudanca de prompt/tools/modelo — nao confiar so no
  CI pra isso.

## Criterios de aceite

- [ ] `/assistente` exige login (redirect `/login?redirect=/assistente` se deslogado).
- [ ] `POST /chat/message` (Worker) aceita texto e/ou foto + historico, roda `env.AI.run()` com as tools
      `search_products`/`get_product` contra a tabela `products` real do D1.
- [ ] Requisicao sem ID Token valido → 401 (mesmo padrao das rotas de `/orders`).
- [ ] Quando o modelo chama `select_product_for_purchase`, o front adiciona o item ao cart-context e
      navega pro `/checkout` — sem tocar no checkout em si.
- [ ] Falha do Workers AI (timeout/indisponivel) mostra mensagem de erro no chat com retry, sem perder o
      historico local da conversa.
- [ ] Contract test verde pra `search_products`/`get_product` (D1 local) e pro roteamento da acao
      estruturada no front (mockando a resposta do Worker).
- [ ] Suite existente do front e do back permanece verde; lint/tsc/build exit 0.
- [ ] **Checklist de QA manual** (10-15 casos descritos acima) executado e documentado antes de
      considerar a fatia pronta — nao e criterio automatizavel.
- [ ] **Validacao humana:** login → abrir `/assistente` → mandar foto de um produto real do catalogo →
      confirmar selecao → cair no checkout com o item certo e a quantidade certa.

## Fora de escopo (registrado, nao e esquecimento)

- **Checkout conversacional.** Endereco/pagamento/confirmacao dentro do chat foi avaliado e descartado
  nesta fatia — o checkout existente (S5a/S5b) e reaproveitado 100%.
- **App nativo (React Native/Expo) ou Capacitor.** Avaliado como caminho futuro (ver "Alternativas
  descartadas"), nao implementado agora. A pasta `app/` na raiz permanece sem uso ate essa decisao.
- **Distribuicao em lojas (App Store/Google Play).** Consequencia direta de ser PWA nesta fatia.
- **Push notification.** Nao faz parte desta fatia; PWA permite adicionar depois (Web Push), sem
  bloquear esta spec.
- **Persistencia de historico de conversa entre sessoes/dispositivos.** Chat e stateless no servidor
  nesta fatia; adicionar tabela de conversas fica para se/quando isso virar necessidade real.
- **Chat pro fornecedor.** Fora de escopo — publico desta fatia e so o comprador.
- **Troca de Workers AI por Claude (AI Gateway).** Caminho de escape documentado na arquitetura, so
  executado se o QA manual mostrar que o modelo aberto nao da conta.

## Alternativas descartadas

| Alternativa | Por que nao agora |
|---|---|
| React Native/Expo nativo (`app/`) | UI teria que ser reconstruida do zero (Tailwind nao roda em RN); handoff pro checkout exigiria WebView + ponte de autenticacao (passar ID Token pra dentro da WebView) — complexidade nova que nao existe em nenhum outro lugar do projeto hoje. Pipeline de build/assinatura (EAS) e contas de loja sao custo adicional sem beneficio claro nesta fase de validacao. |
| Capacitor envolvendo a PWA | Upgrade natural da PWA quando/se presenca em loja virar necessidade real; nao ha ganho em fazer isso antes de validar o conceito do chat-agent. |
| Checkout 100% conversacional | Reimplementar a maquina de estados do checkout (S5a/S5b) como dialogo e trabalho duplicado sem necessidade — o checkout existente ja foi validado com o cliente. |
| Claude via API/AI Gateway como motor do chat desde o inicio | Workers AI nativo cobre function calling + vision, e gratis na cota diaria do projeto, e nao exige gerenciar chave de terceiro — mais barato e mais simples para provar o conceito. Caminho de troca fica documentado, nao descartado permanentemente. |

## Referencias

- Fluxo de compra existente: `front/src/contexts/orders-context.tsx`, `front/src/lib/domain/order.ts`,
  botao "Comprar agora"/"Adicionar a sacola" (D-023, D-024).
- Backend real de Produtos: `back/src/routes/products.ts`, `back/src/schema/products.ts` (fatia P1-P3,
  `.claude/docs/design/plans/P1-products-schema-seed.md`).
- Padrao porta+adapter e auth: `.claude/docs/backend/integration-guide.md`,
  `spec-backend-pedidos-cloudflare.md`.
- Governanca: `.claude/docs/decisoes.md` (D-001, D-005, D-023, D-024, D-026, D-027).
- Documentacao pesquisada nesta spec: Cloudflare Workers AI (function calling + vision, modelo
  `@cf/meta/llama-4-scout-17b-16e-instruct`), pricing Workers AI (10.000 neurons/dia gratis), AI Gateway
  (proxy pra Anthropic/outros provedores como caminho de escape).
