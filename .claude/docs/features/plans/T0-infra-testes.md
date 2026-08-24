# T0 — Infraestrutura de testes (feature 016, Fase A)

**Executor:** subagente `SA-Infra` | **Autor:** sessao-mae (2026-07-03) | **Status:** PRONTO
**Spec:** `.claude/docs/design/specs/spec-compra-direta-carrinho-checkout.md` (esta tarefa nao implementa RN de negocio; so a base de testes).

## Objetivo

O projeto **nao tem nenhuma infraestrutura de teste** (`package.json` so tem dev/build/lint). Nada da
feature 016 pode ser "pronto" sem teste verde. Esta tarefa cria a base: **Vitest + React Testing
Library + jsdom**, o script `npm test`, e um smoke test que prova que a base funciona.

**Esta tarefa bloqueia todas as outras.** Escopo minimo — nao escreva testes de negocio aqui.

## Contexto minimo

- App em `front/` do WORKTREE: `E:\Labdev\Projetos\fraldinha-livre\.claude\worktrees\eloquent-montalcini-2dff41\front`. Rode npm ali.
- Stack: **Next 16.2.4, React 19.2.4, TypeScript 5**, Tailwind 3, alias `@/*` → `src/*` (ver tsconfig).
- AGENTS.md manda ler `node_modules/next/dist/docs/` antes de mexer em config do Next; invoque `risk-zone-protocol` (mexe em config/raiz).
- NAO alterar codigo de feature. NAO tocar em `src/` alem do smoke test.

## Tarefas

1. **Instalar devDependencies** (versoes compativeis com React 19 / Vite 5+):
   `vitest`, `@vitejs/plugin-react`, `jsdom`, `@testing-library/react` (v16+, compativel com React 19),
   `@testing-library/dom`, `@testing-library/jest-dom`, `@testing-library/user-event`, `@types/node` (ja existe).
   Use `npm install -D ...` dentro de `front/`.

2. **`front/vitest.config.ts`**: plugin react; `test.environment = 'jsdom'`; `test.globals = true`;
   `test.setupFiles = ['./vitest.setup.ts']`; `test.include` cobrindo `src/**/*.{test,spec}.{ts,tsx}`;
   **alias `@` → `./src`** (obrigatorio, o codigo importa `@/lib/...`); `test.css = false` (ou true se
   necessario para nao quebrar imports de css). Excluir `node_modules` e `.next`.

3. **`front/vitest.setup.ts`**: `import '@testing-library/jest-dom/vitest'` e um `afterEach(cleanup)`
   se o RTL nao fizer automaticamente. Se algum teste futuro precisar, deixe um stub de
   `window.matchMedia` e `IntersectionObserver` (o projeto usa ambos) — util para os componentes.

4. **Scripts no `front/package.json`**:
   - `"test": "vitest run"` (CI-friendly, nao fica em watch)
   - `"test:watch": "vitest"`
   - `"test:coverage": "vitest run --coverage"` (instale `@vitest/coverage-v8`)

5. **Smoke test** em `front/src/lib/__tests__/smoke.test.ts`:
   - um teste puro (`expect(1+1).toBe(2)`),
   - um teste que **importa do alias** (`import { formatPrice } from '@/lib/utils'`) e valida
     `formatPrice(1800) === 'R$ 18,00'` — prova que o alias e o TS funcionam,
   - um teste de render RTL minimo (renderiza um `<div>ok</div>` via `render` e usa um matcher do
     jest-dom, ex.: `toBeInTheDocument()`) — prova jsdom + RTL + jest-dom.

6. **Nao quebrar o existente**: `npm run lint` e `npm run build` continuam verdes. Se o eslint reclamar
   dos novos arquivos de config/teste, ajuste o eslint (ex.: ignorar `vitest.config.ts`/`vitest.setup.ts`
   ou adicionar env de teste) — **sem** `eslint-disable` espalhado.

7. **Commit unico** (pt-BR): `chore(test): adiciona infraestrutura de testes (vitest + RTL + jsdom) — T0`

**Arquivos autorizados:** `front/package.json`, `front/package-lock.json`, `front/vitest.config.ts`
(novo), `front/vitest.setup.ts` (novo), `front/src/lib/__tests__/smoke.test.ts` (novo), e a config do
eslint **somente se** necessario para o item 6. Nada alem.

## Testes e verificacao (OBRIGATORIO — loop de 3 tentativas)

Dentro de `front/`. **RODE e LEIA o exit code REAL de cada comando** (`<cmd>; echo "EXIT: $?"`).
NAO presuma resultado.

1. `npm test` — **EXIT 0**, com os 3 testes do smoke passando (mostre a saida).
2. `npm run lint` — **EXIT 0** (warnings preexistentes `_c`/`_orderId` toleraveis; nenhum erro novo).
3. `npm run build` — passa.

**Loop de encerramento:** implementar → rodar → se falhar, diagnosticar e corrigir → repetir,
**MAXIMO 3 TENTATIVAS**. Se nao fechar na 3a, **PARE e reporte o bloqueio** (o que falhou, o que tentou
em cada tentativa, o estado dos arquivos) em vez de insistir.

## Criterio de pronto

- [ ] `npm test` roda e passa (EXIT 0) com os 3 testes do smoke (puro, alias `@/lib/utils`, render RTL)
- [ ] `npm run lint` EXIT 0 e `npm run build` passa
- [ ] Nenhum arquivo de feature (`src/app`, `src/components`, `src/contexts`) alterado
- [ ] 1 commit em pt-BR

## Restricoes

- So os arquivos autorizados. Sem `--no-verify`. Sem `any`. Sem `eslint-disable` espalhado.
- Sem decisoes de arquitetura alem desta tarefa; duvida = PARE e relate.

## Relatorio esperado

`git show --stat <hash>`; versoes instaladas; conteudo essencial do `vitest.config.ts`; **saida real de
`npm test` com o EXIT lido**; exit de lint e build; hash do commit; bloqueios (se houver).
