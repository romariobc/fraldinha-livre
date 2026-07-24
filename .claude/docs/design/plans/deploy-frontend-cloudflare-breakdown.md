# Deploy do Frontend (Cloudflare Workers + OpenNext) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Colocar o frontend Next.js em produção pela primeira vez, como um Worker Cloudflare
(`fraldinha-livre-frontend`) via adapter `@opennextjs/cloudflare`, com CORS do backend atualizado para
aceitar a origem de produção e as preview URLs por PR.

**Architecture:** Dois Workers Cloudflare independentes (front e back), hostnames diferentes em
`*.workers.dev`. CORS no backend passa de "só localhost" para uma regex que também aceita produção e
preview do front. Deploy via Cloudflare Workers Builds (conexão nativa com o GitHub), não workflow
customizado.

**Tech Stack:** Next.js `16.2.4`, `@opennextjs/cloudflare`, `wrangler`, Hono (`cors` middleware,
já existente), Vitest.

## Global Constraints

- **Não há domínio próprio ainda.** Tudo em `*.workers.dev`.
- **CORS não é eliminado por estar na mesma conta Cloudflare** — os dois Workers têm hostnames
  diferentes, toda chamada do navegador continua cross-origin. Não escrever comentários/commits que
  sugiram o contrário (achado da revisão cruzada entre sessões, D-029 corrigida no commit `054cf41`).
- **Login Google não funciona em preview URLs** (Firebase Auth não aceita wildcard em authorized
  domains) — limitação aceita, não é bug a corrigir nesta fatia.
- **Nome do Worker do front:** `fraldinha-livre-frontend` (espelha `fraldinha-livre-backend`).
- **Node local é 20.20.2** — `wrangler` ≥4.87 exige Node ≥22 (D-021, já resolvido no backend fixando
  `wrangler@4.86.0`). Qualquer invocação LOCAL de `wrangler` nesta fatia usa a mesma versão fixa,
  `4.86.0`, comprovadamente compatível. Isso não afeta o deploy real (Workers Builds roda no ambiente da
  Cloudflare, não nesta máquina).
- **Convenção do projeto:** commits em português; `tsc --noEmit`/`npm run lint`/`npm test` devem sair
  exit 0 em `front/` e `back/` antes de qualquer commit ser considerado pronto.

---

## Task 1: CORS do backend aceita produção e preview do front

**Files:**
- Modify: `back/src/index.ts:10-21`
- Test: `back/test/cors.test.ts`

**Interfaces:**
- Não expõe nada para outras tasks — mudança isolada no middleware CORS do Worker de backend já
  existente. Independente da Task 2 (pode rodar antes, depois, ou em paralelo).

- [ ] **Step 1: Escrever os testes falhos**

Em `back/test/cors.test.ts`, adicionar estes 4 casos ao `describe('CORS', ...)` existente (depois do
último `it` atual, antes do `})` de fechamento do describe):

