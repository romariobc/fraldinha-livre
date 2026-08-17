# Project: Fraldinha Livre Chat Agent Fixes

## Architecture
- Frontend: Next.js (`front/`)
- Backend: Hono/Drizzle/D1/Workers AI (`back/`)

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| 1 | Backend Tool Leakage & Search | `back/src/routes/chat.ts`, `back/src/lib/chat-completion.ts` | none | PLANNED |
| 2 | Frontend Mobile UI | `front/src/components/assistente/ChatUI.tsx` | none | PLANNED |
| 3 | Testing & Deploy | `front/`, `back/` | 1, 2 | PLANNED |
| 4 | Git Commit & Push | `chat-agent-hoje` branch | 3 | PLANNED |

## Interface Contracts
### Backend ↔ Frontend
- `POST /chat/message`
- Frontend expects standard text responses and handles action responses correctly.

## Future Backlog / Roadmap
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| 5 | Integração do Hub de Fornecedores aos ERPs | Arquitetura, Sync de Catálogo e Pedidos | Definir tecnologia (MCP, Websockets, Webhooks, Mensageria) | PLANNED (FUTURO) |
