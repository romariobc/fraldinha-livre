# B3 — back/: middleware de auth (Firebase ID Token) + GET /orders

**Executor:** sessão Haiku | **Autor:** sessão-mãe/backend (2026-07-19) | **Status:** aguardando execução
**Spec:** `.claude/docs/design/specs/spec-backend-pedidos-cloudflare.md` (RN-01, RN-02, RN-07)
**Plano:** `.claude/docs/design/plans/B-backend-pedidos-breakdown.md` (tarefa B3, dep: B2 — APROVADO,
commits `b6aa44b`+`44aa81a`+`aa5d4e1`, scaffold do Worker + D1 real já existem).

## Objetivo

Adicionar autenticação por Firebase ID Token ao Worker e implementar `GET /orders`, que retorna
**somente** os pedidos do usuário do token (nunca de outro usuário — RN-02).

## Contexto mínimo

- Worktree: `E:\Labdev\Projetos\fraldinha-livre\.claude\worktrees\blissful-lamport-ccb562`.
- **Firebase project ID real: `fraldinha-livre`** (de `.firebaserc` na raiz do repo — use esse valor
  exato, não invente nem deixe placeholder).
- `packages/contracts` (B1) já tem `OrderSchema`/`OrderItemSchema`/`AddressSchema` — **importe por
  caminho relativo**, não crie alias novo: de `back/src/routes/orders.ts` ou
  `back/src/middleware/auth.ts` o caminho é `../../../packages/contracts/src` (3 níveis: `src` →
  `back` → raiz do repo → `packages/contracts/src`). Não tente configurar path alias no bundler do
  Wrangler — não é trivial e não é necessário, import relativo resolve sem configuração extra.
- `back/src/schema/orders.ts` (B2) já tem as tabelas Drizzle `orders`/`order_items`.
- D-026/D-027 decididos — não redecidir arquitetura.
- Dinheiro em centavos (já garantido pelo schema D1 existente).

### Lições da B2 — aplicar aqui também
- **Antes de escrever código contra uma lib do Cloudflare/Firebase, verifique a API real** instalada
  (leia `node_modules/<pkg>/` — `.d.ts`, README) em vez de confiar de cor na assinatura. As libs desse
  ecossistema mudam rápido; já aconteceu de uma suposição de API estar desatualizada.
- **Nunca esconda uma falha atrás de um `try/catch` com fallback silencioso.** Se algo não funcionar
  como esperado, isso é motivo de PARAR e relatar (dentro do limite de 3 tentativas), não de
  contornar com um workaround não documentado.

## Tarefas (nesta ordem)

### 1. `back/src/middleware/auth.ts` — middleware de auth testável por injeção
Criar um middleware que:
- Lê o header `Authorization: Bearer <token>`. Sem header ou sem prefixo `Bearer ` → 401
  (`{ error: 'unauthorized' }`), RN-07.
- Verifica a assinatura do JWT contra o Firebase (`fraldinha-livre`) e extrai o `uid` (claim `sub` ou
  `user_id`, conforme o token real do Firebase Auth). Token ausente/inválido/expirado → 401.
- Se válido, chama `c.set('uid', uid)` e segue (`next()`).

**Design para ser testável sem chamar o Google:** exporte uma factory
`createAuthMiddleware(verifyToken: (token: string) => Promise<{ uid: string } | null>)` que retorna o
middleware Hono. A verificação REAL (produção) fica numa função separada e exportada,
`verifyFirebaseIdToken(token: string, projectId: string): Promise<{ uid: string } | null>`, usada em
`index.ts` como `createAuthMiddleware((token) => verifyFirebaseIdToken(token, c.env.FIREBASE_PROJECT_ID))`.
Isso permite que os testes chamem `createAuthMiddleware(fakeVerify)` com uma função fake, sem tocar a
implementação real nem a rede.

Para `verifyFirebaseIdToken`: **antes de escrever**, cheque se `firebase-auth-cloudflare-workers` está
disponível/instalável e qual API real ela expõe (leia o `.d.ts` depois de instalar, não assuma). Se ela
não servir ou a API divergir do esperado, use `jose` diretamente contra o JWKS público do Firebase
(`https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com`), validando
`iss` (`https://securetoken.google.com/fraldinha-livre`) e `aud` (`fraldinha-livre`). Qualquer uma das
duas abordagens é aceitável — o que importa é o comportamento (rejeita token inválido/expirado/forjado,
extrai `uid` de um token real do Firebase).

### 2. `back/src/routes/orders.ts` — handler de `GET /orders`
- Handler Hono que lê `c.get('uid')` (posto pelo middleware — a rota **não** verifica o token de novo).
- Usa Drizzle (`drizzle(c.env.DB)`) para buscar em `orders` só as linhas `WHERE uid = <uid do contexto>`
  (RN-02 — nunca do body/query string).
- Para cada order, busca os `order_items` correspondentes (`WHERE order_id = order.id`).
- Mapeia cada linha D1 para o formato de `OrderSchema` (de `@contracts`, import relativo — ver acima):
  `deliveryAddress` vem como JSON string no D1 (`delivery_address` coluna), precisa `JSON.parse` antes
  de validar; `price`/`supplierId`/`supplierName` são `null` no D1 quando ausentes — converter pra
  `undefined` (o schema Zod usa `.optional()`, não aceita `null`).
- **Valide o resultado com `OrderSchema.parse(...)` antes de responder** — isso prova que o mapeamento
  D1→contrato está correto (se não bater, o teste vai falhar de forma clara, não silenciosa).
- Retorna `200` com o array de orders (`Order[]`, mesmo se vazio).