```typescript
  it('origin de producao do front (workers.dev) e permitida', async () => {
    const request = new Request('http://localhost/orders', {
      method: 'OPTIONS',
      headers: {
        Origin: 'https://fraldinha-livre-frontend.romariobc.workers.dev',
        'Access-Control-Request-Method': 'GET',
        'Access-Control-Request-Headers': 'authorization',
      },
    })
    const response = await app.fetch(request, env)

    expect(response.status).toBe(204)
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe(
      'https://fraldinha-livre-frontend.romariobc.workers.dev',
    )
  })

  it('preview URL do Workers Builds (prefixo de branch) e permitida', async () => {
    const request = new Request('http://localhost/orders', {
      method: 'OPTIONS',
      headers: {
        Origin: 'https://minha-branch-fraldinha-livre-frontend.romariobc.workers.dev',
        'Access-Control-Request-Method': 'GET',
        'Access-Control-Request-Headers': 'authorization',
      },
    })
    const response = await app.fetch(request, env)

    expect(response.status).toBe(204)
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe(
      'https://minha-branch-fraldinha-livre-frontend.romariobc.workers.dev',
    )
  })

  it('preview URL do Workers Builds (prefixo de versao) e permitida', async () => {
    const request = new Request('http://localhost/orders', {
      method: 'OPTIONS',
      headers: {
        Origin: 'https://abc1234-fraldinha-livre-frontend.romariobc.workers.dev',
        'Access-Control-Request-Method': 'GET',
        'Access-Control-Request-Headers': 'authorization',
      },
    })
    const response = await app.fetch(request, env)

    expect(response.status).toBe(204)
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe(
      'https://abc1234-fraldinha-livre-frontend.romariobc.workers.dev',
    )
  })

  it('dominio parecido mas nao exato (sufixo extra) continua rejeitado', async () => {
    const request = new Request('http://localhost/orders', {
      method: 'OPTIONS',
      headers: {
        Origin: 'https://fraldinha-livre-frontend.romariobc.workers.dev.evil.com',
        'Access-Control-Request-Method': 'GET',
        'Access-Control-Request-Headers': 'authorization',
      },
    })
    const response = await app.fetch(request, env)

    expect(response.headers.get('Access-Control-Allow-Origin')).toBeNull()
  })
```

- [ ] **Step 2: Rodar os testes e confirmar que falham**

Run: `cd back && npm test -- cors.test.ts`
Expected: FAIL — os 3 primeiros casos novos recebem `null` em vez da origem esperada (regex atual só
aceita `localhost`); o 4º já passa mesmo sem mudança (é regressão do comportamento atual).

- [ ] **Step 3: Atualizar a regex de CORS em `back/src/index.ts`**

Localizar (linhas 10-12):

```typescript
// Auth e por Bearer token (sem cookies) — CORS restrito a localhost (dev).
// Quando o front ganhar dominio proprio, adicionar a origem de producao aqui.
const ALLOWED_ORIGIN = /^https?:\/\/localhost(:\d+)?$/
```

Substituir por:

```typescript
// Auth e por Bearer token (sem cookies). CORS aceita: localhost (dev), o
// Worker de producao do front, e as preview URLs do Workers Builds (prefixo
// dinamico de branch/versao antes do nome do Worker). Estar na mesma conta
// Cloudflare NAO elimina CORS — os dois Workers tem hostnames diferentes,
// toda chamada do navegador continua cross-origin (D-029, correcao registrada).
const ALLOWED_ORIGIN =
  /^(https?:\/\/localhost(:\d+)?|https:\/\/([a-z0-9-]+-)?fraldinha-livre-frontend\.romariobc\.workers\.dev)$/
```

O resto do arquivo (`app.use('*', cors({ ... }))`) não muda — `ALLOWED_ORIGIN.test(origin)` já cobre a
regex nova automaticamente.

- [ ] **Step 4: Rodar os testes e confirmar que passam**

Run: `cd back && npm test -- cors.test.ts`
Expected: PASS — 7/7 (3 existentes + 4 novos).

- [ ] **Step 5: Rodar tsc e suíte completa do backend**

Run: `cd back && npx tsc --noEmit && npm test`
Expected: `tsc` exit 0; suíte completa verde (30 testes existentes + 4 novos = 34).

- [ ] **Step 6: Commit**

```bash
git add back/src/index.ts back/test/cors.test.ts
git commit -m "feat(back): CORS aceita origem de producao e preview do front"
```

---

## Task 2: Adapter OpenNext no front + validação local

**Files:**
- Create: `front/wrangler.jsonc`
- Create: `front/open-next.config.ts`
- Modify: `front/package.json` (scripts + 2 devDependencies)
- Modify: `.gitignore` (raiz do repo)

**Interfaces:**
- Produces: scripts `npm run preview` (build + roda local no runtime `workerd` via `wrangler dev`) e
  `npm run deploy` (build + deploy real) em `front/package.json` — usados pela Task 3.
- Não depende da Task 1.

