---
name: api-contract
description: Contratos e integração real entre frontend, API e dados; consultar ao alterar a fronteira entre workspaces.
---

# Frontend ↔ backend

Modelos de apresentação ficam em front/src/lib/domain/ e products.ts, derivados dos contratos; conversões em order-adapters.ts e product-adapters.ts. Fixtures não são fonte de tipos de runtime.

A fonte compartilhada de tipos e schemas Zod é `packages/contracts/src/`. Confirme exports e consumidores antes de criar contratos duplicados.

- Pedidos: `front/src/lib/ports/order-repository.ts`, adapters mock/http e `front/src/contexts/orders-context.tsx`.
- Produtos: `front/src/lib/ports/product-repository.ts`, `front/src/lib/adapters/http-product-repository.ts`, `front/src/contexts/products-context.tsx` e catálogo do fornecedor. Já existe backend real; não trate catálogo e fornecedor como 100% mock.
- HTTP: `front/src/lib/api-client.ts` centraliza token Firebase, identificação da requisição e erros. Reutilize-o.
- API: `back/src/routes/`; persistência em `back/src/schema/` e `back/migrations/`.
- Auth: `back/src/middleware/auth.ts` valida ID Token via JWKS e resolve Custom Claims. Há compatibilidade com ADMIN_UID; claims conflitantes negam acesso. Não implemente autorização apenas na interface.

Rotas já implementadas incluem GET/POST /orders, PATCH /orders/:id/cancel, GET /products (incluindo scope=fornecedor), POST /products e PUT/DELETE /products/:id. Confira métodos, payloads e permissões nas rotas antes de alterar consumidores.

Mocks restantes, flags e adaptadores de pagamento/fulfillment têm funções específicas; a existência de um mock não significa ausência de backend. O checkout ainda tem pagamento simulado conforme estado atual.

Ao mudar uma integração: verifique schema compartilhado, consumidores, erros tipados (use error.code, não inferência por mensagem), loading/erro e testes pertinentes. Siga risk-zone-protocol para contracts e infraestrutura compartilhada. Detalhes em `docs/architecture/integration-guide.md`.

Checkout ativo: POST /orders recebe simulationOutcome approved/declined, gera paymentMode/transactionId/status no servidor e rejeita pending. Metadados legados do body não provam pagamento. Tentativa/chaves por UID/fornecedor são preservadas pelo cliente para replay; o backend mantém ownership e estoque transacionais.

## Acompanhamento MP-06

GET /orders/:id?scope=comprador|fornecedor|admin retorna OrderDetail: snapshot e eventos lidos no mesmo D1.batch, com historySource complete/partial/legacy. Não criar eventos retroativos. O vínculo explícito supplierId prevalece; somente legado sem vínculo mantém o fallback anterior por itens/produtos. OrderTracking é a apresentação compartilhada. use-live-order-query.ts atualiza ao montar, foco/visibilidade e a cada 30s visíveis, compartilha consulta em andamento e preserva dados em erro. Chaves incluem conta/escopo/pedido e descartam respostas após troca de conta. Pacote: node scripts/context.mjs packet order-tracking.

## Operações MP-07

order-actions.ts define disponibilidade visual por papel/vínculo/estado; backend mantém decisão definitiva. use-order-operation.ts serializa envio, reconcilia após erro/sucesso e conserva feedback acionável. Mutations HTTP vinculam UID esperado; fornecedor usa o snapshot retornado. OrderTracking recebe refreshVersion após operação e usa refresh(true) para esperar leitura anterior antes de consultar o estado atual. Motivo fornecedor/admin é obrigatório; após despacho só entrega pelo fornecedor e atendimento por ocorrência. A orientação provisória de MP-07 foi substituída pela abertura/resposta persistida de MP-08 descrita abaixo. Pacote: node scripts/context.mjs packet order-operations.

## Ocorrências MP-08

Contrato occurrence.ts; GET/POST /orders/:id/occurrences; POST /orders/:id/occurrences/:reportId/messages. Identidade/papel vêm do token; comprador/fornecedor vinculados abrem, partes/admin respondem/resolvem. Resposta exige expectedVersion/requestId/status e texto de 5–4000 caracteres. D1.batch + versão/replay impedem sobrescrita e duplicação; resolvida é somente leitura. reports.message inicial/read/IDs/horários antigos preservados na migração aditiva 0016; respostas em report_messages. Endpoint antigo fornecedor /report mantém {message}/{success,reportId}. Sem fornecedor no snapshot, novas aberturas exigem reconciliação; reports antigos mantêm acesso ao fornecedor registrado, nunca pelo dono atual do catálogo. OrderOccurrences valida recibos/dados e vincula UID. Pacote: order-occurrences. Sem efeito comercial ou notificações implícitas; MP-09 permanece separado.

## Notificações MP-09

Schemas notification.ts: GET /notifications (cursor/limit, caixa e unreadCount do UID do token), PATCH /notifications/:notificationId/read (recibo idempotente) e GET /notifications/:notificationId/destination (destino tipado, ownership/role atual, sem URL arbitrária). internal-notifications.ts projeta eventos no mesmo D1.batch, deduplicados por fonte/ID/destinatário; não trocar por efeitos de UI. Admin não lê caixas alheias. /avisos usa UID esperado e chave UID/papel; leitura explícita, paginação estável e refresh/retry sem apagar dados em erro. OrderOccurrences aceita initialReportId. Pacote internal-notifications; notificações externas continuam separadas/desligadas no QA.
