# Decisões Arquiteturais — Fraldinha Livre

> Documento de registro de decisões técnicas e estratégicas do projeto.
> Atualizado em: 2026-08-16

---

## Decisão 001: Integração ERP — Hub de Fornecedores (Task 5)

**Data:** 2026-08-16  
**Status:** 🟡 PENDENTE APROVAÇÃO  
**Escopo:** Backlog Task 5 — Integração do Hub de Fornecedores aos ERPs

### Contexto

O marketplace Fraldinha Livre precisa automatizar a integração bidirecional entre o painel do fornecedor e os ERPs das distribuidoras parceiras. Hoje, o fluxo de catálogo e pedidos é 100% manual.

### Pesquisa Realizada

Foram investigados:
- **ERPs brasileiros** do mercado FMCG/fraldas (Bling, Tiny, Omie, SAP B1, TOTVS WinThor/Protheus, Sankhya)
- **Padrões de integração** (Webhooks, Cloudflare Queues, Durable Objects, MCP, iPaaS, EDI PROCEDA, DB Sync direto)
- **Especificidades fiscais brasileiras** (NF-e Layout 4.0, ICMS-ST, NCM 9619.00.00, PIX dinâmico)
- **Compatibilidade** com a stack atual (Cloudflare Workers + D1 + Hono + Drizzle)

### Arquitetura Proposta: Cloudflare-Native

```
Fornecedores (ERPs)
    ↕ Webhooks / REST APIs
Cloudflare Edge Integration Hub
    ├─ Worker: API Gateway & Webhook Router
    ├─ Durable Objects: Rate Limiter, OAuth Manager, Idempotency Lock
    ├─ Cloudflare Queues: orders, stock, catalog, DLQ
    ├─ D1: Metadata, Credenciais (AES-256-GCM), Mappings
    ├─ R2: NF-e XMLs, DANFE PDFs
    └─ MCP + Workers AI: Catalog Mapping Engine
        ↕
Marketplace Core (Hono API + Painel B2B existentes)
```

### Roadmap em 3 Fases

| Fase | Foco | ERPs Alvo | Duração Estimada |
|------|------|-----------|------------------|
| **Fase 1: MVP** | PMEs | Bling API v3, Tiny ERP v3 | ~6–8 semanas |
| **Fase 2: Escala** | Mid-Market + AI | SAP B1, Queues, DO, MCP Catalog | ~16 semanas |
| **Fase 3: Enterprise** | Atacado Pesado | WinThor, Protheus, EDI PROCEDA | ~12 semanas |

### Dados Técnicos Chave

**Novas tabelas D1 (aditivas, sem breaking changes):**
- `supplier_erp_configs` — Configuração e credenciais criptografadas por fornecedor
- `erp_product_mappings` — Mapeamento ERP SKU ↔ Marketplace SKU
- `erp_order_sync_log` — Log de sincronização de pedidos (status, NF-e, tentativas)
- `erp_stock_sync_log` — Log de sincronização de estoque (delta, fonte)

**Campo `erpId` já existe:** O schema Zod `ProductAtributosSchema` já inclui `erpId?: string`, preparado para uso.

**Segurança:**
- Credenciais de ERP criptografadas com AES-256-GCM + master key no Cloudflare Secrets
- Webhooks validados via HMAC-SHA256
- Circuit Breaker pattern para ERPs instáveis
- Idempotência via Durable Objects (previne pedidos duplicados)

### Decisões Pendentes (Aguardando Stakeholder)

| # | Decisão | Opções | Recomendação |
|---|---------|--------|-------------|
| 1 | **Quais ERPs priorizar no MVP?** | Bling + Tiny (PME) / Omie / SAP B1 | Bling + Tiny |
| 2 | **NF-e: quem emite?** | A) Fornecedor emite no ERP / B) Marketplace emite via API fiscal | A) Fornecedor emite |
| 3 | **MCP Catalog Mapping** | Fase 1 (antecipado) / Fase 2 (recomendado) | Fase 2 |
| 4 | **Plano Cloudflare** | Free / Paid ($5/mês) / Enterprise | Paid (mínimo para Queues) |

### Open Questions

1. Quais ERPs os fornecedores-piloto utilizam?
2. Volume esperado de pedidos/dia e fornecedores nos próximos 6 meses?
3. Budget para APIs fiscais (~R$0,10-0,30/NF-e)?
4. Acesso ao painel de Cloudflare Secrets configurado?

### Referências

- Plano de implementação completo: `implementation_plan.md` (artifact Antigravity)
- Pesquisa de ERPs brasileiros: Bling API v3 docs, Tiny API v3 docs, SAP B1 Service Layer docs
- Cloudflare Queues: https://developers.cloudflare.com/queues/
- Cloudflare Durable Objects: https://developers.cloudflare.com/durable-objects/
- MCP (Model Context Protocol): https://modelcontextprotocol.io/

---

## Decisões Anteriores (Registro)

### Decisão 000: Painel do Fornecedor B2B — Design e Arquitetura

**Data:** 2026-08-15  
**Status:** ✅ IMPLEMENTADO  

**Decisão:** Recriar o Painel do Fornecedor utilizando layout isolado com Sidebar (Shadcn UI), sem Navbar/Footer do B2C. Adotar Hexagonal Architecture (Ports & Adapters) no frontend.

**Resultado:**
- Layout B2B com Sidebar isolada implementado
- Dashboard com Metric Cards e Sparklines (Recharts)
- Data Tables com TanStack Table (Pedidos + Catálogo)
- Modal de Catálogo com Command/Combobox (seleção, não criação)
- Campo ERP_ID nos atributos do produto
- 528 testes unitários passando (100%)
- 0 erros TypeScript, 0 erros ESLint

**Regra de Negócio Definida:** Fornecedores NÃO podem criar produtos do zero. Devem selecionar do catálogo global e opcionalmente vincular um ERP_ID.
