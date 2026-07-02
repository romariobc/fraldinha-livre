# Spec — Autenticacao Google (NextAuth v5), fatia identidade

**Dominio:** auth | **Feature relacionada:** 005a | **Status:** rascunho (aguardando aprovacao do cliente)

## Contexto

D-011 (sequencia hibrida) promove o auth para logo apos o gating do leilao. As credenciais Google +
NextAuth ja estao em `front/.env.local` (D-010). Esta fatia entrega **IDENTIDADE real** (login
Google) SEM depender do backend 006. Autorizacao (papel) e persistencia ficam para o 006 — aqui a
escolha de papel e um **fluxo real com armazenamento stub** (costura temporaria, documentada como
divida tecnica). Corrige na raiz o bug do review: `IS_LOGGED_IN` duplicado e hardcoded no Header.

## Regras de negocio

- **RN-01** NextAuth v5 (Auth.js) com **provider Google APENAS**. Route handler em
  `front/src/app/api/auth/[...nextauth]/route.ts`. Le as chaves ja presentes em `front/.env.local`
  (GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, NEXTAUTH_SECRET/AUTH_SECRET, NEXTAUTH_URL/AUTH_URL).
  `.env.local` NAO pode ser versionado (confirmar no .gitignore).
- **RN-02** `SessionProvider` (client) embrulha a arvore da aplicacao. `useSession()` e a **UNICA
  fonte** de "esta logado" em todo o front.
- **RN-03** Remover `IS_LOGGED_IN` de `front/src/lib/auth-mock.ts` E a constante duplicada
  hardcoded em `Header.tsx:21`. Substituir TODOS os usos por `useSession()`
  (`status === 'authenticated'`). Consumidores conhecidos: `Header.tsx` (handleCartClick),
  `catalogo/page.tsx` (passa `isLoggedIn` ao ProductCard), `ProductCard.tsx`. Deletar
  `auth-mock.ts` quando nenhum import restar.
- **RN-04** O botao "Entrar com Google" (`login/page.tsx:131`) fica funcional:
  `signIn('google', { callbackUrl: <redirect> })`, preservando o param `?redirect`. O form de
  e-mail/senha permanece **visivel porem inativo** (fatia 005b) — nao submete nada.
- **RN-05** Rotas protegidas: `/minha-conta` e `/fornecedor/**` exigem sessao; sem login →
  redirect `/login?redirect=<rota>`. Preferir middleware `auth` do NextAuth v5; se incompativel com
  Next 16, guarda no layout.
- **RN-06** Papel do usuario (**costura temporaria — DOCUMENTAR como divida tecnica ate 006**):
  apos o primeiro login sem papel, o fluxo de onboarding `/onboarding` pergunta "comprador ou
  fornecedor?"; a escolha e gravada na SESSAO (callback jwt/session ou `update()`), **nao em banco**
  — reseta quando o 006 chegar. O FLUXO e real (sera reaproveitado no produto); o ARMAZENAMENTO e
  stub. Comentario explicito no codigo + registro em decisoes. O papel roteia:
  comprador → `/minha-conta`, fornecedor → `/fornecedor/painel`.
- **RN-07** Logout disponivel (`signOut`) no Header quando logado.
- **RN-08** A saudacao do hero em `/minha-conta` e `/fornecedor/painel` usa nome/e-mail da sessao
  quando houver (substitui `MOCK_USER.name/email` SO na saudacao; pedidos, endereco e perfil seguem
  mock ate o 006).

## Verificacao previa obrigatoria (antes de escrever codigo)

Compatibilidade NextAuth v5 (Auth.js) com **Next 16 + React 19**: confirmar o pacote/versao correto
(`next-auth@beta` vs `@auth/*`) e o nome das env vars (v5 prefere `AUTH_SECRET`/`AUTH_URL` — mapear
se preciso). Se NAO houver versao estavel compativel, **PARAR e relatar** antes de codar — nao
fazer downgrade do Next nem improvisar.

## Criterios de aceite

- [ ] Login com Google real funciona (redirect Google → volta autenticado); logout funciona
- [ ] `useSession()` e a unica fonte; `IS_LOGGED_IN` removido de auth-mock.ts e do Header; auth-mock.ts deletado
- [ ] `/minha-conta` e `/fornecedor/**` redirecionam para `/login?redirect=` quando deslogado
- [ ] Onboarding de papel funciona e roteia; comentario no codigo + nota em decisoes marcando-o como stub ate 006
- [ ] Form e-mail/senha visivel e inativo (nao regride, nao submete)
- [ ] `npm run lint` e `npm run build` passam; `.env.local` NAO versionado
- [ ] Gating do leilao (013) nao regride

## Fora de escopo

- Login por e-mail/senha (005b — precisa do backend 006)
- Persistencia real de papel/perfil/pedidos (006)
- Papel ADMIN (012)

## Referencias

- Decisoes: D-001, D-007, D-010, D-011 (`.claude/docs/decisoes.md`)
- `.claude/docs/backend/integration-guide.md` secoes 3 e 10 (padrao NextAuth — adaptar de
  credentials v5 para google v5)
- Bug do review 2026-07-02: `Header.tsx:21` IS_LOGGED_IN duplicado