### 3. Modificar `back/src/index.ts`
- Importar o middleware e a rota.
- Montar: `app.use('/orders/*', authMiddlewareReal)` seguido de `app.get('/orders', ordersGetHandler)`
  (ou equivalente — a rota `/orders` deve estar protegida pelo middleware).
- Manter a rota `/health` como está (sem auth).

### 4. Modificar `back/wrangler.jsonc`
Adicionar em `vars` (variável pública, não secreta — é só o project ID):
```jsonc
"vars": {
  "FIREBASE_PROJECT_ID": "fraldinha-livre"
}
```

### 5. Tipos — `back/src/env.d.ts`
Adicionar `FIREBASE_PROJECT_ID: string` à interface `Cloudflare.Env` existente.

### 6. Testes — `back/test/orders.get.test.ts`
**Não** importe o `app` de `index.ts` para este teste (ele usaria o verificador real). Em vez disso,
monte um Hono app de teste local no próprio arquivo de teste:
```ts
const testApp = new Hono<{ Bindings: Env }>()
testApp.use('*', createAuthMiddleware(fakeVerify))
testApp.get('/orders', ordersGetHandler)
```
onde `fakeVerify` é uma função de teste que reconhece 1-2 tokens fake (ex.: `'token-uid-a'` →
`{ uid: 'uid-a' }`, `'token-uid-b'` → `{ uid: 'uid-b' }`, qualquer outra string → `null`).

Casos a cobrir (aplicar a migration real no D1 de teste via o mesmo padrão do B2 —
`readD1Migrations`/`applyD1Migrations`, já configurado em `vitest.config.ts`; se precisar inserir dados
de teste, use `env.DB.prepare(...).run()` ou Drizzle diretamente, não SQL solto duplicado):

1. `GET /orders` sem header `Authorization` → **401**.
2. `GET /orders` com `Authorization: Bearer token-invalido` (não reconhecido pelo `fakeVerify`) →
   **401**.
3. Seed no D1 de teste: 2 orders com `uid = 'uid-a'` (cada uma com >=1 item em `order_items`) e 1 order
   com `uid = 'uid-b'`. `GET /orders` com `Authorization: Bearer token-uid-a` → **200**, array com
   **exatamente 2** orders, ambas com `uid === 'uid-a'`, cada uma com `items` não-vazio e validando
   contra `OrderSchema` (prova RN-02: isolamento por uid).
4. Mesma seed, `Authorization: Bearer token-uid-b` → **200**, array com **exatamente 1** order.

## Testes e verificação (D-008)

Dentro de `back/`, nesta ordem:
1. `npm install` (se precisar de dependência nova, ex. `jose` ou `firebase-auth-cloudflare-workers`).
2. `npm test` — todos os testes (os 4 do `health.test.ts` existentes + os 4 novos de
   `orders.get.test.ts`) verdes.
3. `npx tsc --noEmit` — sem erro de tipo.

**Loop:** máximo 3 tentativas para problemas de código. Se a lib de verificação de JWT escolhida não
funcionar como esperado, tentar a alternativa (`jose` vs `firebase-auth-cloudflare-workers`) conta como
parte das 3 tentativas, não como tentativa extra. Se travar de verdade, PARE e relate o obstáculo exato
— não implemente uma verificação de assinatura "fake"/incompleta só pra fazer o teste passar.

## Critérios de aceite

- [ ] `back/src/middleware/auth.ts`: `createAuthMiddleware` (testável por injeção) +
      `verifyFirebaseIdToken` (real, contra `fraldinha-livre`).
- [ ] `back/src/routes/orders.ts`: `GET /orders` filtra por `uid` do contexto (nunca de outra fonte),
      mapeia D1→`OrderSchema` com `.parse()` antes de responder.
- [ ] `back/src/index.ts` monta o middleware nas rotas `/orders/*`; `/health` continua sem auth.
- [ ] `back/wrangler.jsonc` tem `vars.FIREBASE_PROJECT_ID = "fraldinha-livre"`.
- [ ] `back/src/env.d.ts` tipa `FIREBASE_PROJECT_ID`.
- [ ] `back/test/orders.get.test.ts`: os 4 casos do passo 6, todos verdes, usando `createAuthMiddleware`
      com verificador fake (nenhuma chamada real ao Google/Firebase nos testes).
- [ ] `npm test` completo (health + orders.get) verde. `tsc --noEmit` exit 0.
- [ ] Nenhum SQL duplicado à mão fora do padrão já estabelecido (`readD1Migrations`/`applyD1Migrations`).
- [ ] Nenhum arquivo fora de `back/` modificado (não tocar em `front/`, `packages/contracts/`, nem no
      `back/` do repo principal fora deste worktree).

## Restrições

- **Não** implemente `POST /orders` nem `PATCH /orders/:id/cancel` — isso é B4.
- **Não** use o Firebase Admin SDK (não roda no runtime do Workers) — só `jose`/JWKS ou
  `firebase-auth-cloudflare-workers`.
- **Não** aceite `uid` vindo de query string, header custom ou body — só do token verificado (RN-01/02).
- **Não** use `any`.
- **Não** esconda falhas em `try/catch` silencioso (lição da B2).
- Commit em português, Conventional Commits, mensagem:
  `feat(back): auth por Firebase ID Token + GET /orders isolado por uid (thread B)`

## Relatório esperado

- Lista de arquivos criados/modificados.
- Qual biblioteca de verificação JWT foi usada e por quê (se teve que trocar de uma pra outra, explicar).
- Saída literal de `npm test` e `npx tsc --noEmit`.
- Confirmação de que os 4 casos de teste do passo 6 cobrem exatamente o que foi pedido (colar os nomes
  dos `it(...)`).
- Hash do commit (`git log -1 --oneline`).
- Qualquer bloqueio ou decisão de detalhe tomada.
