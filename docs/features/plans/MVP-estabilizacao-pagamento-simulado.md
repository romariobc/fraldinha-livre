# MVP — estabilizacao com pagamento simulado

Data: 2026-09-26

Objetivo: estabilizar o fluxo minimo real do Fraldinha Livre antes de novas features. O MVP desta trilha e uma compra direta ponta a ponta, com pagamento simulado, navegavel em mobile e desktop, usando a arquitetura atual: Next.js no frontend, Firebase Auth, Worker Hono, D1, contratos compartilhados e deploy Cloudflare.

Este backlog nao substitui as features historicas. Ele reorganiza o trabalho em uma fila operacional para provar o produto funcionando.

## Definicao de pronto do MVP

O MVP estabilizado so pode ser considerado pronto quando os fluxos abaixo forem homologados em producao, com conta real ou conta de teste documentada:

1. Comprador cria conta ou entra com Google pelo celular.
2. Comprador navega pelo catalogo, abre produto, adiciona a sacola e vai ao checkout.
3. Checkout coleta endereco, revisa itens e conclui pagamento simulado.
4. Backend cria pedidos reais no D1, separados por fornecedor quando houver mais de um fornecedor.
5. Comprador ve o pedido em Minha Conta sem a pagina quebrar se a lista de pedidos falhar.
6. Fornecedor ve o pedido recebido no painel e consegue atualizar o andamento minimo.
7. Comprador ve a mudanca de status.
8. Rotas principais tem recuperacao de erro, navegacao basica e estado vazio claro.

Pagamento real, notificacoes reais, leilao reverso, assistente PWA e admin avancado ficam fora desta estabilizacao.

## Ordem de execucao

### MVP-00 — Preparar trilha de QA e contas

Status: done

Meta: deixar claro quais contas, URLs e comandos provam o MVP.

Escopo:

- Documentar contas de teste de comprador e fornecedor sem registrar senhas no repositorio.
- Definir URLs de producao e local usadas na homologacao.
- Criar checklist unico de QA manual mobile e desktop.
- Registrar que HTTP 200 nao comprova fluxo autenticado.

Criterio de aceite:

- Existe checklist com passos, resultado esperado e campo de evidencia.
- O agente consegue saber quais fluxos rodar sem perguntar o proximo passo.

Notas de conclusao:
- Contas oficiais configuradas no Firebase: `comprador.teste@fraldinhalivre.com.br` (limpa), `comprador.teste1@fraldinhalivre.com.br` (com pedido histórico), `fornecedor.teste1/2@fraldinhalivre.com.br` e `romariobc@gmail.com` (admin).
- URLs de producao: frontend `https://fraldinha-livre-frontend.romariobc.workers.dev`, backend `https://fraldinha-livre-backend.romariobc.workers.dev`.

### MVP-01 — Recuperar Minha Conta contra falha de pedidos

Status: done

Meta: a area do comprador nao pode virar uma pagina de erro generico quando `/orders` falha.

Escopo:

- Manter layout, cabecalho, tabs e Perfil acessiveis mesmo se a lista de pedidos falhar.
- Mostrar erro localizado somente na aba/area de pedidos.
- Preservar `requestId` e codigo do erro quando vierem do backend.
- Evitar mensagem generica quando o erro for 401, 403, 409, 500 ou rede.
- Adicionar acao de tentar novamente.

Criterio de aceite:

- `/minha-conta` autenticada renderiza Perfil e navegacao mesmo com falha em pedidos.
- Erro de pedidos mostra mensagem util e codigo de suporte quando existir.
- A pagina nao cai no error boundary global para falhas trataveis da API de pedidos.

Notas de conclusao:
- Concluído e publicado em produção no commit `49e752a`. 5 testes de componente aprovados em vitest.

### MVP-02 — Estabilizar claims e sessao comprador

Status: done

Meta: eliminar a corrida em que o frontend libera a UI por Firestore, mas a API ainda responde 403 por falta de custom claim.

Escopo:

- Revisar fluxo de `AuthProvider`, `RoleProtectedRoute`, `/auth/claim` e chamadas iniciais de dados.
- Garantir que chamadas autenticadas de comprador esperem o token atualizado quando a claim acabou de ser criada.
- Tratar falha de claim com mensagem recuperavel e retry.
- Nao mascarar conflito de papel ou falha real de autorizacao.

