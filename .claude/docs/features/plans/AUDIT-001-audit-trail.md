# Plano de Implementação — AUDIT-001: Trilha Formal de Auditoria Administrativa

> **Status:** PLANEJADO / DOCUMENTADO (guardado para implementação futura)  
> **Data:** 19 de Setembro de 2026  
> **Decisões Vinculadas:** [D-050](file:///.claude/docs/governance/decisoes.md#D-050), [D-051](file:///.claude/docs/governance/decisoes.md#D-051), [D-054](file:///.claude/docs/governance/decisoes.md#D-054), [D-055](file:///.claude/docs/governance/decisoes.md#D-055)  
> **Referência PRD:** Linhas 140, 162, 233, 297, 361

---

## 1. Contexto e Motivação

Conforme definido no PRD do Fraldinha Livre e na decisão arquitetural D-050, o papel `admin` é estritamente o gestor e moderador da plataforma, e não participante operacional de comércio (não cria produtos, não assume ownership de terceiros e não emite pedidos ou relatórios operacionais).

A decisão D-050 estabelece explicitamente:
> *"Ações de moderação ou governança futura (ex: suspensão de usuário, bloqueio/desativação de produtos em desacordo, mediação de disputas) deverão:
> - Utilizar rotas administrativas explícitas (ex: `/admin/...`), nunca reaproveitar endpoints operacionais de parceiros;
> - Exigir papel `admin`;
> - Registrar ator, recurso alvo, ação, justificativa obrigatória e timestamp em trilha de auditoria formal (`AUDIT-001`);
> - Priorizar reversibilidade (soft actions/status) em detrimento de exclusões destrutivas (`DELETE`)."*

A task **AUDIT-001** implementa a fundação transversal dessa trilha de auditoria administrativa no banco D1, cria os contratos Zod compartilhados, expõe os endpoints administrativos com RBAC estrito e adiciona a primeira capacidade de governança moderada (ativação/desativação de produtos com justificativa obrigatória auditada), refletida na UI do painel `/admin`.

---

## 2. Visão Geral da Arquitetura

```
packages/contracts/
├── src/audit.ts                                # Schemas Zod: AuditEvent, AuditLogQuery, AdminModerateProduct
├── src/index.ts                                # Exportação de audit.ts
└── src/__tests__/audit.test.ts                 # Testes de validação dos contratos Zod

back/
├── src/schema/audit-logs.ts                    # Drizzle SQLite schema da tabela audit_logs
├── migrations/0010_audit_logs.sql              # Migration SQL para Cloudflare D1
├── src/lib/audit-trail.ts                      # Helper recordAuditEvent com logger estruturado
├── src/routes/admin.ts                         # Handlers: adminAuditLogsGetHandler, adminProductStatusPatchHandler
├── src/index.ts                                # Registro de rotas /admin/* com auth + requireAnyRole(['admin'])
└── test/audit-trail.test.ts                    # Testes de RBAC, persistência e auditoria no backend

front/
├── src/components/admin/AdminAuditTab.tsx      # Componente da aba de logs de auditoria
├── src/components/admin/AdminProductsTab.tsx   # Botão e modal de moderação com justificativa
├── src/app/admin/page.tsx                      # Adição da tab 'auditoria' no painel
└── src/components/admin/__tests__/AdminAuditTab.test.tsx # Testes de renderização e busca
```

---

## 3. Especificação Detalhada dos Componentes

### 3.1 Contratos Compartilhados (`packages/contracts`)

#### `packages/contracts/src/audit.ts`
- `AuditEventSchema`:
  - `id`: string (UUID)
  - `actorId`: string (UID do administrador)
  - `actorRole`: literal `'admin'`
  - `targetType`: `z.enum(['product', 'order', 'user', 'system'])`
  - `targetId`: string (ID do recurso afetado)
  - `action`: string (ex: `'product.status_change'`, `'product.moderate'`)
  - `reason`: string (`min(5)`, `max(500)`) — justificativa obrigatória para qualquer ação administrativa
  - `metadata`: `z.record(z.unknown()).optional()` — dados adicionais sanitizados (ex: `{ oldActive: true, newActive: false }`)
  - `requestId`: string (correlação com o cabeçalho `X-Request-Id`)
  - `createdAt`: string (ISO datetime)
- `AuditLogQuerySchema`:
  - `page`: number opcional (default 1)
  - `limit`: number opcional (default 20, max 100)
  - `targetType`: opcional
  - `targetId`: opcional
  - `action`: opcional
- `AdminModerateProductSchema`:
  - `active`: boolean
  - `reason`: string (`min(5)`, `max(500)`)
- `AdminAuditLogsResponseSchema`:
  - `logs`: array de `AuditEventSchema`
  - `total`: number
  - `page`: number
  - `limit`: number

---

### 3.2 Banco de Dados e Backend (`back`)

#### Schema Drizzle (`back/src/schema/audit-logs.ts`)
```ts
import { sqliteTable, text, index } from 'drizzle-orm/sqlite-core'

export const auditLogs = sqliteTable('audit_logs', {
  id: text('id').primaryKey(),
  actorId: text('actor_id').notNull(),
  actorRole: text('actor_role').notNull(),
  targetType: text('target_type').notNull(),
  targetId: text('target_id').notNull(),
  action: text('action').notNull(),
  reason: text('reason').notNull(),
  metadata: text('metadata'), // JSON stringificado
  requestId: text('request_id').notNull(),
  createdAt: text('created_at').notNull(),
}, (table) => ({
  targetIdx: index('idx_audit_logs_target').on(table.targetType, table.targetId),
  actorIdx: index('idx_audit_logs_actor').on(table.actorId),
  actionIdx: index('idx_audit_logs_action').on(table.action),
  createdIdx: index('idx_audit_logs_created_at').on(table.createdAt),
}))
```

#### Migration D1 (`back/migrations/0010_audit_logs.sql`)
```sql
CREATE TABLE IF NOT EXISTS `audit_logs` (
  `id` text PRIMARY KEY NOT NULL,
  `actor_id` text NOT NULL,
  `actor_role` text NOT NULL,
  `target_type` text NOT NULL,
  `target_id` text NOT NULL,
  `action` text NOT NULL,
  `reason` text NOT NULL,
  `metadata` text,
  `request_id` text NOT NULL,
  `created_at` text NOT NULL
);

CREATE INDEX IF NOT EXISTS `idx_audit_logs_target` ON `audit_logs` (`target_type`, `target_id`);
CREATE INDEX IF NOT EXISTS `idx_audit_logs_actor` ON `audit_logs` (`actor_id`);
CREATE INDEX IF NOT EXISTS `idx_audit_logs_action` ON `audit_logs` (`action`);
CREATE INDEX IF NOT EXISTS `idx_audit_logs_created_at` ON `audit_logs` (`created_at`);
```

#### Helper de Registro (`back/src/lib/audit-trail.ts`)
- Função `recordAuditEvent(c: Context, db: DrizzleD1Database, params: RecordAuditEventParams)`:
  - Gera `id = crypto.randomUUID()`.
  - Extrai `actorId = c.get('user').uid`, `actorRole = 'admin'`, `requestId = c.get('requestId')`.
  - Serializa `metadata` de forma segura.
  - Insere em `audit_logs`.
  - Emite log estruturado `logger.info(c, 'audit.event.recorded', { auditId, action, targetType, targetId, reason })`.

#### Handlers Administrativos (`back/src/routes/admin.ts`)
- `adminAuditLogsGetHandler`:
  - Valida parâmetros via `AuditLogQuerySchema`.
  - Consulta `audit_logs` com filtros e ordenação `desc(auditLogs.createdAt)`.
  - Retorna `AdminAuditLogsResponseSchema`.
- `adminProductStatusPatchHandler`:
  - Valida `:id` e payload via `AdminModerateProductSchema`.
  - Busca produto existente em `products` (404 com `PRODUCT_NOT_FOUND` se ausente).
  - Atualiza o campo `active` do produto.
  - Registra o evento de auditoria correspondente (`product.activated` / `product.deactivated`) com o `reason` obrigatório.
  - Retorna o produto atualizado.

#### Roteamento Principal (`back/src/index.ts`)
```ts
app.use('/admin/*', (c, next) => {
  const authMiddleware = createAuthMiddleware((token) =>
    verifyFirebaseIdToken(token, c.env.FIREBASE_PROJECT_ID),
  )
  return authMiddleware(c, next)
})
app.get('/admin/audit-logs', requireAnyRole(['admin']), adminAuditLogsGetHandler)
app.patch('/admin/products/:id/status', requireAnyRole(['admin']), adminProductStatusPatchHandler)
```

---

### 3.3 Frontend (`front`)

#### `front/src/components/admin/AdminAuditTab.tsx`
- Tabela paginada e responsiva com colunas:
  - Data/Hora (`createdAt` formatado)
  - Administrador (`actorId`)
  - Ação (`action`)
  - Alvo (`targetType` + `targetId`)
  - Justificativa (`reason`)
  - Request ID com botão de cópia de suporte via Clipboard API.
- Filtro rápido por tipo de alvo e feedback de carregamento/erro.

#### `front/src/components/admin/AdminProductsTab.tsx`
- Adição de coluna de Ações com botão "Desativar" / "Ativar".
- Modal de confirmação exigindo preenchimento de justificativa mínima (5 caracteres).
- Disparo de `PATCH /admin/products/:id/status` e atualização reativa do grid.

#### `front/src/app/admin/page.tsx`
- Inclusão da aba `Auditoria` no `TabsList` e `TabsContent`.

---

## 4. Estratégia de Testes e Validação

1. **Testes de Contratos:**
   - Validação Zod estrita de `AdminModerateProductSchema` (falha com `< 5` caracteres ou em branco).
   - Validação de `AuditEventSchema` e `AuditLogQuerySchema`.

2. **Testes no Backend (`back/test/audit-trail.test.ts`):**
   - Admin acessa `GET /admin/audit-logs` com sucesso (200 OK).
   - Comprador, Fornecedor e usuário sem papel recebem `403 Forbidden`.
   - Requisições sem token recebem `401 Unauthorized`.
   - Admin altera status do produto com justificativa válida (200 OK + linha inserida em `audit_logs`).
   - Tentativa de moderação sem justificativa ou vazia é rejeitada com 400 `INVALID_REQUEST`.
   - Invariante de Request ID: `audit_logs.requestId` coincide com `X-Request-Id`.

3. **Testes de Frontend:**
   - Renderização da tabela de auditoria e chamada à API.
   - Validação da abertura do modal de moderação e envio da justificativa.