**Nota importante:** esta task É a validação de compatibilidade do adapter com Next.js `16.2.4`
mencionada no spec (não é um spike descartável separado — a validação acontece configurando de verdade).
Se o preview local não funcionar de um jeito que pareça um bloqueio real do adapter (não um erro de
configuração corrigível), pare e reporte BLOCKED com o erro exato — não force um workaround sem entender
a causa.

- [ ] **Step 1: Instalar as dependências**

```bash
cd front
npm install --save-dev @opennextjs/cloudflare@latest
npm install --save-dev wrangler@4.86.0
```

Registrar no relatório qual versão exata de `@opennextjs/cloudflare` foi instalada (aparece no
`package-lock.json` e no output do `npm install`).

- [ ] **Step 2: Criar `front/wrangler.jsonc`**

```jsonc
{
  "$schema": "./node_modules/wrangler/config-schema.json",
  "name": "fraldinha-livre-frontend",
  "main": ".open-next/worker.js",
  "compatibility_date": "2026-07-24",
  "compatibility_flags": ["nodejs_compat"],
  "assets": {
    "directory": ".open-next/assets",
    "binding": "ASSETS"
  }
}
```

- [ ] **Step 3: Criar `front/open-next.config.ts`**

```typescript
import { defineCloudflareConfig } from "@opennextjs/cloudflare";

export default defineCloudflareConfig();
```

- [ ] **Step 4: Adicionar scripts em `front/package.json`**

Localizar o bloco `"scripts"` existente:

```json
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "eslint",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:coverage": "vitest run --coverage"
  },
```

Substituir por (3 entradas novas no final, nada removido):

```json
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "eslint",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:coverage": "vitest run --coverage",
    "preview": "opennextjs-cloudflare build && opennextjs-cloudflare preview",
    "deploy": "opennextjs-cloudflare build && opennextjs-cloudflare deploy",
    "cf-typegen": "wrangler types --env-interface CloudflareEnv cloudflare-env.d.ts"
  },
```

- [ ] **Step 5: Ignorar artefatos gerados**

No `.gitignore` da raiz do repo, dentro da seção `# ── Node / Next.js ──`, adicionar (depois da linha
`front/*.tsbuildinfo`):

```
front/.open-next/
front/.wrangler/
front/cloudflare-env.d.ts
```

- [ ] **Step 6: Build + preview local — validação real do adapter**

Rodar em background (processo de longa duração):

```bash
cd front
npm run preview
```

Ler o output impresso (build primeiro, depois o servidor local sobe via `wrangler dev` no runtime
`workerd`) e anotar a URL local exibida (formato esperado: algo como
`Ready on http://localhost:<porta>` ou equivalente — a porta exata depende da versão instalada, não
adivinhar, ler do log real).

**Atenção especial ao build:** este projeto é um monorepo (`front/` importa `@contracts` de
`../packages/contracts`) e já teve um bug real de resolução de módulo em dev (`Module not found:
Can't resolve '@contracts'`, corrigido em `front/next.config.ts` com `turbopack.root` — ver B9 no
`progresso.md`). O build do OpenNext usa Webpack internamente (não Turbopack), então esse bug específico
não deve se repetir, mas confirme que o build conclui sem erro de resolução de `@contracts` antes de
seguir.

- [ ] **Step 7: Smoke test das rotas reais contra o preview local**

Com o processo do Step 6 rodando, testar as rotas principais do app (substituir `<porta>` pela porta
real observada):

```bash
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:<porta>/
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:<porta>/catalogo
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:<porta>/login
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:<porta>/minha-conta
```

Expected: `/` e `/catalogo` e `/login` retornam `200`. `/minha-conta` retorna `200` (a página renderiza;
o guard de auth é client-side, então a página carrega e só redireciona no browser — isso é esperado e
não é falha). Nenhuma rota retorna `500`.

Se alguma rota retornar `500`, capturar o log completo do processo do Step 6 (stack trace) antes de
decidir se é um bug de configuração corrigível (ex.: variável de ambiente faltando) ou um problema real
de compatibilidade do adapter — no segundo caso, reportar BLOCKED com o stack trace completo.

