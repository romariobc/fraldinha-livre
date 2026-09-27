# Relatório de Homologação End-to-End Autenticada — MVP-06

**Data de Execução:** 2026-09-27  
**Responsável:** Antigravity AI Pair Programmer  
**Ambiente:** Produção Cloudflare Workers (Backend) + Cloudflare Containers (Frontend) + Cloudflare D1 + Firebase Auth  
**Status do Marco:** `parcialmente_comprovado` (Caminho positivo da API comprovado; validação visual automatizada em browser e automação do cenário negativo em UI pendentes)

---

## 1. Resumo Executivo e Veredito da Auditoria

Este documento registra a homologação do ciclo de compra direta e gerenciamento de pedidos correspondente ao marco **MVP-06** do plano [`MVP-estabilizacao-pagamento-simulado.md`](../features/plans/MVP-estabilizacao-pagamento-simulado.md).

Após auditoria técnica realizada em 2026-09-27, o status foi reclassificado para **`parcialmente_comprovado`** devido aos seguintes fatores:
- **Caminho positivo da API**: Comprovado via chamadas HTTP autenticadas (criação de pedido com pagamento simulado aprovado, persistência no D1, fila do fornecedor e transição de status).
- **Cenário negativo em UI**: A recusa de pagamento é uma trava de cliente implementada em `checkout/page.tsx` (coberta por testes unitários em Vitest), mas não foi exercitada por automação de ponta a ponta em navegador.
- **Validação visual de viewports**: A tabela da Seção 4 reflete a implementação e inspeção de código/componentes, não tendo sido executada por automação de navegador (Playwright/Puppeteer) nesta homologação.
- **Isolamento de ambiente**: As execuções criaram registros no banco D1 de produção sem rotina de limpeza automatizada, evidenciando a necessidade de testes em ambiente de staging ou mock local.

---

## 2. Contas Utilizadas na Homologação Real

| Papel | Email | UID Firebase | Descrição |
|---|---|---|---|
| Comprador | `comprador.teste@fraldinhalivre.com.br` | `Tr6LnUJDONcTIYAemTE6YrOWPSj1` | Conta de testes sem permissões administrativas |
| Fornecedor | `fornecedor.teste1@fraldinhalivre.com.br` | `cSK4LXIakuajmCSiJFaHOccck2s1` | Distribuidora Sul Teste (proprietária de produtos no D1) |

> [!IMPORTANT]
> **Ação de Segurança e Higienização Documental (2026-09-27):**
> 1. Todas as contas de teste (`comprador.teste`, `fornecedor.teste1`, `fornecedor.teste2`, `comprador.teste1`) foram rotacionadas de forma segura via API do Firebase Identity Toolkit sem exposição em logs de console.
> 2. Todas as ocorrências da senha legada foram higienizadas e substituídas por `[senha de teste rotacionada]` nos arquivos rastreados (`context/estado/progresso.md`, `docs/governance/decisoes.md` e `context/estado/progresso-historico.md`).
> 3. O script [`scripts/qa-mvp06-e2e.mjs`](../../scripts/qa-mvp06-e2e.mjs) consome as novas credenciais a partir do arquivo local `.env.qa.local` (ignorado pelo Git) e lê `FIREBASE_API_KEY` dinamicamente de `front/.env.production`.

---

## 3. Matriz de Evidências Reais de Execução da API (HTTP / D1)

Abaixo constam os registros das execuções realizadas via script HTTP:

### Teste de Validação Negativa Segura (Sem escrita/alteração no D1):
* **Health check:** `GET /health` $\rightarrow$ 200 OK (`X-Request-Id: 5c55d003-f913-4668-ba02-fdfe2a33c936`)
* **Contagem de pedidos antes:** `GET /orders` $\rightarrow$ 6 pedidos
* **Tentativa inválida:** `POST /orders` sem `Idempotency-Key` $\rightarrow$ 400 Bad Request (`IDEMPOTENCY_KEY_REQUIRED`, `X-Request-Id: 8f900ede-12d7-49ff-944e-7675ab5ea0d4`)
* **Contagem de pedidos após:** `GET /orders` $\rightarrow$ 6 pedidos (comprovada a invariante: 0 pedidos gerados no D1)

