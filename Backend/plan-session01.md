# Session 01 — Planejamento do Backend Azure

**Data:** 2026-05-07
**Status:** Planejamento concluído — pronto para implementação

---

## Contexto do Projeto

**Fraldinha Livre** é um marketplace de fraldas que conecta famílias a fornecedores no Brasil. O diferencial do modelo de negócio é que fornecedores **competem por pedidos** (licitação), permitindo que a família escolha a melhor oferta de preço/prazo.

**Stack frontend (existente):** Next.js 16.2.4 + React 19 + TypeScript + Tailwind + shadcn/ui, hospedado no **Vercel**.

---

## Decisões Tomadas

| # | Decisão | Escolha | Motivo |
|---|---|---|---|
| 1 | Hospedagem do frontend | Vercel (mantido) | Não migrar — Vercel é a melhor DX para Next.js |
| 2 | Hospedagem do backend | Azure (apenas backend) | Separação de responsabilidades, custos controlados |
| 3 | Estágio do projeto | MVP / validação | Foco em custo mínimo e velocidade de iteração |
| 4 | Runtime da API | Azure Container Apps | Controle total do runtime, melhor DX local, fácil evolução |
| 5 | Banco de dados | Azure SQL Database Serverless | Pausa automática quando inativo (~1h), SQL padrão, ~$5-10/mês |
| 6 | Autenticação | Azure AD B2C | Gratuito até 50.000 MAU/mês, gerenciado, flows prontos |
| 7 | Modelo de pedidos | Abordagem B — API + fila assíncrona | Reflete o modelo de negócio (licitação); Service Bus Basic |

---

## Arquitetura Decidida

```
┌─────────────────────────────────────────────────────────────┐
│  Vercel                                                      │
│  Next.js 16 (frontend + SSR)                                │
│  → /cadastro, /login, /produtos, /pedidos, /area-cliente    │
└────────────────────┬────────────────────────────────────────┘
                     │ HTTPS (JWT do AD B2C como Bearer token)
                     ▼
┌─────────────────────────────────────────────────────────────┐
│  Azure                                                       │
│                                                              │
│  ┌──────────────────────────────┐   ┌─────────────────────┐ │
│  │  Azure AD B2C                │   │  Container Apps     │ │
│  │  • Signup/signin flows       │◄──│  API Node.js/TS     │ │
│  │  • Token validation          │   │  (Express/Fastify)  │ │
│  │  • 50k MAU gratuito          │   │  • REST endpoints   │ │
│  └──────────────────────────────┘   │  • Valida JWT B2C   │ │
│                                     └─────────┬───────────┘ │
│                                               │             │
│              ┌────────────────────────────────┤             │
│              │                                │             │
│              ▼                                ▼             │
│  ┌───────────────────────┐   ┌─────────────────────────┐   │
│  │  Azure Service Bus    │   │  Azure SQL Database     │   │
│  │  Basic tier           │   │  Serverless (autopause) │   │
│  │  • fila: pedidos      │   │  • users, products      │   │
│  │  • fila: ofertas      │   │  • orders, bids         │   │
│  └───────────┬───────────┘   └─────────────────────────┘   │
│              │                                               │
│              ▼                                               │
│  ┌───────────────────────┐   ┌─────────────────────────┐   │
│  │  Container App        │   │  Azure Blob Storage     │   │
│  │  Worker (consumidor   │   │  • imagens de produtos  │   │
│  │  das filas)           │   │  • documentos           │   │
│  └───────────────────────┘   └─────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

---

## Estimativa de Custo Mensal (MVP)

| Recurso | Tier | Custo estimado |
|---|---|---|
| Azure AD B2C | Free (≤50k MAU) | $0 |
| Container Apps (API) | Consumption (escala para zero) | $0–5/mês |
| Container Apps (Worker) | Consumption (escala para zero) | $0–3/mês |
| Azure SQL Database | Serverless, autopause 1h, 1 vCore | $5–10/mês |
| Azure Service Bus | Basic | ~$0.01/mês |
| Azure Blob Storage | LRS, hot tier | $1–2/mês |
| **Total estimado** | | **$6–20/mês** |

> Custo tende ao mínimo enquanto o tráfego for baixo — SQL pausa, Container Apps escalam para zero.

---

## Fluxo de Negócio — Pedido com Licitação

```
Usuário faz pedido
      │
      ▼
