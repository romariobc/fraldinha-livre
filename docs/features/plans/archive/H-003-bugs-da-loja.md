# H-003 — Bugs conhecidos da loja (marketplace, Fase 1)

**Executor:** sessao Haiku | **Autor:** sessao-mae (2026-07-03) | **Status:** PRONTO para disparo
**Origem:** achados do code-review 2026-07-02 + pendencias em `licoes-e-diretrizes.md`. Sao correcoes
em features ja entregues (nao ha spec nova; cada fix tem causa-raiz confirmada abaixo).

## Objetivo

Resolver os bugs conhecidos da loja para deixar o caminho feliz do marketplace redondo (UX/fluidez).
NAO tocar em fluxos de leilao (gated) nem no auth/perfil.

## Contexto minimo

- Next.js 16 + React 19 + TS em `front/` (comandos no front do WORKTREE:
  `...\.claude\worktrees\eloquent-montalcini-2dff41\front`).
- AGENTS.md: leia `node_modules/next/dist/docs/`; ui-system; domain-catalogo/comprador.
- NAO regredir gating (013), auth (005a), perfil (007a).

## Tarefas (cada uma com a causa-raiz)

1. **Busca "todos" ignorada** — `front/src/app/(main)/catalogo/page.tsx`, `updateFilter` (~l.37):
   `if (value && value !== 'todos')` e aplicado a TODAS as chaves, inclusive `search` e `sort`. Assim,
   buscar a palavra "todos" apaga o param. **Fix:** o sentinela `'todos'` so vale para os selects
   `brand`/`size`. Para `search` e `sort`, gravar o param para qualquer valor nao-vazio (deletar so
   quando vazio). Ex.: usar o sentinela apenas quando `key === 'brand' || key === 'size'`.

2. **`?page` nao sanitizado** — mesmo arquivo:
   - `filters.page = Number(searchParams.get('page') ?? '1')` (~l.30) vira `NaN` com `?page=abc`.
   - `start`/`end` (~l.68-69) e o `Pagination currentPage` usam `filters.page` cru; `filterProducts`
     ja clampa internamente (`safePage`), entao o cabecalho "Mostrando X-Y" e a paginacao divergem
     dos itens exibidos quando page e invalido/fora do range.
   **Fix:** sanitizar/clamp num unico ponto. Parsear com fallback (`const n = parseInt(...); page =
   Number.isFinite(n) && n >= 1 ? n : 1`) e, no componente, usar um `safePage` clampado a
   `[1, totalPages]` para `start`, `end` e para o `currentPage` do `Pagination` (coerente com o que
   `filterProducts` ja faz). `?page=abc` deve cair na pagina 1; `?page=99` deve mostrar a ultima.

3. **Hydration mismatch de tempo relativo** — `timeAgo`/`formatDate` derivam de `Date.now()` (render)
   sobre mocks com `createdAt` relativo a `Date.now()` (nivel de modulo em `supplier-mock.ts`),
   gerando texto diferente entre servidor e cliente. **Fix:** adicionar `suppressHydrationWarning`
   nos elementos que renderizam `timeAgo(...)` (e `formatDate` de mocks relativos). Grep por `timeAgo`
   em `front/src` e cobrir cada uso visivel (ex.: `DirectOrderCard`, `OfertasMercadoTab` — este ja
   pode ter; `LogisticaTab`). Nao mudar a logica do `timeAgo`, so suprimir o warning no ponto de
   render (e display-only).

4. **"Esqueci minha senha" aponta para `/como-funciona`** — `front/src/app/login/page.tsx`:
   o link foi corrigido de `#` para `/como-funciona` (H-008), mas e semanticamente errado — reset de
   senha nao existe (login e por Google; email/senha e 005b, inativo). **Fix:** como o bloco de
   email/senha esta inativo ("em breve"), transformar "Esqueci minha senha" num texto **mudo/inerte**
   (span com `text-brand-muted cursor-default`, sem navegacao), coerente com o form desativado. Nao
   deixar link que leva a pagina errada.

5. **`EmConstrucao.tsx` com cores genericas** — `front/src/components/EmConstrucao.tsx` usa
   `text-blue-600`, `text-gray-900/600`, `bg-blue-600`. **Fix:** trocar pelos tokens de marca
   (`text-primary`/`text-primary-dark`, `text-brand-text`, `text-brand-muted`, `bg-primary` +
   `hover:bg-primary-dark`, texto branco no botao). Manter a estrutura.

6. **(Opcional, cosmetico) Precos hardcoded em reais na home** — `front/src/app/(main)/page.tsx`
   (~l.363, secao "destaques", `product.price` de dados locais em reais tipo `18`). **Fix leve:**
   exibir como `R$ XX,XX` (2 casas) para ficar consistente com o catalogo. So se for trivial; se pedir
   refatorar os dados, PULE e relate como pendencia.

## Testes e verificacao (OBRIGATORIO — D-008)

No front do worktree. RODE e LEIA o exit real (nao presuma):
1. `npm run lint` — EXIT 0 (sem `any`, sem erro novo).
2. `npm run build` — passa.
3. Manual (relatar como pendente ao humano): buscar "todos" filtra/mostra estado certo; `/catalogo?page=abc`
   cai na pagina 1; `/catalogo?page=99` mostra ultima pagina com cabecalho coerente; painel sem warning
   de hydration no console; "Esqueci minha senha" inerte; pagina "Em construcao" com cara de marca.

**Loop de encerramento:** falhou → corrigir e re-verificar, MAX 3 TENTATIVAS; apos a 3a, PARE e relate.

## Criterios de aceite

- [ ] Buscar "todos" grava `?search=todos` e filtra (nao apaga o param)
- [ ] `?page` invalido/fora do range: itens, cabecalho "Mostrando X-Y" e paginacao COERENTES (clamp)
- [ ] Sem warning de hydration por `timeAgo` no console
- [ ] "Esqueci minha senha" nao navega para pagina errada (inerte/mudo)
- [ ] `EmConstrucao` usa tokens de marca
- [ ] `npm run lint` EXIT 0; `npm run build` passa; gating/auth/perfil intactos

## Restricoes

- So os arquivos citados; nada em legacy/back/app/docs; sem `--no-verify`. NAO presuma resultados de comandos.

## Relatorio esperado

`git show --stat <hash>`; o que mudou por bug; saida REAL de lint (exit lido) e build; itens manuais
para o humano; hash; pendencias (ex.: se pulou o 6).
