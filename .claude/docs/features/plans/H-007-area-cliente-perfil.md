# H-007 — Area do cliente real: perfil no Firestore + travas de seguranca (feature 007a)

**Executor:** sessao Haiku | **Autor:** sessao-mae (2026-07-03) | **Status:** PRONTO para disparo
**Spec:** `.claude/docs/design/specs/spec-area-cliente-perfil.md` (APROVADA 2026-07-03) — LEIA A SPEC INTEIRA. Em conflito prompt vs spec, a spec vence; pare e relate.

## Objetivo

Tornar o perfil do comprador REAL e persistido no Firestore (fim do MOCK_USER no fluxo do
comprador), com trava de compra ate o perfil estar completo, e aplicar as 2 correcoes de seguranca
do D-013 (role imutavel; safeRedirect). Sacola do Header com contador de pedidos ativos.

## Contexto minimo

- Next.js 16 + React 19 + TS em `front/` (comandos no front do WORKTREE:
  `E:\Labdev\Projetos\fraldinha-livre\.claude\worktrees\eloquent-montalcini-2dff41\front`).
- Auth Firebase (005a) funcionando: `useAuth()` de `@/contexts/auth-context` ja carrega `user` e `role`
  de `users/{uid}`. Firestore provisionado (projeto fraldinha-livre). `.env.local` ja no worktree.
- AGENTS.md: leia `node_modules/next/dist/docs/`; invoque risk-zone-protocol (src/lib/, layout,
  contexts) e ui-system (UI); domain-comprador para minha-conta.
- NAO regredir gating (013) nem login/onboarding (005a).

## Tarefas

1. **lib/utils.ts** — adicionar 3 utils puros:
   - `safeRedirect(param: string | null): string` — retorna `param` so se comecar com `/` e NAO com `//` e nao contiver `:`; senao `/minha-conta`. (D-013 Vuln 2)
   - `isValidCPF(cpf: string): boolean` — remove nao-digitos; false se != 11 digitos ou sequencia repetida (ex.: 11111111111); valida os 2 digitos verificadores pelo algoritmo padrao.
   - `isProfileComplete(profile): boolean` — true se `cpf` valido, `phone` preenchido e `address` com logradouro/numero/bairro/cidade/estado/cep preenchidos (trim != '').
   Mascaras (CPF/CEP/telefone) podem ser helpers locais do PerfilTab.

2. **contexts/auth-context.tsx** — estender:
   - Tipo do profile: `{ role, name, email, cpf?, phone?, address?: {...}, createdAt?, updatedAt? }`.
   - No `onAuthStateChanged`, apos carregar o doc, guardar o `profile` completo (nao so `role`).
   - Expor `profile` e `updateProfile(patch)` no contexto. `updateProfile` faz merge no Firestore
     `users/{uid}` gravando SOMENTE campos de perfil (`name`, `cpf`, `phone`, `address`, `updatedAt`)
     — **NUNCA `role`** (D-013 Vuln 1). Atualizar o estado local do profile apos gravar.

3. **login/page.tsx** — trocar o uso cru de `searchParams.get('redirect')` pelo `safeRedirect(...)`
   no roteamento pos-login (comprador). (D-013 Vuln 2)

4. **PerfilTab** (`components/minha-conta/PerfilTab.tsx`) — reescrever para consumir `profile` do
   `useAuth()` (nao mais prop `MOCK_USER`): visualizacao + "Editar perfil" com formulario (nome, CPF
   com mascara+validacao dígito verificador, telefone, endereco). Salvar chama `updateProfile`;
   bloqueia se `!isValidCPF`. Estado "Complete seu perfil" quando vazio. E-mail readonly. `minha-conta/page.tsx`
   para de passar `MOCK_USER` ao PerfilTab.

5. **minha-conta/page.tsx** — ler `searchParams` (`tab`, `returnTo`): se `tab=perfil`, abrir a aba
   Perfil; se `returnTo` presente, exibir banner "Complete seu perfil (endereço, CPF e telefone) para
   finalizar a compra" e abrir o formulario em edicao. Ao salvar com `isProfileComplete` true e
   `returnTo` presente → `router.push(safeRedirect(returnTo))`. Envolver em `Suspense` por causa do
   `useSearchParams` (como no login).

6. **catalogo/page.tsx** `handleBuy` — se logado e `!isProfileComplete(profile)` →
   `router.push('/minha-conta?tab=perfil&returnTo=/catalogo')`; senao abre o BuyModal.

7. **BuyModal** — o default de "endereço do cadastro" passa a ser `profile.address` (nao
   `MOCK_USER.address`). Manter a opcao "outro endereço" e sua validacao.

8. **Header** — badge com contador de pedidos ativos (status != 'entregue' e != 'cancelado') lido de
   `useOrders()`; sem itens, sem badge. Deslogado, comportamento atual.

9. **firestore.rules** — aplicar a regra endurecida da spec (RN-04: read/create do dono; update so
   se `role` inalterado; `delete: if false`). **NAO rode `firebase deploy`** — a sessao-mae faz o
   deploy apos revisar. Apenas edite o arquivo versionado.

10. Commit unico (pt-BR): `feat(comprador): perfil real no Firestore, trava de compra e travas de seguranca (feature 007a)`

**Arquivos autorizados:** lib/utils.ts, contexts/auth-context.tsx, app/login/page.tsx,
components/minha-conta/PerfilTab.tsx, app/(main)/minha-conta/page.tsx, app/(main)/catalogo/page.tsx,
components/catalogo/BuyModal.tsx, components/Header.tsx, firestore.rules, lib/account-mock.ts (se
precisar ajustar tipos/remover uso de MOCK_USER). Nada alem.

## Testes e verificacao (OBRIGATORIO — D-008)

No front do worktree:
1. `npm run lint` — EXIT 0 (nao introduza erros; warnings preexistentes _c/_orderId toleraveis).
2. `npm run build` — passa; rotas OK.
3. Grep: 0 uso de `MOCK_USER` em BuyModal e PerfilTab; `updateProfile` nao referencia `role`.
4. Conferir a regra do firestore.rules bate com a RN-04 da spec.
5. Manual (headless nao cobre login/Firestore): relate que a validacao end-to-end (editar perfil
   persiste; trava de compra; CPF invalido bloqueia; badge da sacola) fica para o humano no
   `npm run dev`. Verifique tudo que for estatico (tipos, build, ausencia de MOCK_USER, safeRedirect
   aplicado).

**Loop de encerramento:** falhou → corrigir e re-verificar, MAX 3 TENTATIVAS; apos a 3a, PARE e relate.

## Criterios de aceite

Checklist "Criterios de aceite" da spec — todos (a parte de Firestore/persistencia e validada pelo humano + deploy da regra pela sessao-mae).

## Restricoes

- So os arquivos autorizados; sem `firebase deploy` (deploy e da sessao-mae); nada em legacy/back/app/docs.
- Sem decisoes de arquitetura alem da spec; duvida = parar e relatar.
- Commits pt-BR, Conventional Commits, sem `--no-verify`. Nao versionar `.env.local`.

## Relatorio esperado

`git show --stat <hash>`; arquivos alterados; saida de lint (EXIT) e build; confirmacao de que
`updateProfile` nao grava `role` e do diff de firestore.rules; o que fica para validacao humana +
deploy da regra pela sessao-mae; hash do commit; pendencias.
