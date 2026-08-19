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

---

## Decisão 002: Seed Real de Produtos no D1 (Milestone 6)

**Data:** 2026-08-17  
**Status:** ✅ IMPLEMENTADO  
**Escopo:** Milestone 6 — Seed Real de Produtos no D1

### Contexto

Substituição de todo o catálogo mockado no frontend Next.js por dados reais de produtos de fraldas obtidos via raspagem da Pague Menos, populando a base D1 e viabilizando o catálogo 100% dinâmico via API.

### Decisões Técnicas Tomadas

1. **Alvo de Scraping e API:** A API VTEX Catalog System (`https://www.paguemenos.com.br/api/catalog_system/pub/products/search?ft=...`) foi selecionada como fonte de dados preferencial em detrimento da Intelligent Search API por entregar resultados mais específicos de fraldas das marcas alvo (Pampers, Turma da Mônica, MamyPoko) sem ruído de produtos de outras categorias.
2. **Esquema de Banco e Contratos:** Campo `imageUrl` (image_url em SQL) adicionado à tabela `products` e integrado no Zod `ProductSchema` do monorepo para dar suporte a imagens no frontend.
3. **Versão de Wrangler para Migrações:** Como o ambiente local opera sob Node v20.20.2 e a versão v4 do Wrangler exige Node >=22.0.0, foi utilizado `npx wrangler@3` para executar as migrações locais e em produção (remoto) de maneira estável.
4. **Resiliência de Testes Frontend:** O array de mocks estáticos `PRODUCTS` foi removido de `front/src/lib/products.ts` (esvaziando o catálogo estático), mas mantido isolado em `front/src/lib/mock-data/products-mock.ts` para que as suites de testes unitários existentes e o `MockProductRepository` continuem funcionando sem quebras por falta de dados.
5. **Robustez no Firebase em Testes:** Inicialização de variáveis Firebase mockadas em `vitest.setup.ts` para evitar erros de inicialização de chave do Firebase em testes de componentes que importam módulos do SDK indiretamente.

