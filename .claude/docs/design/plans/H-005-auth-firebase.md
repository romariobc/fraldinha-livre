# H-005 — Autenticacao Firebase (login Google), fatia identidade (feature 005a)

**Executor:** sessao Haiku | **Autor:** sessao-mae (2026-07-02) | **Status:** PRONTO — disparar apos o cliente confirmar os pre-requisitos Firebase
**Spec:** `.claude/docs/design/specs/spec-auth-firebase.md` — LEIA A SPEC INTEIRA ANTES DE COMECAR. Em conflito entre prompt e spec, a spec vence; pare e relate.

## Objetivo

Login Google via **Firebase Authentication**, `useAuth()` como unica fonte de sessao (removendo o
`IS_LOGGED_IN` mock e a duplicata do Header), rotas privadas protegidas (guarda client-side) e papel
do usuario **persistido no Firestore** (`users/{uid}`). Ver D-010 (revisada) e D-011 em
`.claude/docs/decisoes.md`.

## Contexto minimo

- App Next.js 16 App Router + React 19 + TypeScript em `front/` (comandos dentro de `front/`).
- Firebase JS SDK v10+ (client, `'use client'`). Config web em `front/.env.local` (`NEXT_PUBLIC_FIREBASE_*`) — nao criar, nao versionar, nao imprimir valores.
- AGENTS.md: leia `node_modules/next/dist/docs/` antes de codar Next e invoque os skills de dominio (`risk-zone-protocol` para `src/lib/` e layout; `ui-system` para UI).
- Pre-requisitos: H-002 aplicado (gating, nao regredir). Firebase provisionado pelo cliente (Tarefa 0 confirma).

## Tarefa 0 — Verificacao previa OBRIGATORIA (antes de qualquer codigo)

Confirmar os 5 pre-requisitos da spec (env vars `NEXT_PUBLIC_FIREBASE_*` presentes no `.env.local`;
Firestore acessivel). Se faltar qualquer um, **PARE e liste** o que o humano precisa fazer no
console Firebase — nao crie projeto/chaves nem improvise. So prossiga se tudo estiver presente.

## Tarefas (nesta ordem, apos Tarefa 0 ok)

1. Instalar `firebase` (SDK v10+). Criar `front/src/lib/firebase.ts` inicializando app, `auth` e `db` (Firestore) a partir das `NEXT_PUBLIC_FIREBASE_*`, com `googleProvider`.
2. Criar `front/src/contexts/auth-context.tsx`: `AuthProvider` + `useAuth()` via `onAuthStateChanged`; expoe `user`, `role`, `loading`, `signInGoogle`, `signOutUser`. Carregar `role` de Firestore `users/{uid}` quando logar. Registrar o provider no `front/src/app/layout.tsx`.
3. `Header.tsx`: remover a const `IS_LOGGED_IN` (linha ~21); usar `useAuth()`; `handleCartClick` decide por `user != null`; adicionar logout quando logado.
4. `catalogo/page.tsx` + `ProductCard.tsx`: `isLoggedIn` passa a vir de `useAuth()`.
5. Deletar `front/src/lib/auth-mock.ts` apos grep confirmar 0 imports.
6. `login/page.tsx`: "Entrar com Google" chama `signInGoogle()` preservando `?redirect`; form e-mail/senha visivel e inativo (nao submeter).
7. Proteger `/minha-conta` e `/fornecedor/**` com guarda client-side (`useAuth()`): deslogado → redirect `/login?redirect=<rota>`. Comentario marcando que o endurecimento SSR (session cookie/Admin SDK) fica para o deploy/006 (D-010).
8. Onboarding `front/src/app/onboarding/page.tsx`: sem `role`, pergunta comprador/fornecedor e grava em Firestore `users/{uid}` (`{ role, name, email }`); roteia comprador→/minha-conta, fornecedor→/fornecedor/painel. Relogar NAO deve repetir o onboarding (le do Firestore).
9. Saudacao dos heros de `/minha-conta` e `/fornecedor/painel` usa `displayName`/`email` do usuario Firebase.
10. Commit unico (pt-BR): `feat(auth): login Google via Firebase e papel persistido no Firestore (feature 005a)`

**Arquivos autorizados:** os listados + `package.json`/lockfile + imports afetados pela remocao do IS_LOGGED_IN (liste todos no relatorio). Nada alem.

## Testes e verificacao (OBRIGATORIO — D-008)

Dentro de `front/`:
1. `npm run lint` — zero erros novos (o erro preexistente de MarketTable.tsx:34 esta fora de escopo; nao corrigir, so nao introduzir novos).
2. `npm run build` — sem erros.
3. Grep: nenhuma referencia restante a `IS_LOGGED_IN` nem import de `auth-mock`.
4. Teste manual (`npm run dev`): "Entrar com Google" faz login real; primeiro login sem papel → onboarding → escolha grava no Firestore e roteia; logout; relogar mantem papel (sem onboarding de novo); deslogado, `/minha-conta` redireciona para `/login?redirect=/minha-conta`; `/mercado` segue "Em breve" (gating intacto); form e-mail/senha inerte.
5. `.env.local` fora do controle de versao (`git status` nao lista).

**Loop de encerramento:** falhou → corrigir e re-verificar, MAXIMO 3 TENTATIVAS. Apos a 3a falha:
PARE, nao improvise, relate falha/tentativas/estado. Se a Tarefa 0 falhar, pare imediatamente (nao
conta como tentativa de codigo).

## Criterios de aceite

Checklist "Criterios de aceite" da spec — todos devem passar.

## Restricoes

- Sem decisoes de arquitetura alem da spec; duvida = parar e relatar.
- Nao versionar `.env.local`; nao imprimir segredos.
- Nao regredir o gating (013). Nao tocar em `legacy/`, `back/`, `app/`, docs de governanca.
- Commits em pt-BR, Conventional Commits, sem `--no-verify`.

## Relatorio esperado

Resultado da Tarefa 0; arquivos alterados/criados/deletados; resultado de cada verificacao com
evidencia; hash do commit; onde ficou a persistencia de papel e o comentario do guarda client-side;
pendencias.
