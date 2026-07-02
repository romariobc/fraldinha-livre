# H-005 — Autenticacao Google (NextAuth v5), fatia identidade (feature 005a)

**Executor:** sessao Haiku | **Autor:** sessao-mae (2026-07-02) | **Status:** redigido — executar SOMENTE apos H-002 aprovado
**Spec:** `.claude/docs/design/specs/spec-auth-google.md` — LEIA A SPEC INTEIRA ANTES DE COMECAR. Em conflito entre prompt e spec, a spec vence; pare e relate.

## Objetivo

Implementar login Google real com NextAuth v5, tornar `useSession()` a unica fonte de sessao
(removendo o `IS_LOGGED_IN` mock e sua duplicata no Header), proteger rotas privadas e criar o
onboarding de papel (armazenamento stub ate o 006). Ver D-010 e D-011 em `.claude/docs/decisoes.md`.

## Contexto minimo

- App Next.js 16 App Router + React 19 + TypeScript em `front/` (comandos dentro de `front/`).
- Credenciais Google + NextAuth JA existem em `front/.env.local` (nao criar, nao versionar, nao imprimir os valores).
- AGENTS.md exige: leia `node_modules/next/dist/docs/` antes de codar Next e invoque os skills de dominio (`risk-zone-protocol` para `src/lib/` e layout; `ui-system` para UI).
- Pre-requisito: H-002 ja aplicado (flag `LEILAO_ATIVO`, gating do leilao). Nao regredir o gating.

## Tarefa 0 — Verificacao previa OBRIGATORIA (antes de qualquer codigo)

Confirmar compatibilidade NextAuth v5 (Auth.js) com Next 16 + React 19: pacote/versao correto e
nome das env vars. Se NAO houver versao estavel compativel, **PARE e relate** sem instalar nada nem
mexer no Next. So prossiga para a Tarefa 1 se houver caminho compativel documentado.

## Tarefas (nesta ordem, apos Tarefa 0 ok)

1. Instalar o pacote NextAuth v5 compativel (confirmado na Tarefa 0).
2. Criar o handler `front/src/app/api/auth/[...nextauth]/route.ts` com provider Google apenas, lendo as env vars existentes. Configurar `pages.signIn = '/login'`.
3. Criar/registrar `SessionProvider` (client) embrulhando a arvore em `front/src/app/layout.tsx` (ou provider dedicado importado la).
4. `Header.tsx`: remover a const `IS_LOGGED_IN` hardcoded (linha ~21); usar `useSession()`; `handleCartClick` passa a decidir por `status === 'authenticated'`; adicionar acao de logout (`signOut`) quando logado.
5. `catalogo/page.tsx` + `ProductCard.tsx`: `isLoggedIn` passa a vir de `useSession()` (nao do mock).
6. Deletar `front/src/lib/auth-mock.ts` apos confirmar (grep) que nenhum import restou.
7. `login/page.tsx`: botao "Entrar com Google" chama `signIn('google', { callbackUrl })` preservando `?redirect`; o form e-mail/senha permanece visivel e inativo (nao submeter).
8. Proteger `/minha-conta` e `/fornecedor/**`: middleware `auth` do NextAuth v5 (ou guarda no layout se incompativel), redirecionando deslogado para `/login?redirect=<rota>`.
9. Onboarding de papel `front/src/app/onboarding/page.tsx`: apos login sem papel, pergunta comprador/fornecedor; grava na SESSAO via callback (nao em banco); roteia comprador→/minha-conta, fornecedor→/fornecedor/painel. **Comentario no topo do arquivo marcando o armazenamento como STUB temporario ate a feature 006 (D-011).**
10. Saudacao dos heros de `/minha-conta` e `/fornecedor/painel` usa nome/e-mail da sessao quando houver (resto segue mock).
11. Commit unico (pt-BR): `feat(auth): login Google com NextAuth v5 e sessao real (feature 005a)`

**Arquivos autorizados:** os listados acima + `package.json`/lockfile (instalacao) + imports diretamente afetados pela remocao do IS_LOGGED_IN (liste todos no relatorio). Nada alem.

## Testes e verificacao (OBRIGATORIO — D-008)

Dentro de `front/`:

1. `npm run lint` — zero erros.
2. `npm run build` — sem erros.
3. Grep: nenhuma referencia restante a `IS_LOGGED_IN` nem import de `auth-mock`.
4. Teste manual (`npm run dev`): "Entrar com Google" abre o consentimento Google e retorna logado; deslogado, acessar `/minha-conta` redireciona para `/login?redirect=/minha-conta`; onboarding aparece sem papel e roteia; logout volta ao estado deslogado; `/mercado` segue "Em breve" (gating intacto); form e-mail/senha visivel e inerte.
5. Confirmar `.env.local` fora do controle de versao (`git status` nao deve lista-lo).

**Loop de encerramento:** falhou → corrigir e re-verificar, MAXIMO 3 TENTATIVAS. Apos a 3a falha:
PARE, nao improvise nem mude a abordagem. Relate o que falhou, o que tentou em cada tentativa e o
estado dos arquivos. **Especialmente:** se a Tarefa 0 (compatibilidade) falhar, pare imediatamente
— nao conta como tentativa de codigo.

## Criterios de aceite

Checklist "Criterios de aceite" da spec — todos devem passar.

## Restricoes

- Sem decisoes de arquitetura alem da spec; duvida = parar e relatar.
- Nao versionar `.env.local`; nao imprimir segredos no relatorio.
- Nao regredir o gating (013). Nao tocar em `legacy/`, `back/`, `app/`, docs de governanca.
- Commits em pt-BR, Conventional Commits, sem `--no-verify`.

## Relatorio esperado

Resultado da Tarefa 0 (compatibilidade, com versao escolhida); arquivos alterados/criados/deletados;
resultado de cada verificacao com evidencia; hash do commit; a costura de role implementada e onde
esta o comentario de stub; pendencias.
