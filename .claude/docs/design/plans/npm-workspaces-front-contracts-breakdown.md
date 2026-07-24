# npm Workspaces (front + contracts) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fazer `front/` consumir `packages/contracts` via npm workspaces reais (em vez de um
path alias cru que sai da raiz de `front/`), resolvendo o bloqueio da Task 2 do plano de deploy do
frontend (`Module not found: Can't resolve '@contracts'`, causado pelo Turbopack não conseguir
atravessar a fronteira do projeto).

**Architecture:** `package.json` novo na raiz com `"workspaces": ["front", "packages/contracts"]`.
`packages/contracts` ganha um `"exports"` real. `front/tsconfig.json` troca o alias `@contracts`
de um caminho de arquivo cru para outro especificador de módulo (`@fraldinha-livre/contracts`),
deixando a resolução de node_modules real (via o symlink que o workspace cria) fazer o trabalho.
`back/` fica 100% fora do workspace, sem nenhuma mudança.

**Tech Stack:** npm workspaces (nativo, npm já usado no projeto — sem ferramenta nova), TypeScript,
Next.js `16.2.11`.

## Global Constraints

- **`back/` não é tocado de forma alguma** — nem `package.json`, nem `package-lock.json`, nem
  `tsconfig.json`. Critério de aceite: `git status back/` vazio ao final.
- **O alias `@contracts` continua existindo** — nenhum dos 8 arquivos de `front/src/` que importam
  `@contracts` é modificado. Só o mecanismo por trás muda.
- **`@contracts` no `tsconfig.json` aponta pra um especificador de módulo
  (`@fraldinha-livre/contracts`), não para um caminho de arquivo.** Não hardcodar um caminho tipo
  `./node_modules/.../src/index.ts` — o npm pode hospedar o symlink do workspace na raiz do repo
  ou dentro de `front/node_modules/`, dependendo de hoisting; aliasar pra outro nome de módulo
  funciona nos dois casos.
- **`transpilePackages` e `turbopack.root` (já existente em `front/next.config.ts`) não são
  removidos nesta fatia**, mesmo que um possa ser redundante agora — candidatos a limpeza futura,
  não decidido agora (evitar scope creep).
- **Convenção do projeto:** commits em português; `tsc --noEmit`/`npm run lint`/`npm test` devem
  sair exit 0 em `front/`, `back/` e `packages/contracts` antes de qualquer commit ser considerado
  pronto.

---

## Task 1: Migrar front/ + packages/contracts para npm workspaces

**Files:**
- Create: `package.json` (raiz do repo)
- Modify: `packages/contracts/package.json`
- Modify: `front/package.json`
- Modify: `front/tsconfig.json`
- Modify: `front/next.config.ts`
- Delete: `front/package-lock.json`
- Delete: `packages/contracts/package-lock.json`
- Create (gerado por `npm install`): `package-lock.json` (raiz)

**Interfaces:**
- Produces: `@fraldinha-livre/contracts` resolvível via node_modules real a partir de `front/`
  (consumido pelos 8 arquivos existentes que já importam `@contracts` — nenhum deles muda).
- Não depende de nenhuma task anterior. Desbloqueia a Task 2 de
  `deploy-frontend-cloudflare-breakdown.md` (fora deste plano — não reexecutar aqui).

Este é um único task porque as mudanças são fortemente acopladas: nenhuma delas funciona sozinha
(o `package.json` da raiz sem o `exports` em `packages/contracts` não resolve; o alias novo no
`tsconfig.json` sem o `npm install` na raiz não tem o que resolver). A "verificação" não é um
teste unitário novo — é confirmar que a suíte existente inteira continua verde e que o build que
estava falhando agora completa.

- [ ] **Step 1: Confirmar o diretório de trabalho**

```bash
git rev-parse --show-toplevel
```

Expected: `E:/Labdev/Projetos/fraldinha-livre/.claude/worktrees/eloquent-montalcini-2dff41` (ou o
caminho equivalente com barras invertidas no Windows). Este é um worktree diferente do usual —
confirme antes de tocar em qualquer arquivo.

- [ ] **Step 2: Criar `package.json` na raiz do repo**

```json
{
  "private": true,
  "workspaces": [
    "front",
    "packages/contracts"
  ]
}
```

- [ ] **Step 3: Adicionar `exports` em `packages/contracts/package.json`**

Localizar (arquivo atual):

```json
{
  "name": "@fraldinha-livre/contracts",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "zod": "^3.23.0"
  },
  "devDependencies": {
    "vitest": "^3.2.7",
    "typescript": "^5"
  }
}
```

Substituir por (só adiciona `"exports"` depois de `"type"`, resto idêntico):

```json
{
  "name": "@fraldinha-livre/contracts",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "exports": {
    ".": "./src/index.ts"
  },
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "zod": "^3.23.0"
  },
  "devDependencies": {
    "vitest": "^3.2.7",
    "typescript": "^5"
  }
}
```

- [ ] **Step 4: Adicionar a dependency de workspace em `front/package.json`**

Localizar o bloco `"dependencies"` atual:

```json
  "dependencies": {
    "@base-ui/react": "^1.4.1",
    "class-variance-authority": "^0.7.1",
    "clsx": "^2.1.1",
    "firebase": "^12.15.0",
    "lucide-react": "^1.14.0",
    "next": "16.2.11",
    "react": "19.2.4",
    "react-dom": "19.2.4",
    "shadcn": "^4.6.0",
    "sonner": "^2.0.7",
    "tailwind-merge": "^3.5.0",
    "tw-animate-css": "^1.4.0"
  },
```

Substituir por (adiciona `@fraldinha-livre/contracts` logo depois de `@base-ui/react`, resto
idêntico):