- [ ] **Step 8: Encerrar o processo de preview**

Matar o processo em background iniciado no Step 6 antes de continuar.

- [ ] **Step 9: Rodar tsc e lint do front (build do adapter não deve ter introduzido erro de tipo)**

Run: `cd front && npx tsc --noEmit && npm run lint`
Expected: ambos exit 0.

- [ ] **Step 10: Commit**

```bash
git add front/wrangler.jsonc front/open-next.config.ts front/package.json front/package-lock.json .gitignore
git commit -m "feat(front): adapter OpenNext para deploy no Cloudflare Workers"
```

---

## Task 3: Deploy de produção (coordenador + cliente)

**Não é execução autônoma — mesmo padrão de B9/P3.** Envolve ações em consoles externos (dashboard da
Cloudflare, Firebase Console) que exigem decisão/acesso humano, não só código.

**Files:**
- Modify: `.claude/context/estado/progresso.md`

**Pré-requisitos (Tasks 1 e 2 completas e revisadas):**

- [ ] **Passo 1: Conectar o repositório no Workers Builds**

No dashboard da Cloudflare, criar/conectar o Worker `fraldinha-livre-frontend` ao repositório GitHub
(mesmo repo do backend), apontando para a branch de produção. Confirmar que o build command detecta
`npm run deploy` (ou configurar manualmente se o autodetect não achar o script certo).

- [ ] **Passo 2: Configurar as build variables no Workers Builds**

Adicionar como variáveis de build (não secrets, são `NEXT_PUBLIC_*`):
- `NEXT_PUBLIC_BACKEND_URL` = `https://fraldinha-livre-backend.romariobc.workers.dev`
- `NEXT_PUBLIC_USE_BACKEND` = `true`

- [ ] **Passo 3: Autorizar o domínio de produção no Firebase Auth**

Firebase Console → Authentication → Settings → Authorized domains → adicionar
`fraldinha-livre-frontend.romariobc.workers.dev`. Sem isso, `signInWithPopup` falha em produção
(mesma classe de gotcha já documentada no projeto).

- [ ] **Passo 4: Disparar o primeiro deploy**

Push/merge na branch de produção conectada no Passo 1. Acompanhar o build no dashboard da Cloudflare
até "Deployed".

- [ ] **Passo 5: Smoke test da URL de produção**

```bash
curl -s -o /dev/null -w "%{http_code}\n" https://fraldinha-livre-frontend.romariobc.workers.dev/
curl -s -o /dev/null -w "%{http_code}\n" https://fraldinha-livre-frontend.romariobc.workers.dev/catalogo
```

Expected: ambos `200`.

- [ ] **Passo 6: Validação humana completa no navegador**

Cliente confirma, na URL de produção real: login Google funciona (domínio já autorizado no Passo 3);
catálogo carrega produtos reais (contra `fraldinha-livre-backend` de produção); checkout completo cria
pedido; pedido aparece em `/minha-conta`; painel do fornecedor abre e mostra as abas (incluindo Perfil).

- [ ] **Passo 7: Abrir 1 Pull Request de teste para confirmar a preview URL**

Criar um PR trivial (ex.: mudar 1 comentário) e confirmar que a preview URL aparece comentada
automaticamente no PR, que ela carrega, e que rotas públicas (`/catalogo`) funcionam nela (login,
como já esperado, não vai funcionar — não é bug, ver Global Constraints).

- [ ] **Passo 8: Registrar em `progresso.md`**

Adicionar uma nova seção "Estado atual" no topo do arquivo (seguindo a convenção já usada — seção
anterior vira "Estado anterior"): frontend em produção pela primeira vez, URL, commits das Tasks 1-2,
nota de que login não funciona em preview (limitação aceita), próximo passo em aberto (domínio próprio,
quando o cliente registrar um).

- [ ] **Passo 9: Commit**

```bash
git add .claude/context/estado/progresso.md
git commit -m "docs(estado): frontend em producao pela primeira vez (Cloudflare Workers + OpenNext)"
```