API valida JWT (AD B2C) → salva pedido no SQL (status: ABERTO)
      │
      ▼
Publica mensagem na fila "pedidos" (Service Bus)
      │
      ▼
Worker consome a mensagem → notifica fornecedores elegíveis
      │
      ▼
Fornecedor envia oferta → API recebe → salva bid no SQL
      │
      ▼
Publica mensagem na fila "ofertas" → notifica usuário
      │
      ▼
Usuário aceita oferta → status do pedido: CONFIRMADO
      │
      ▼
Pagamento via Mercado Pago (integração futura)
```

---

## Tasks Concluídas nesta Sessão

- [x] Exploração do projeto existente (estrutura, dependências, páginas)
- [x] Definição da estratégia de hospedagem (Vercel frontend + Azure backend)
- [x] Escolha dos recursos Azure com custo mínimo
- [x] Definição da autenticação (Azure AD B2C)
- [x] Definição do modelo assíncrono de pedidos (Service Bus)
- [x] Diagrama de arquitetura
- [x] Estimativa de custo

---

## Problemas Encontrados e Resoluções

| Problema | Resolução |
|---|---|
| O projeto não tem nenhum backend ainda — formulários são estáticos sem action real | Planejamento parte do zero, sem dívida técnica a resolver |
| Tensão entre custo zero e necessidade de fila assíncrona (modelo de licitação) | Service Bus Basic é efetivamente gratuito no MVP ($0.01/mês), mantido |
| Azure Functions vs Container Apps para a API | Container Apps escolhido: melhor DX local, sem cold starts longos, mais fácil de evoluir |

---

## Próximos Passos (Session 02 em diante)

### Session 02 — Infraestrutura Azure (IaC)
- [ ] Criar Resource Group no Azure
- [ ] Provisionar Azure SQL Database Serverless (via Azure CLI ou Bicep)
- [ ] Provisionar Azure Service Bus (Basic)
- [ ] Provisionar Azure Blob Storage
- [ ] Configurar Azure AD B2C (tenant, user flows, app registration)
- [ ] Criar Container Registry (GitHub Container Registry — gratuito)

### Session 03 — API base (Container App)
- [ ] Scaffoldar projeto Node.js + TypeScript + Fastify (ou Express) em `Backend/api/`
- [ ] Configurar autenticação JWT (validar tokens do AD B2C)
- [ ] Implementar endpoints de usuário: `POST /users`, `GET /users/me`
- [ ] Implementar endpoints de produtos: `GET /products`, `GET /products/:id`
- [ ] Dockerfile + docker-compose para desenvolvimento local
- [ ] Deploy manual da Container App no Azure

### Session 04 — Pedidos e fila
- [ ] Modelo de dados: `orders`, `bids` no SQL
- [ ] `POST /orders` → salva pedido + publica na fila
- [ ] Worker Node.js que consome fila "pedidos"
- [ ] `POST /orders/:id/bids` → fornecedor envia oferta + publica na fila "ofertas"
- [ ] `PATCH /orders/:id/accept-bid/:bidId` → usuário aceita oferta

### Session 05 — CI/CD e integração frontend
- [ ] GitHub Actions: build → push para GHCR → deploy Container Apps
- [ ] Variáveis de ambiente no Vercel apontando para a API Azure
- [ ] Route Handlers no Next.js fazendo proxy ou chamando direto a API
- [ ] Integração do cadastro/login com AD B2C (MSAL ou NextAuth + Azure provider)

### Session 06 — Pagamento (Mercado Pago)
- [ ] Conta Mercado Pago + credenciais sandbox
- [ ] Endpoint `POST /orders/:id/checkout` → cria preferência MP
- [ ] Webhook de confirmação de pagamento
- [ ] Atualiza status do pedido após pagamento confirmado

---

## Notas Técnicas

- **JWT validation:** a API valida tokens AD B2C via JWKS endpoint público do tenant — sem roundtrip ao AD B2C em cada request
- **Autopause SQL:** configurar com 1h de inatividade; a primeira query após pausa leva ~15s (aceitável no MVP)
- **CORS:** a Container App precisa liberar origem `*.vercel.app` e o domínio customizado quando houver
- **Secrets:** nunca commitar connection strings — usar Azure Key Vault Reference nas Container Apps ou variáveis de ambiente seguras

---

*Arquivo gerado na Session 01 — atualizar a cada sessão de implementação.*