```json
  "dependencies": {
    "@base-ui/react": "^1.4.1",
    "@fraldinha-livre/contracts": "*",
    "class-variance-authority": "^0.7.1",
    "clsx": "^2.1.1",
    "firebase": "^12.15.0",
    "lucide-react": "^1.14.0",
    "next": "16.2.11",
    "react": "19.2.4",
    "react-dom": "19.2.4",
    "shadcn": "^4.6.0",
    "sonner": "^2.0.7",
    "tailwind-merge": "^3.5.0",
    "tw-animate-css": "^1.4.0"
  },
```

(Se a versão do `next` no arquivo real não for exatamente `16.2.11` quando você chegar aqui —
por exemplo, se o bump do commit `3deeabe` não estiver presente neste checkout por algum motivo —
não mexer nela; ela é de uma mudança anterior, fora do escopo desta task. Só adicione a linha do
`@fraldinha-livre/contracts`.)

- [ ] **Step 5: Remover os lockfiles individuais**

```bash
rm front/package-lock.json packages/contracts/package-lock.json
```

- [ ] **Step 6: Instalar a partir da raiz do repo**

```bash
npm install
```

Rodar este comando de dentro da **raiz** do repo (não de `front/` nem de `packages/contracts/`).
Expected: completa sem erro de peer dependency (o bump do Next para `16.2.11` já satisfaz o que o
`@opennextjs/cloudflare` exige — não deve precisar de `--legacy-peer-deps`; se precisar, isso é um
sinal de que algo está diferente do esperado — reporte como concern, não force silenciosamente).
Deve gerar um `package-lock.json` na raiz e criar um symlink resolvendo
`@fraldinha-livre/contracts` a partir de `front/` (o local exato do symlink — dentro de
`front/node_modules/` ou na raiz — não importa para este plano, só que a resolução funcione,
verificado no Step 10).

- [ ] **Step 7: Atualizar `front/tsconfig.json`**

Localizar:

```json
    "paths": {
      "@/*": ["./src/*"],
      "@contracts": ["../packages/contracts/src/index.ts"],
      "@contracts/*": ["../packages/contracts/src/*"]
    }
```

Substituir por:

```json
    "paths": {
      "@/*": ["./src/*"],
      "@contracts": ["@fraldinha-livre/contracts"],
      "@contracts/*": ["@fraldinha-livre/contracts/*"]
    }
```

- [ ] **Step 8: Atualizar `front/next.config.ts`**

Localizar (arquivo atual, sem nenhuma mudança de tentativas anteriores):

```typescript
import path from "path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    // O monorepo importa @contracts de ../packages/contracts; sem isto o
    // Turbopack limita a resolucao a front/ (raiz detectada pelo lockfile)
    // e "Module not found: Can't resolve '@contracts'" no next dev.
    root: path.join(__dirname, ".."),
  },
};

export default nextConfig;
```

Substituir por (adiciona `transpilePackages`, mantém `turbopack.root` como está — não remover):

```typescript
import path from "path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    // O monorepo importa @contracts de ../packages/contracts; sem isto o
    // Turbopack limita a resolucao a front/ (raiz detectada pelo lockfile)
    // e "Module not found: Can't resolve '@contracts'" no next dev.
    root: path.join(__dirname, ".."),
  },
  // @fraldinha-livre/contracts e consumido como fonte TS (sem build proprio) via
  // npm workspace — isto instrui o Next a transpilir o pacote como se fosse
  // codigo de 1a parte, em vez de esperar JS ja compilado em node_modules.
  transpilePackages: ["@fraldinha-livre/contracts"],
};

export default nextConfig;
```

- [ ] **Step 9: Rodar as 3 suítes + tsc**

```bash
cd front && npx tsc --noEmit && npm run lint && npm test
cd ../packages/contracts && npm test
cd ../back && npx tsc --noEmit && npm test
```

Expected: todos exit 0 / verdes. `front/`: 298/298 testes (nenhum teste novo nesta task —
`contracts-alias.test.ts` já existente deve passar sem modificação). `packages/contracts`: suíte
existente verde. `back/`: suíte existente verde, prova que nada vazou pra lá.

- [ ] **Step 10: Verificar que o bloqueio original foi resolvido**

```bash
cd front && npm run build
```

Expected: build completa **sem** `Module not found: Can't resolve '@contracts'`. Este é o
critério de aceite central desta task — se esse erro específico ainda aparecer, a task não está
pronta, não force um commit. Se aparecer um erro DIFERENTE (não relacionado a `@contracts`),
reporte com o log completo — pode ser um problema novo e separado, não assuma que é o mesmo bug.

Não é necessário rodar `npm run preview` (build + wrangler dev) aqui — isso é retomar a Task 2 de
`deploy-frontend-cloudflare-breakdown.md`, fora do escopo deste plano.

- [ ] **Step 11: Confirmar que `back/` não foi tocado**

```bash
git status back/
```

Expected: vazio (nenhuma mudança).

- [ ] **Step 12: Commit**

```bash
git add package.json package-lock.json front/package.json front/package-lock.json packages/contracts/package.json packages/contracts/package-lock.json front/tsconfig.json front/next.config.ts
git rm --cached front/package-lock.json packages/contracts/package-lock.json 2>/dev/null || true
git commit -m "feat(front): migra front+contracts para npm workspaces, desbloqueia adapter"
```

(O `git rm --cached` extra é só uma rede de segurança caso o Step 5 não tenha removido os
lockfiles antigos do índice do git corretamente — se o `git add` já não os incluir porque foram
deletados do disco, o comando não faz nada de errado, só confirma.)