### Histórico de Execuções de Escrita Anteriores (Caminho Positivo):
* **Execução Pré-Deploy (Commit 389a847):** Pedido `88d6a5ca-dc43-4acc-b69f-a9b787d2d23f` criado com pagamento simulado aprovado, confirmado e despachado pelo fornecedor (`confirmado` $\rightarrow$ `a-caminho`).
* **Execução Pós-Deploy (Commit 389a847 / Run 36292054889):** Pedido `4f41c724-5bdf-4eca-8d6c-7420a33fbfcd` criado com pagamento simulado aprovado e transicionado com sucesso para `a-caminho`.
* **Execução de Verificação Sequencial:** Pedido `234fe0e6-92af-44fa-9c6e-1674de36661b` validou a esteira completa.

> [!WARNING]
> O script possui trava fail-closed que bloqueia escritas por padrão. A flag `--allow-production-write` deve ser utilizada apenas de forma controlada, pois cada execução cria um pedido no D1 e consome estoque real do produto em produção.

---

## 4. Matriz por Rota e Viewports (Revisão de Implementação vs Automação)

> [!NOTE]
> Os itens abaixo descrevem a conformidade arquitetural e de CSS implementada nos componentes. **Eles não foram capturados por automação de navegador (headless browser) durante esta execução de script.**

| Rota | Viewport 360px | Viewport 390px | Desktop 1280px | Status de Verificação |
|---|---|---|---|---|
| `/` (Início) | OK (sem overflow) | OK (sem overflow) | OK | Implementado (links para catálogo funcionais) |
| `/catalogo` | Grid 2 cols fluido | Grid 2 cols fluido | Grid 4 cols | Implementado (refetch + link início nos estados vazios) |
| `/produto/[slug]` | Imagem + form em pilha | Imagem + form em pilha | 2 colunas | Implementado (breadcrumbs estruturais) |
| `/sacola` | Steppers touch-friendly | Steppers touch-friendly | Resumo lateral | Implementado (links para catálogo e início) |
| `/checkout` | Stepper vertical responsivo | Stepper vertical responsivo | Formulário centrado | Implementado (comprovante e continuidade) |
| `/minha-conta` | Tabs com scroll horizontal | Tabs com scroll horizontal | Abas amplas | Implementado (resiliência a falhas de pedidos) |
| `/painel-fornecedor` | Sidebar offcanvas retrátil | Sidebar offcanvas retrátil | Sidebar aberta | Implementado (limpar filtros no estado vazio) |
| `/login` & `/cadastro` | Formulários compactos | Formulários compactos | Painel duplo visual | Implementado (preservação mútua de `?redirect`) |

---

## 5. Limitações e Escopo Consciente Preservado

1. **Leilão Reverso**: Permanece inativo (`LEILAO_ATIVO=false`) e desacoplado.
2. **Gateway Real de Pagamento**: O pagamento testado foi o simulador de compra direta, sem integração bancária real (Feature 011).
3. **Notificações Reais (Email/Push)**: Disparo externo mantido desligado (Feature 010).
4. **Isolamento de Testes**: A criação de pedidos em produção gera impacto no histórico do banco e estoque de demonstração. Futuras homologações exigem ambiente de staging ou rotinas dedicadas de teardown/limpeza.

---

## 6. Conclusão da Revisão

A validação da API comprovou que a arquitetura de compra direta com pagamento simulado, persistência em D1 e ciclo de transições pelo fornecedor funciona em produção. No entanto, o encerramento formal do marco permanece **parcial** até que sejam geradas evidências visuais reais em navegador para os viewports declarados e automação ponta a ponta do fluxo de recusa no checkout.
