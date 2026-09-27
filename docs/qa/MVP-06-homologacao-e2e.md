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
> **Ação de Segurança Realizada (2026-09-27):** As senhas padrão de teste anteriormente utilizadas foram rotacionadas via Firebase Identity Toolkit. O script [`scripts/qa-mvp06-e2e.mjs`](../../scripts/qa-mvp06-e2e.mjs) foi atualizado para carregar credenciais exclusivamente via variáveis de ambiente (`QA_BUYER_PASSWORD` e `QA_SUPPLIER_PASSWORD` via `.env.qa.local`), eliminando qualquer credencial em texto puro no código.

---

## 3. Matriz de Evidências Reais de Execução da API (HTTP / D1)

Abaixo constam os registros das execuções ponta a ponta realizadas via script HTTP:

### Execução Inicial (Pré-Deploy do commit 389a847):
* **Health check:** `GET /health` $\rightarrow$ 200 OK (`X-Request-Id: c61be751-b42a-4314-9a8c-aeb4baf652fa`)
* **Pedido criado:** ID `88d6a5ca-dc43-4acc-b69f-a9b787d2d23f` via `POST /orders` (`X-Request-Id: f54fa228-e440-44a9-85fb-9b745b545e9a`, tx `sim-qa-1790480274153`)
* **Confirmação do Fornecedor:** `PATCH /orders/88d6a5ca-.../status` $\rightarrow$ 200 OK (`X-Request-Id: 039a97de-274d-42b6-8352-a8d8aba9f182`, status `confirmado`)
* **Despacho do Fornecedor:** `PATCH /orders/88d6a5ca-.../status` $\rightarrow$ 200 OK (`X-Request-Id: 6cbae5d4-1e63-49eb-ad7d-9813a408eea2`, status `a-caminho`)
* **Consulta do Comprador:** `GET /orders` $\rightarrow$ 200 OK (status atualizado para `a-caminho`)

### Execução de Validação Pós-Deploy (Commit 389a847 / Run 36292054889):
* **Health check:** `GET /health` $\rightarrow$ 200 OK (`X-Request-Id: a2bcfba4-c185-4666-8069-9d57a9195a56`)
* **Pedido criado:** ID `4f41c724-5bdf-4eca-8d6c-7420a33fbfcd` via `POST /orders` (`X-Request-Id: 63cdeab2-6744-4c4d-8265-25aa5e08a3fb`, tx `sim-qa-1790480566239`)
* **Confirmação e Despacho:** `confirmado` (`X-Request-Id: c438af88-917a-497c-92a0-fafc5d785e79`) e `a-caminho` (`X-Request-Id: 142e2c10-9344-4b3f-a45c-48c4ef798495`)

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
