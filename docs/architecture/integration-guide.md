# Integração frontend e backend

Referência revisada em 2026-09-21 a partir do código. Não é evidência de deploy.

## Fluxo vigente

Frontend Next.js em front/ → apiFetch com Firebase ID Token → API Hono em back/ → Drizzle/D1. Schemas Zod e tipos de fronteira ficam em packages/contracts/src/.

- [Cliente HTTP](../../front/src/lib/api-client.ts): token, request ID e contrato tipado de erros.
- [Autenticação](../../back/src/middleware/auth.ts): valida assinatura, issuer, audience e validade do token; resolve Custom Claims. Claims conflitantes falham de forma fechada. Existe fallback legado ADMIN_UID, sujeito às regras do middleware; não é substituto para provisionar claims corretamente.
- [Produtos](../../front/src/lib/adapters/http-product-repository.ts) e [pedidos](../../front/src/lib/adapters/http-order-repository.ts) já possuem adapters HTTP e backend real.
- [Rotas](../../back/src/routes/) e [schemas](../../back/src/schema/) são a referência para endpoints e persistência atuais.
- [Contratos](../../packages/contracts/src/) são compartilhados; preserve compatibilidade e teste consumidores ao alterá-los.

## Limites e validação

Flags e mocks devem ser conferidos no consumidor específico, sem presumir um único modo para todo o frontend. Pagamento real continua pendente; sucesso do checkout simulado não prova transação bancária.

Valide contratos, autorização, estados de erro e integrações dos workspaces afetados. Migrations locais, testes locais, aplicação remota e deploy são evidências distintas. Consulte [estado atual](../../context/estado/progresso.md) antes de qualquer operação remota.

Veja [procedimento de contrato](../../.agents/skills/api-contract/SKILL.md) e [comandos de validação](../governance/ciclo-de-sessao.md).
