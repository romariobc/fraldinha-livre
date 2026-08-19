# Project: Fraldinha Livre (Marketplace B2B2C)

## Architecture
- **Frontend**: Next.js (`front/`) com TailwindCSS e shadcn/ui.
- **Backend**: Hono / Drizzle ORM / Cloudflare D1 / Cloudflare Workers AI (`back/`).
- **Autenticação**: Firebase Auth (Token gerido no client e enviado via header nos requests Hono).

## Milestones Actuais
| # | Name | Scope | Status |
|---|------|-------|--------|
| 1 | Chat Agent Mobile & Tool Leakage | `front/`, `back/` | COMPLETED |
| 2 | Painel do Fornecedor Básico | Layout, Sidebar, Header (Base UI) | COMPLETED |
| 3 | Gestão de Pedidos (Fornecedor) | DataTable, Ações (Expandir, Cancelar) | COMPLETED |
| 4 | Relatório Unidirecional no D1 | Rota `/orders/:id/report`, Tabela `reports` no D1 | COMPLETED |
| 5 | Link de Catálogo Exclusivo B2C | Filtro por `supplierId` em `/catalogo` | COMPLETED |
| 6 | Seed Real de Produtos no D1 | Script de Raspagem e Injeção no DB | COMPLETED |
| 7 | Integração do Hub de Fornecedores aos ERPs | Arquitetura, Sync de Catálogo e Pedidos | PLANNED (FUTURO) |

## Funcionalidades Recentes Entregues
- **Seed Real de Produtos (Pague Menos)**: Script de scraping implementado consumindo a API do catálogo VTEX da Pague Menos. Extraídos 97 produtos de fraldas Pampers, Turma da Mônica e MamyPoko (com links de imagens reais). Preço de atacado B2B calculado deterministicamente com 35% de desconto sobre o varejo.
- **Mapeamento de Imagens**: Tabela `products` e contratos Zod atualizados com campo `imageUrl`. Imagens renderizadas dinamicamente no `ProductCard` e na página de detalhes do produto.
- **Desacoplamento de Mocks**: Constante estática `PRODUCTS` removida de `products.ts` do frontend (agora é `[]`). Mocks desacoplados em `products-mock.ts` para suites de testes unitários isoladas.
- **Painel Administrativo (`/painel-fornecedor`)**: Rotas criadas para Visão Geral, Gestão de Pedidos, Catálogo, Relatórios e Configurações.

## Interface Contracts (Backend ↔ Frontend)
- Chamadas de API autenticadas do frontend utilizam o utilitário `apiFetch` (em `src/lib/api-client.ts`), que injeta automaticamente o Bearer Token do Firebase. O backend Hono valida no middleware de auth e não mantém estado no banco D1 para sessão.

## Future Backlog / Roadmap
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| 7 | Integração do Hub de Fornecedores aos ERPs | Arquitetura, Sync de Catálogo e Pedidos | Definir tecnologia (MCP, Websockets) | PLANNED (FUTURO) |
