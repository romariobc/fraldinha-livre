# Spec — Autenticacao Firebase (login Google), fatia identidade

**Dominio:** auth | **Feature relacionada:** 005a | **Status:** APROVADA; pre-requisitos Firebase PROVISIONADOS (2026-07-02) — pronta para o H-005

> **Provisionamento (2026-07-02, conta romariobc@gmail.com, projeto `fraldinha-livre`):** app web
> registrado; config em `front/.env.local` (`NEXT_PUBLIC_FIREBASE_*`); Firestore `(default)` em
> `southamerica-east1` com regra `users/{uid}` ativa; Google Sign-In configurado via `firebase init`
> (brand "Fraldinha Livre", support romariobc@gmail.com). `localhost` autorizado por padrao. Config
> de infra versionada (firebase.json, .firebaserc, firestore.rules) no commit 4bd4dba. Falta apenas
> o cliente confirmar no console que o provedor Google esta com o toggle "Ativado".

## Contexto

D-010 (revisada) define **Firebase Authentication com provider Google**. D-011 promove o auth para
logo apos o gating. Esta fatia entrega **identidade real** (login Google via Firebase) e **papel
persistido no Firestore** (nao mais stub), sem depender do backend 006. Corrige na raiz o bug do
review: `IS_LOGGED_IN` duplicado e hardcoded no Header.

## Pre-requisitos do cliente (fora do alcance do Haiku — o console e manual)

O prompt so pode ser executado depois que o cliente prover:
1. Projeto Firebase criado.
2. **Google sign-in habilitado** em Firebase Authentication (console).
3. Config web do app em `front/.env.local` como `NEXT_PUBLIC_FIREBASE_API_KEY`,
   `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`, `NEXT_PUBLIC_FIREBASE_PROJECT_ID`,
   `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`, `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`,
   `NEXT_PUBLIC_FIREBASE_APP_ID`.
4. **Firestore** habilitado (modo Native) + regra: usuario autenticado le/escreve so `users/{uid}`.
5. Dominios autorizados no Firebase Auth incluindo `localhost`.

Se qualquer item faltar, o Haiku PARA na Tarefa 0 e lista o que falta — nao improvisa.

## Regras de negocio

- **RN-01** Inicializacao do Firebase SDK (v10+) em `front/src/lib/firebase.ts`, lendo as
  `NEXT_PUBLIC_FIREBASE_*`. Nao versionar `.env.local`.
- **RN-02** `AuthProvider` + hook `useAuth()` (client) baseado em `onAuthStateChanged`, embrulhando
  a arvore. `useAuth()` e a **UNICA fonte** de "esta logado" (expoe `user`, `role`, `loading`).
- **RN-03** Remover `IS_LOGGED_IN` de `front/src/lib/auth-mock.ts` E a duplicata hardcoded em
  `Header.tsx:21`. Migrar consumidores (`Header.tsx`, `catalogo/page.tsx`, `ProductCard.tsx`) para
  `useAuth()`. Deletar `auth-mock.ts` quando nenhum import restar.
- **RN-04** Botao "Entrar com Google" (`login/page.tsx:131`) chama
  `signInWithPopup(auth, googleProvider)` (ou redirect), preservando o param `?redirect`. O form de
  e-mail/senha permanece **visivel porem inativo** (fatia 005b) — nao submete.
- **RN-05** Rotas protegidas `/minha-conta` e `/fornecedor/**`: **guarda client-side** via
  `useAuth()` — deslogado → redirect `/login?redirect=<rota>`. **Decisao de arquitetura (D-010):**
  Fase 1 usa guarda client-side (dados mock, sem risco); endurecimento SSR (session cookie via
  Admin SDK) fica para o deploy/006 — deixar comentario no codigo marcando isso.
- **RN-06** Papel do usuario **PERSISTIDO em Firestore** (`users/{uid}` com `{ role, name, email }`).
  No login: ler o doc; se sem `role` → onboarding `/onboarding` (comprador/fornecedor) grava no
  Firestore; senao roteia (comprador → `/minha-conta`, fornecedor → `/fornecedor/painel`).
  Persistencia REAL — nao stub.
- **RN-07** Logout (`signOut`) disponivel no Header quando logado.
- **RN-08** Saudacao do hero em `/minha-conta` e `/fornecedor/painel` usa `displayName`/`email` do
  usuario Firebase (pedidos/endereco seguem mock ate 006).

## Tarefa 0 obrigatoria (antes de codar)

Confirmar os 5 pre-requisitos do cliente acima (env vars presentes, Firestore acessivel). Se faltar
qualquer um, PARAR e listar exatamente o que o humano precisa fazer no console. Nao criar projeto
nem chaves.

## Criterios de aceite

- [ ] Login com Google via Firebase funciona (popup/redirect → volta autenticado); logout funciona
- [ ] `useAuth()` e a unica fonte; `IS_LOGGED_IN` removido; `auth-mock.ts` deletado
- [ ] `/minha-conta` e `/fornecedor/**` redirecionam deslogado para `/login?redirect=` (guarda client-side)
- [ ] Papel persiste em Firestore (`users/{uid}`); relogar mantem o papel sem repetir onboarding
- [ ] Form e-mail/senha visivel e inativo (nao regride)
- [ ] Gating do leilao (013) nao regride; `.env.local` NAO versionado; `npm run lint`/`build` passam

## Fora de escopo

- Login por e-mail/senha (005b — Firebase email/password, fatia separada)
- Endurecimento SSR com session cookie / Admin SDK (deploy/006)
- Migracao de pedidos/perfil para backend real (006)

## Referencias

- Decisoes: D-001, D-007, D-010 (revisada), D-011
- Bug do review 2026-07-02: `Header.tsx:21` IS_LOGGED_IN duplicado
- Firebase Auth + Next.js App Router (SDK client v10+)
