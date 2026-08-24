# H-008 — Footer condicional + correção de links + páginas "Em construção" (feature 015)

**Executor:** sessao Haiku | **Autor:** sessao-mae (2026-07-03) | **Status:** PRONTO para disparo
**Spec:** `.claude/docs/design/specs/spec-ux-footer-e-links.md` — LEIA A SPEC. Em conflito, a spec vence; pare e relate.

## Objetivo

Footer completo só na home e recolhido/expansível nas demais páginas; corrigir todos os links do
Footer; criar componente + rotas "Em construção" para os links sem conteúdo.

## Contexto minimo

- Next.js 16 + React 19 + TS em `front/` (comandos no front do WORKTREE:
  `...\.claude\worktrees\eloquent-montalcini-2dff41\front`).
- AGENTS.md: leia `node_modules/next/dist/docs/`; invoque ui-system (UI) e risk-zone-protocol (layout).
- Home tem seções `id="sobre"`, `id="depoimentos"`, `id="faq"` (confirmado). NAO existe `id="contato"`
  na home — Contato é a rota `/contato`.
- NAO regredir gating (013), auth (005a), perfil (007a).

## Tarefas

1. **`components/EmConstrucao.tsx`** (novo, client não necessário): props `{ titulo: string }`.
   Placeholder no estilo brand: ícone (ex.: 🚧 ou lucide `Construction`), título recebido,
   subtítulo "Página em construção", texto curto "Estamos preparando esta página. Volte em breve.",
   e um `Link` "← Voltar ao início" para `/`. Centralizado, `min-h` decente.

2. **Rotas "Em construção"** (novas, sob `app/(main)/`): cada uma renderiza `<EmConstrucao titulo=.../>`:
   - `app/(main)/privacidade/page.tsx` → "Política de Privacidade"
   - `app/(main)/termos/page.tsx` → "Termos de Uso"
   - `app/(main)/como-funciona/page.tsx` → "Como funciona"

3. **`components/Footer.tsx`** — tornar client (`'use client'`), usar `usePathname()`:
   - `isHome = pathname === '/'`.
   - Estado `expanded` (useState, inicia false).
   - Se `isHome`: render footer completo (grid atual) sempre.
   - Senão: render recolhido — barra fina com o `©` e um botão "Rodapé" (chevron up/down) que faz
     `setExpanded(v=>!v)`; o grid completo só aparece quando `expanded`. Evite duplicar o grid: um
     único bloco renderizado quando `isHome || expanded`.
   - **Corrigir os hrefs (RN-02):** substituir a lista fixa de "Navegação" (que hoje manda tudo para
     `/`) e os `#` de "Para fornecedores" por objetos `{label, href}` com os destinos da spec:
     Navegação: Início `/`, Sobre Nós `/#sobre`, Produtos `/catalogo`, Depoimentos `/#depoimentos`.
     Ajuda: FAQ `/#faq`, Contato `/contato`, Política de Privacidade `/privacidade`, Termos de Uso `/termos`.
     Para fornecedores: Seja um parceiro `/cadastro`, Acesso ao painel `/login`, Como funciona `/como-funciona`.

4. **Auditoria (RN-05):** conferir `Header.tsx` (NAV_LINKS) e qualquer `href="#"`/rota inexistente
   remanescente no site (grep). Os do Header devem resolver; se achar algo quebrado fora do Footer,
   corrija para rota real ou `/como-funciona`/"Em construção" e LISTE no relatório.

5. Commit unico (pt-BR): `feat(ui): footer condicional na home, corrige links e cria paginas em construcao (feature 015)`

**Arquivos autorizados:** `components/Footer.tsx`, `components/EmConstrucao.tsx` (novo),
`app/(main)/privacidade/page.tsx`, `app/(main)/termos/page.tsx`, `app/(main)/como-funciona/page.tsx`
(novos), e `components/Header.tsx` só se a auditoria achar link quebrado. Nada alem.

## Testes e verificacao (OBRIGATORIO — D-008)

No front do worktree:
1. `npm run lint` — **rode e LEIA o exit real** (não presuma); precisa ser EXIT 0 (warnings preexistentes _c/_orderId toleráveis).
2. `npm run build` — passa; as rotas `/privacidade`, `/termos`, `/como-funciona` DEVEM aparecer na lista.
3. Grep: 0 `href="#"` e 0 `href="/"` indevido no Footer (Início pode ser `/`).
4. Regressão: /mercado "Em breve" (013), login (005a), perfil (007a) intactos.

**Loop de encerramento:** falhou → corrigir e re-verificar, MAX 3 TENTATIVAS; após a 3a, PARE e relate.

## Criterios de aceite

Checklist da spec (validação visual do footer recolhido/expansível fica para o humano no npm run dev).

## Restricoes

- So os arquivos autorizados; nada em legacy/back/app/docs; sem `--no-verify`.
- Sem decisoes de arquitetura alem da spec; duvida = parar e relatar.
- Commits pt-BR, Conventional Commits.

## Relatorio esperado

`git show --stat <hash>`; arquivos criados/alterados; saida REAL de lint (exit code lido, não presumido) e build (com as 3 novas rotas); links que a auditoria corrigiu fora do Footer; hash; pendências.
