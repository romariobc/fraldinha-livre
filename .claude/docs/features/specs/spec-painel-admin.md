# Spec — Painel administrativo da plataforma (read-only, admin único)

**Domínio:** admin | **Feature relacionada:** 012 (Painel administrativo da plataforma) | **Status:** rascunho

## Contexto

A feature 012 do backlog (`feature_list.json`) previa um painel onde o admin
"consegue ver todos os usuários, pedidos e ofertas; pode intervir em disputas",
com escopo marcado como "a definir". Brainstorming em 2026-08-01/02 fechou o
escopo real:

- **"Intervir em disputas" fica fora desta fatia.** Não existe sistema de disputas
  hoje — o único lugar onde isso faria sentido é o leilão reverso, que está
  desativado por flag (`LEILAO_ATIVO=false`, feature 013). Fica pendente pra
  quando o leilão for reativado.
- **"Ofertas" = produtos do catálogo**, não lances de leilão (que não existem
  ainda).
- **Admin é um único usuário fixo** (Romario), não um papel novo no sistema.
  Não há fluxo de convite/promoção de outros admins nesta fatia.
- **Read-only.** Nenhuma ação de gestão (desativar produto, bloquear usuário,
  etc.) faz parte desta fatia — só visualização.

Hoje não existe conceito de "admin" em lugar nenhum do sistema: `UserRole` é
`'comprador' | 'fornecedor'` (`front/src/contexts/auth-context.tsx`), e o
middleware de auth do backend (`back/src/middleware/auth.ts`) só verifica o
token, sem checar papel algum.

**UID fixo do admin:** `KOQclmb5eshfkufioK03ayRh6Fi2` (conta
`romariobc@gmail.com`, confirmado via Firebase Auth). Esse valor é usado
literalmente nas três pontas abaixo — não é segredo (é só um identificador),
por isso pode ficar em `NEXT_PUBLIC_*`/committed, mesmo padrão já usado pra
config do Firebase.

## Arquitetura e fluxo de dados

Três fontes de dados, cada uma reaproveitando um mecanismo já existente no
projeto, cada uma abrindo uma exceção só para o UID admin:

1. **Usuários** — vivem só no Firestore (`users/{uid}`), nunca no D1. O painel
   lê a coleção direto via client SDK (mesmo padrão de
   `auth-context.tsx`), liberado por uma regra nova em `firestore.rules` que
   permite `list`/`read` de toda a coleção `users` só para
   `request.auth.uid == 'KOQclmb5eshfkufioK03ayRh6Fi2'`.
2. **Pedidos** — `GET /orders?scope=admin` (novo) em
   `back/src/routes/orders.ts`. Handler existente ganha um branch que, quando
   `scope === 'admin'`, ignora o filtro por uid do pedido e retorna todos os
   pedidos — mas só se `uid === c.env.ADMIN_UID` (senão `403`).
3. **Produtos** — `GET /products?scope=admin` (novo) em
   `back/src/routes/products.ts`, mesma lógica: todos os produtos (ativos e
   inativos), gated por `uid === c.env.ADMIN_UID`.

Optamos por essa abordagem (Firestore direto + `scope=admin` no backend
existente) em vez de centralizar tudo atrás de um endpoint novo com
credencial de service account do Firebase Admin — menos infraestrutura nova,
reaproveita 100% dos padrões já validados no projeto. Se um dia houver mais de
um admin, essa decisão é revisitada.

## Regras de negócio

- **RN-01 — Gate client-side é só UX, não segurança.** `front/src/app/admin/page.tsx`
  redireciona pra `/` se `user?.uid !== ADMIN_UID` (usando
  `NEXT_PUBLIC_ADMIN_UID`). A segurança real está no backend (`403` se
  `uid !== ADMIN_UID`) e na regra do Firestore — mesmo um front adulterado
  não consegue ver dado real de quem não for o UID fixo.
- **RN-02 — Gate espera `authLoading` resolver.** Mesma classe de bug corrigida
  em D-037 (`MarketProvider`): o redirect só pode disparar depois que
  `authLoading === false`, senão um admin de verdade é chutado pra fora numa
  corrida contra o Firebase restaurando a sessão.
- **RN-03 — Autorização do backend por `scope=admin` é independente por rota.**
  Cada handler (`orders`, `products`) checa `uid === c.env.ADMIN_UID`
  isoladamente — não existe middleware de "papel admin" compartilhado nesta
  fatia (YAGNI: só 2 rotas usam isso agora).
- **RN-04 — Sem paginação nem filtro.** Aceitável na escala atual (beta);
  vira fatia própria se o volume justificar.
- **RN-05 — Nenhuma ação de escrita.** Todas as 3 abas (Usuários, Pedidos,
  Produtos) são somente leitura. Ações de gestão (desativar produto, cancelar
  pedido como admin, bloquear usuário) ficam fora desta fatia.

## Componentes

- `front/src/app/admin/page.tsx` — rota fora do route group `(main)` (sem
  header de comprador/fornecedor, sem `MarketProvider`). 3 abas: Usuários,
  Pedidos, Produtos.
- `front/src/components/admin/` — novo diretório com um componente de tabela
  por aba + hook/lib de busca de cada fonte.
- `back/src/routes/orders.ts` / `products.ts` — branch `scope === 'admin'`
  nos handlers GET existentes.
- `back/wrangler.jsonc` — var `ADMIN_UID`.
- `front/.env.production` — var `NEXT_PUBLIC_ADMIN_UID` (mesmo valor).
- `firestore.rules` — regra nova liberando leitura de toda `users` pro UID
  admin.

## Erros e casos de borda

- UID não bate em qualquer uma das 3 fontes → front redireciona antes de
  renderizar; backend responde `403` (não `404` — mesmo padrão de dono errado
  já usado em `products.ts`/`orders.ts`).
- Usuário deslogado em `/admin` → mesmo tratamento do gate de auth (RN-02).
- Falha na regra do Firestore (typo no UID, etc.) → query falha com
  `permission-denied`; aba Usuários mostra estado de erro, não tela em branco
  silenciosa.

## Testes

- Backend: `scope=admin` em `orders.test.ts`/`products.test.ts` — UID admin
  (retorna tudo), UID não-admin (403), sem token (401 via middleware
  existente).
- Frontend: gate de acesso em `/admin` (não-admin redireciona, admin
  renderiza, loading não dispara redirect precoce) + smoke test de cada
  tabela com dados mockados.
- Firestore rules: validação manual via emulador antes do deploy (sem
  introduzir harness de teste de regras novo só para esta fatia).

## Fora de escopo (fica para fatias futuras)

- Intervenção em disputas (depende do leilão reverso ser reativado).
- Ações de gestão (desativar produto, bloquear usuário, cancelar pedido como
  admin).
- Múltiplos admins / papel `admin` de verdade no sistema.
- Paginação e filtros.