Criterio de aceite:

- Primeiro login de comprador novo consegue chegar a Minha Conta sem erro inesperado.
- Recarregar `/minha-conta` apos login mantem acesso.
- Se `/auth/claim` falhar, o usuario ve uma instrucao clara para tentar novamente.

Notas de conclusao:
- Custom claims sincronizadas via Identity Toolkit API (`accounts:update`).
- Resolução de conflito D-051 entre `ADMIN_UID` e `comprador` para a conta admin.
- Chamada real `GET /orders` em produção retornando HTTP 200 OK para as contas de teste de comprador.

Arquivos provaveis:

- `front/src/contexts/auth-context.tsx`
- `front/src/components/auth/RoleProtectedRoute.tsx`
- `front/src/contexts/orders-context.tsx`
- `back/src/routes/auth.ts`
- `back/src/routes/orders.ts`

Validacao minima:

- Testes simulando usuario com `data.role` comprador e token sem claim.
- Testes simulando falha em `/auth/claim`.
- Homologacao manual com conta nova, quando disponivel.

### MVP-03 — Pagamento simulado como contrato explicito

Status: todo

Meta: transformar o pagamento stub em simulador claro, rastreavel e testavel.

Escopo:

- Criar ou consolidar contrato de `PaymentIntent`/`PaymentResult` para pagamento simulado.
- Garantir que checkout so crie pedido depois de pagamento simulado aprovado.
- Permitir cenario de pagamento recusado em ambiente de teste/local.
- Registrar no pedido que o pagamento foi simulado, sem fingir gateway real.
- Evitar coleta de dados reais de cartao.

Criterio de aceite:

- Checkout mostra etapa de pagamento simulado com estados: pendente, aprovado e recusado.
- Pedido criado no D1 contem referencia/status de pagamento simulado.
- Falha simulada nao cria pedido.

Arquivos provaveis:

- `packages/contracts/src/`
- `front/src/app/(comprador)/checkout/`
- `front/src/lib/checkout/` ou adapter existente de pagamento
- `back/src/routes/orders.ts`
- migrations D1 se o schema atual nao tiver campo suficiente

Validacao minima:

- Contract tests do pagamento simulado.
- Teste do checkout: aprovado cria pedido; recusado nao cria.
- Teste backend garantindo que pedido grava metadado de pagamento simulado.

### MVP-04 — Pedido fornecedor ponta a ponta

Status: todo

Meta: fornecedor precisa receber e operar o pedido minimo da loja.

Escopo:

- Validar painel do fornecedor com pedidos reais do D1.
- Garantir que fornecedor ve somente pedidos de seus produtos.
- Implementar ou corrigir atualizacao minima de status: `aguardando`, `confirmado`, `a-caminho`, `entregue`, `cancelado` conforme contrato existente.
- Refletir mudanca na Minha Conta do comprador.

Criterio de aceite:

- Pedido criado por comprador aparece para o fornecedor correto.
- Fornecedor altera status permitido.
- Comprador ve o novo status apos refresh.
- Fornecedor nao ve pedidos de outro fornecedor.

Arquivos provaveis:

- `front/src/app/(fornecedor)/painel-fornecedor/`
- `front/src/components/fornecedor/`
- `back/src/routes/orders.ts`
- `packages/contracts/src/`

Validacao minima:

- Teste backend de autorizacao por fornecedor.
- Teste frontend do painel com pedido real/mock HTTP.
- QA manual comprador -> fornecedor -> comprador.

### MVP-05 — Navegacao e estados vazios das rotas principais

Status: todo

Meta: o usuario nunca deve cair em uma tela sem saida.

Escopo:

- Revisar `/`, `/catalogo`, `/produto/[slug]`, `/sacola`, `/checkout`, `/minha-conta`, `/fornecedor`, `/login`, `/cadastro`.
- Garantir links para Inicio, Catalogo, Sacola/Checkout quando fizer sentido.
- Padronizar estados vazios: sem pedidos, sacola vazia, sem produtos, erro de carregamento.
- Conferir mobile real ou viewport 360/390.

