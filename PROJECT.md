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
| 6 | Seed Real de Produtos no D1 | Script de Raspagem e Injeção no DB | PLANNED (Próxima Sessão) |

## Funcionalidades Recentes Entregues (Supplier Dashboard)
- **Painel Administrativo (`/painel-fornecedor`)**: Rotas criadas para Visão Geral, Gestão de Pedidos, Catálogo, Relatórios e Configurações.
- **Gráficos e Métricas**: Cards de métricas operacionais e gráficos (Recharts) implementados com mock temporário.
- **Reporte de Problemas**: Sistema unidirecional onde o fornecedor alerta o cliente final. Os dados são salvos diretamente no D1 na tabela `reports` vinculados ao `order_id`.
- **Loja Exclusiva (B2C)**: A rota pública de catálogo agora reconhece a query `?fornecedor=[id]` mostrando apenas produtos do fornecedor específico (uma página de vitrine para marketing do lojista).
- **Correções Base UI**: Dropdown menus atualizados com `DropdownMenuGroup` para evitar erros de runtime do shadcn/ui atualizado.

## Interface Contracts (Backend ↔ Frontend)
- Chamadas de API autenticadas do frontend utilizam o utilitário `apiFetch` (em `src/lib/api-client.ts`), que injeta automaticamente o Bearer Token do Firebase. O backend Hono valida no middleware de auth e não mantém estado no banco D1 para sessão.

## Future Backlog / Roadmap
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| 7 | Integração do Hub de Fornecedores aos ERPs | Arquitetura, Sync de Catálogo e Pedidos | Definir tecnologia (MCP, Websockets) | PLANNED (FUTURO) |
