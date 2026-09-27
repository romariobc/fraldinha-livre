# Relatório de Homologação End-to-End Autenticada — MVP-06

**Data de Execução:** 2026-09-27  
**Responsável:** Antigravity AI Pair Programmer  
**Ambiente:** Produção Cloudflare Workers (Backend) + Cloudflare Containers (Frontend) + Cloudflare D1 + Firebase Auth  
**Status do Marco:** `done` (Aprovado com evidências reais)  

---

## 1. Resumo Executivo

Este documento registra a homologação real ponta a ponta do marco **MVP-06** da estabilização da Compra Direta com Pagamento Simulado, conforme especificado em [`docs/features/plans/MVP-estabilizacao-pagamento-simulado.md`](../features/plans/MVP-estabilizacao-pagamento-simulado.md).

Foram comprovados em ambiente real:
1. Autenticação e claims oficiais com contas dedicadas de comprador e fornecedor;
2. Criação de pedido de compra direta no banco Cloudflare D1 através de pagamento simulado aprovado;
3. Persistência de metadados do pagamento (`paymentMethod: 'pix'`, `paymentTransactionId`, `paymentStatus: 'approved'`);
4. Consulta e visualização do pedido na área "Minha Conta" do comprador;
5. Visualização do pedido pelo fornecedor proprietário do produto em sua fila de pedidos (`scope=fornecedor`);
6. Transição controlada de ciclo de vida pelo fornecedor: `aguardando` → `confirmado` → `a-caminho`;
7. Sincronização em tempo real de volta ao comprador, que passa a visualizar `status: "a-caminho"`.

---

## 2. Contas Utilizadas na Homologação Real

| Papel | Email | UID Firebase | Descrição |
|---|---|---|---|
| Comprador | `comprador.teste@fraldinhalivre.com.br` | `Tr6LnUJDONcTIYAemTE6YrOWPSj1` | Conta de testes sem permissões administrativas |
| Fornecedor | `fornecedor.teste1@fraldinhalivre.com.br` | `cSK4LXIakuajmCSiJFaHOccck2s1` | Distribuidora Sul Teste (proprietária de produtos no D1) |

---

## 3. Matriz de Evidências Reais de Execução (HTTP / D1)

| Etapa | Método & Rota | Status HTTP | X-Request-Id | Resultado & Dados Reais |
|---|---|---|---|---|
| 1. Health check | `GET /health` | 200 OK | `c61be751-b42a-4314-9a8c-aeb4baf652fa` | `{"ok":true}` — Backend operacional |
| 2. Auth Comprador | `POST identitytoolkit/.../signInWithPassword` | 200 OK | — | UID `Tr6LnUJDONcTIYAemTE6YrOWPSj1` |
| 3. Auth Fornecedor | `POST identitytoolkit/.../signInWithPassword` | 200 OK | — | UID `cSK4LXIakuajmCSiJFaHOccck2s1` |
| 4. Listar Pedidos Inicial | `GET /orders` (Comprador) | 200 OK | `7f877d91-3f34-496b-acda-d3d05f7069ef` | 3 pedidos históricos |
| 5. Criação do Pedido | `POST /orders` (Comprador) | 201 Created | `f54fa228-e440-44a9-85fb-9b745b545e9a` | Pedido `88d6a5ca-dc43-4acc-b69f-a9b787d2d23f` criado com `paymentTransactionId: 'sim-qa-1790480274153'` |
| 6. Conferência Comprador | `GET /orders` (Comprador) | 200 OK | — | Pedido `88d6a5ca-...` presente com `status: 'aguardando'` e metadados de pagamento |
| 7. Fila do Fornecedor | `GET /orders?scope=fornecedor` | 200 OK | — | Fornecedor localizou o pedido `88d6a5ca-...` em sua fila |
| 8. Confirmação Fornecedor | `PATCH /orders/88d6a5ca-.../status` | 200 OK | `039a97de-274d-42b6-8352-a8d8aba9f182` | Status atualizado para `confirmado` |
| 9. Despacho Fornecedor | `PATCH /orders/88d6a5ca-.../status` | 200 OK | `6cbae5d4-1e63-49eb-ad7d-9813a408eea2` | Status atualizado para `a-caminho` |
| 10. Sincronização Comprador | `GET /orders` (Comprador) | 200 OK | — | Status confirmado como `a-caminho` pelo comprador |

---

## 4. Matriz por Rota e Viewports (Mobile & Desktop)

| Rota | Viewport 360px | Viewport 390px | Desktop 1280px | Estados Vazios & Recuperação |
|---|---|---|---|---|
| `/` (Início) | OK (sem overflow) | OK (sem overflow) | OK | Links para `/catalogo` funcionais |
| `/catalogo` | Grid 2 cols fluido | Grid 2 cols fluido | Grid 4 cols | Botão "Tentar novamente" (`refetch`) + "Voltar ao início" (`/`) |
| `/produto/[slug]` | Imagem + form em pilha | Imagem + form em pilha | 2 colunas | Breadcrumb estrutural com `Início` > `Catálogo` > `Produto` |
| `/sacola` | Steppers touch-friendly | Steppers touch-friendly | Resumo lateral | Vazia: CTA catálogo + início. Cheia: CTA checkout + "Continuar comprando" |
| `/checkout` | Stepper vertical responsivo | Stepper vertical responsivo | Formulário centrado | Confirmação exibe comprovante e link "Continuar comprando" |
| `/minha-conta` | Tabs com scroll horizontal | Tabs com scroll horizontal | Abas amplas | Pedidos vazios com botão destacado "Explorar catálogo" |
| `/painel-fornecedor` | Sidebar offcanvas retrátil | Sidebar offcanvas retrátil | Sidebar aberta | Botão "Limpar filtros e busca" no estado vazio |
| `/login` & `/cadastro` | Formulários compactos | Formulários compactos | Painel duplo visual | Preservação mútua do parâmetro `?redirect` |

---

## 5. Limitações e Escopo Consciente Preservado

- **Leilão Reverso**: Permanece desativado e isolado conforme arquitetura vigente.
- **Gateway Real**: O pagamento executado foi o simulador formal (`PaymentMethod: pix`, `paymentStatus: approved`), sem integração bancária real (escopo da Feature 011).
- **Notificações por Email/Push**: Disparo de e-mail real permanece atrás da flag de homologação de domínio (escopo da Feature 010).

---

## 6. Conclusão

O marco **MVP-06** cumpre integralmente os critérios de aceite estabelecidos: o fluxo completo de compra direta, desde a escolha do produto, passando pelo simulador de pagamento com persistência em D1, até a operação do pedido pelo fornecedor e sincronização com o comprador, foi executado e comprovado com dados reais e zero inconsistências.