Criterio de aceite:

- Toda rota principal tem navegacao para continuar a jornada.
- Estados vazios tem CTA funcional.
- Nenhuma rota critica fica em tela crua sem acao.

Arquivos provaveis:

- layouts em `front/src/app/`
- componentes de conta, sacola, checkout e catalogo
- `front/src/components/Header.tsx` ou equivalente

Validacao minima:

- QA visual local mobile e desktop.
- Testes de render basicos para estados vazios alterados.

### MVP-06 — Homologacao local end-to-end

Status: todo

Meta: provar o MVP antes de publicar.

Escopo:

- Rodar tipos, lint dirigido e testes relevantes.
- Subir frontend local e validar fluxos em 360px, 390px e desktop.
- Validar com backend local ou producao de teste, conforme harness disponivel.
- Registrar falhas com rota, acao, status HTTP, requestId e screenshot quando houver.

Criterio de aceite:

- Checklist local preenchido.
- Nenhum erro bloqueante no fluxo comprador compra fornecedor acompanha.
- Limites do ambiente documentados.

Validacao minima:

- `npm exec --workspace front -- tsc --noEmit -p tsconfig.json`
- testes dirigidos das areas alteradas
- lint dirigido dos arquivos alterados
- QA browser local

### MVP-07 — Deploy e smoke autenticado

Status: todo

Meta: publicar somente depois do fluxo local passar.

Escopo:

- Commit com apenas arquivos da estabilizacao.
- Push para `main` ou PR, conforme decisao da sessao.
- Acompanhar GitHub Actions ate sucesso.
- Rodar smoke HTTP e smoke autenticado manual.

Criterio de aceite:

- Deploy Cloudflare concluido.
- `/health` responde 200.
- Rotas publicas respondem.
- Fluxo autenticado comprador compra com pagamento simulado e fornecedor acompanha em producao.

Validacao minima:

- Link do workflow registrado.
- Version IDs do backend/frontend registrados.
- Evidencia manual do fluxo real registrada em `context/estado/progresso.md`.

## Harness para o agente de codigo

Use este prompt para orientar o agente que vai implementar:

```text
Voce esta no repositorio Fraldinha Livre. Siga AGENTS.md, comece por .agents/skills/session-start/SKILL.md e preserve alteracoes preexistentes.

Objetivo: estabilizar o MVP de compra direta com pagamento simulado, seguindo docs/features/plans/MVP-estabilizacao-pagamento-simulado.md.

Ordem obrigatoria:
1. Execute MVP-01 e MVP-02 primeiro, porque a Minha Conta quebrada bloqueia qualquer homologacao.
2. Depois execute MVP-03 para pagamento simulado explicito.
3. Em seguida execute MVP-04 e MVP-05 para fechar fornecedor e navegacao.
4. Por fim rode MVP-06. So prepare MVP-07 quando local estiver aprovado.

Regras:
- Nao implemente pagamento real.
- Nao mexa em leilao reverso, assistente PWA ou notificacoes reais.
- Nao marque feature historica como done por teste parcial.
- Nao use git add .; stage somente arquivos da tarefa.
- Se tocar contracts, backend+frontend, leia api-contract e risk-zone-protocol.
- Se tocar comprador, leia domain-comprador.
- Se tocar fornecedor, leia domain-fornecedor.
- Se tocar UI compartilhada, leia ui-system.
- Ao final, atualize context/estado/progresso.md com evidencia real e limites.

Definicao de sucesso:
- Comprador mobile consegue login/cadastro Google, catalogo, sacola, checkout e pagamento simulado.
- Pedido real aparece em Minha Conta.
- Minha Conta nao quebra se pedidos falharem.
- Fornecedor ve o pedido e atualiza status.
- Comprador ve status atualizado.
- Tudo validado localmente antes de deploy.
```

## Cortes conscientes

Fora desta trilha:

- Gateway real de pagamento.
- PIX/boleto real.
- Leilao reverso.
- Notificacoes push/email reais.
- Assistente com Workers AI.
- Admin operacional alem do necessario para diagnostico.
- Refatoracao para outro marketplace open source.

Esses itens voltam depois que o fluxo simples estiver confiavel.
