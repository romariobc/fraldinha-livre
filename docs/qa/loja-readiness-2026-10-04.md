> Atualização de escopo em 2026-10-05: o usuário confirmou que a publicação desejada é da loja com pagamento simulado, sem dependência do chat, conforme D-037. Pagamento real não é bloqueio desse beta. O relatório abaixo registra a avaliação comercial anterior; resultado da jornada e correções em [loja-fluxo-simulado-2026-10-05.md](loja-fluxo-simulado-2026-10-05.md).

# Prontidão da loja — 2026-10-04

## Veredito

Ainda não atende ao lançamento comercial pago. O núcleo de pedidos e o assistente funcionam em homologação; o frontend público tem impedimentos adicionais. Não houve merge nem publicação de produção nesta verificação. A autorização do usuário foi condicional à loja funcional, e foi solicitada a distinção entre beta sem cobrança e operação paga.

## Evidências verificadas

- Código candidato: `75534be4e3b86b423f3a61db2b4e48df341023f6`, PR [#21](https://github.com/romariobc/fraldinha-livre/pull/21).
- [CI do candidato](https://github.com/romariobc/fraldinha-livre/actions/runs/37248756945): frontend 701 testes, backend 296, contratos 57, executor E2E 32, tipos e lint aprovados.
- Homologação isolada: Worker `fraldinha-livre-backend-homologacao`, versão `bd2e9206-9c17-44e3-9589-9b5bbfa1272a`, D1 `339b4026-900f-4a93-9857-7e541c32ebc0`. Ciclo de pedido até entrega/histórico, checkout normal do assistente e recuperação real com ID inválido passaram. Administração não foi exercitada.
- Produção, leitura nesta sessão: `GET /health` 200; `GET /products` 200 com 314 produtos; `GET /orders` sem token 401, requestId `ecd5c783-abb5-4a1b-92bb-1899ee12ea1f`.
- Navegador real: catálogo carregou 314 produtos e checkout anônimo redirecionou ao login. Não foi executada compra no frontend de produção.
- Na página inicial pública, clique em “Adicionar Supersec Pants ao carrinho” não provocou navegação, mudança da sacola ou feedback. A inspeção do mesmo arquivo no candidato confirmou botão sem handler (`front/src/app/(main)/page.tsx`, linhas 335–340).
- A home e o FAQ anunciam Mercado Pago. O checkout instancia `MockPaymentGateway` e `MockFulfillmentService`. O próprio [PRD](../PRD-Fraldinha-Livre.md) distingue beta controlado de operação comercial paga.

## Impedimentos

1. Gateway financeiro, webhook de confirmação, expiração/reconciliação e estornos reais não implementados — feature 011 permanece pendente. Pagamento simulado não comprova recebimento.
2. Logística no checkout ainda simulada. Não comunicar contratação ou prazo garantido como fato.
3. Botões de adicionar e “Ver todos” da home são demonstrativos: botão sem ação, preços/itens hardcoded e link “Ver todos” apontando para a mesma seção.
4. Promessas públicas incompatíveis com a implementação: Mercado Pago, competição entre fornecedores (leilão desativado), prazos e entrega garantidos. Corrigir antes de divulgar o beta.
5. Aceite visual completo com comprador/fornecedor/admin no commit candidato e build de publicação do frontend ainda não comprovados por esta sessão. As provas REST não substituem navegação.
6. iPhone/foto física e neurons/custo oficial seguem pendentes, sem serem apresentados como aprovados.

## Próxima publicação

Para beta, corrigir CTAs e comunicação, validar build/jornada frontend e registrar operação sem cobrança real. Para lançamento pago, implementar e homologar as integrações financeiras e operacionais. Não modificar status de features para done com base somente na existência de código ou CI verde.

## Harness seguido

[AGENTS.md](../../AGENTS.md), [session-start](../../.agents/skills/session-start/SKILL.md), [session-finish](../../.agents/skills/session-finish/SKILL.md), [ciclo da sessão](../governance/ciclo-de-sessao.md). Alterações locais preexistentes foram identificadas e preservadas; revisão do candidato usa GitHub como fonte. Contexto histórico não substitui a evidência atual.
