# H-010 — Deploy do frontend via Cloudflare Containers (substitui o adapter OpenNext)

**Executor:** sessao Haiku | **Autor:** sessao-mae (2026-07-24) | **Status:** PRONTO para disparo
**Spec:** `.claude/docs/design/specs/spec-deploy-frontend-cloudflare-containers.md` — em conflito, a spec vence; pare e relate. Duas correcoes desta sessao-mae sobre a spec, ja aplicadas neste prompt (nao repita o valor antigo da spec):
1. O campo do wrangler.jsonc e `max_instances`, nao `instances` — a doc atual da Cloudflare
   (`developers.cloudflare.com/workers/wrangler/configuration/#containers`, verificada nesta sessao)
   usa `max_instances`; `instances` era um nome antigo de changelogs de 2025 e nao aparece mais na
   referencia atual.
2. O caminho exato da saida standalone foi VERIFICADO rodando um build real nesta sessao (nao
   assumido): `front/.next/standalone/front/server.js` (a pasta `front/` aninha dentro de
   `standalone/` porque `outputFileTracingRoot` = raiz do monorepo). Os caminhos do Dockerfile abaixo
   ja refletem isso — nao precisa reverificar, mas se o `docker build` falhar por caminho errado,
   pare e relate em vez de adivinhar.

## Objetivo

Trocar o deploy do frontend do adapter `@opennextjs/cloudflare` (abandonado — bloqueado por
`EvalError: Code generation from strings disallowed for this context`, causa raiz no SDK completo do
Firebase Firestore, sem fix oficial) para **Cloudflare Containers**: o Next.js roda num container
Node.js real (sem sandbox V8), eliminando a classe inteira do bug. Um Worker fino (Durable
Object) roteia requisicoes para o container. Esta tarefa cobre só a fatia local: código +
`docker build`/`docker run` validados na máquina de desenvolvimento. Deploy real (`wrangler deploy`)
fica fora de escopo — depende do Workers Paid plan ativado pelo cliente, é uma task separada de
coordenador+cliente (mesmo padrão de B9/P3).

## Contexto mínimo

- Stack: Next.js 16.2.11 App Router, monorepo com npm workspaces (`front/` + `packages/contracts`,
  `package.json` raiz tem `"workspaces": ["front", "packages/contracts"]`).
- `front/next.config.ts` já tem `turbopack.root` e `transpilePackages: ["@fraldinha-livre/contracts"]`
  (migração de workspaces, já feita — não mexer nessas duas linhas, só adicionar ao lado).
- Docker Desktop confirmado instalado e rodando nesta máquina (27.5.1) — pré-requisito da spec.
- AGENTS.md: leia `node_modules/next/dist/docs/` antes de mexer em Next.js; `Skill(risk-zone-protocol)`
  não se aplica (não é `src/lib/`, `src/components/ui/`, `tailwind.config.ts`, nem layout
  compartilhado).
- NAO mexer em `back/` nem `packages/contracts` — a spec exige zero diff nesses dois.

## Passo 0 — OBRIGATÓRIO antes de qualquer arquivo

Confirmar o diretório de trabalho ANTES de tocar em qualquer arquivo ou rodar `git commit`:
```
git rev-parse --show-toplevel
```
O resultado tem que ser este worktree
(`E:\Labdev\Projetos\fraldinha-livre\.claude\worktrees\eloquent-montalcini-2dff41`), NUNCA o repo
principal (`E:\Labdev\Projetos\fraldinha-livre` sem `.claude\worktrees\...`) nem outro worktree. Se
não bater, PARE e relate antes de continuar.

## Tarefas (nesta ordem)

### 1. `front/next.config.ts` — ativa saída standalone

Substitua o conteúdo inteiro por:

```typescript
import path from "path";
import type { NextConfig } from "next";

const monorepoRoot = path.join(__dirname, "..");

const nextConfig: NextConfig = {
  output: "standalone",
  // MESMO valor de turbopack.root — evita o aviso "must have the same value"
  // e ancora a estrutura do standalone corretamente (sem isto o Next usa
  // front/ como raiz sozinho, conflitando com turbopack.root).
  outputFileTracingRoot: monorepoRoot,
  turbopack: {
    // O monorepo importa @contracts de ../packages/contracts; sem isto o
    // Turbopack limita a resolucao a front/ (raiz detectada pelo lockfile)
    // e "Module not found: Can't resolve '@contracts'" no next dev.
    root: monorepoRoot,
  },
  // @fraldinha-livre/contracts e consumido como fonte TS (sem build proprio) via
  // npm workspace — isto instrui o Next a transpilir o pacote como se fosse
  // codigo de 1a parte, em vez de esperar JS ja compilado em node_modules.
  transpilePackages: ["@fraldinha-livre/contracts"],
};

export default nextConfig;
```

### 2. `.dockerignore` (NOVO, na RAIZ do repositório, não em `front/`)

O contexto de build do Docker vai ser a raiz do monorepo (task 3). Sem isto, `docker build` copia
`node_modules`/`.git`/outras pastas irrelevantes para dentro do contexto — build lento e arriscado
(node_modules do Windows tem binários nativos como `sharp-win32-x64` que não servem para o container
Linux; eles têm que ser reinstalados de dentro do container, não copiados do host).

```
.git
.github
.claude
.superpowers
.playwright-mcp
graphify-out
chatsessions
legacy
app
back
node_modules
front/node_modules
front/.next
front/.open-next
front/.wrangler
front/out
front/build
packages/contracts/node_modules
```

Nota: NÃO adicione `.env*` a este arquivo. `front/.env.local` (valores `NEXT_PUBLIC_FIREBASE_*`) é
público por design (documentado no próprio arquivo, decisão D-010) — o Next.js precisa dele presente
no contexto de build para embutir esses valores no bundle do cliente, do mesmo jeito que já acontece
no `npm run build` local.

### 3. `front/Dockerfile` (NOVO)

Multi-stage, `node:22-alpine`. Build a partir da RAIZ do monorepo (não de `front/` isolado) — este
app usa npm workspaces, precisa instalar a partir da raiz para `@fraldinha-livre/contracts` resolver.

```dockerfile
# syntax=docker/dockerfile:1
# Contexto de build = RAIZ do monorepo. Rode a partir da raiz do repo:
#   docker build -f front/Dockerfile -t fraldinha-livre-frontend .

FROM node:22-alpine AS builder
RUN apk add --no-cache libc6-compat
WORKDIR /app

COPY package.json package-lock.json ./
COPY front/package.json front/package.json
COPY packages/contracts/package.json packages/contracts/package.json
RUN npm ci

COPY front front
COPY packages/contracts packages/contracts

WORKDIR /app/front
RUN npm run build

FROM node:22-alpine AS runner
RUN apk add --no-cache libc6-compat
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=8080
ENV HOSTNAME=0.0.0.0

# Caminho verificado nesta sessao com um build real: a saida standalone aninha
# por "front/" porque outputFileTracingRoot aponta pra raiz do monorepo.
COPY --from=builder /app/front/.next/standalone/front ./
COPY --from=builder /app/front/.next/static ./.next/static
COPY --from=builder /app/front/public ./public

EXPOSE 8080
CMD ["node", "server.js"]
```

`libc6-compat` é o pacote Alpine recomendado pela própria documentação do Next.js para builds
standalone (evita falhas silenciosas de binários nativos sob musl). `.next/static` e `public/` ficam
FORA de `.next/standalone/` no build normal do Next — têm que ser copiados à parte, senão a página
sobe sem CSS/JS/assets.

### 4. `front/src/container-worker.ts` (NOVO) — Worker fino que roteia pro container

Primeiro instale as duas dependências reais (não hardcode versão — deixe o npm resolver e gravar no
lockfile):

```bash
npm install @cloudflare/containers -w front
npm install -D @cloudflare/workers-types -w front
```

Depois crie `front/src/container-worker.ts`:

```typescript
import { Container, getRandom } from "@cloudflare/containers";

interface Env {
  FRONTEND_CONTAINER: DurableObjectNamespace<FrontendContainer>;
}

export class FrontendContainer extends Container {
  defaultPort = 8080;
  sleepAfter = "10m";
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const container = await getRandom(env.FRONTEND_CONTAINER, 1);
    return container.fetch(request);
  },
};
```

**Por que este arquivo precisa de tratamento especial de tipos:** `front/tsconfig.json` tem
`"lib": ["dom", ...]` (Next.js roda no browser/edge, não no runtime de Workers) — `Request`/`Response`
aí são tipos DOM, e `DurableObjectNamespace` nem existe nesse lib. Sem isolar este arquivo, o `tsc` do
`next build` e o `npm run lint` (eslint-config-next/typescript, type-aware) vão falhar com
"Cannot find name 'DurableObjectNamespace'". O padrão já existe no repo para o caso equivalente do
Worker de backend (`back/tsconfig.json`, que usa `types: ["@cloudflare/workers-types"]` e não inclui
`lib: ["dom"]`) — replique o mesmo princípio aqui, isolado, sem tocar em `back/`:

**a) Crie `front/tsconfig.worker.json` (NOVO, standalone, não estende o tsconfig.json do Next):**

```json
{
  "compilerOptions": {
    "target": "ES2021",
    "lib": ["ES2021"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "types": ["@cloudflare/workers-types"],
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "isolatedModules": true
  },
  "include": ["src/container-worker.ts"]
}
```

**b) Em `front/tsconfig.json`, mude a linha `"exclude": ["node_modules"]` para:**

```json
  "exclude": ["node_modules", "src/container-worker.ts"]
```

**c) Em `front/eslint.config.mjs`, dentro do array de `globalIgnores([...])`, adicione uma linha**
(mesma lista onde já estão `.open-next/**`/`.wrangler/**`):

```javascript
    "src/container-worker.ts",
```

### 5. `front/wrangler.jsonc` (REESCRITO)

Substitua o conteúdo inteiro por:

```jsonc
{
  "$schema": "./node_modules/wrangler/config-schema.json",
  "name": "fraldinha-livre-frontend",
  "main": "src/container-worker.ts",
  "compatibility_date": "2026-05-03",
  "compatibility_flags": ["nodejs_compat"],
  "containers": [
    {
      "class_name": "FrontendContainer",
      "image": "./Dockerfile",
      "max_instances": 1
    }
  ],
  "durable_objects": {
    "bindings": [
      {
        "name": "FRONTEND_CONTAINER",
        "class_name": "FrontendContainer"
      }
    ]
  },
  "migrations": [
    {
      "tag": "v1",
      "new_sqlite_classes": ["FrontendContainer"]
    }
  ]
}
```

`compatibility_date` continua em `"2026-05-03"` (D-021 — piso do wrangler LOCAL pinado; não mude).
Sem `assets`/`binding` — o container serve tudo, não há mais assets estáticos servidos pelo Worker.

### 6. `front/package.json` — remove resquício do adapter OpenNext

1. Delete o arquivo `front/open-next.config.ts`.
2. Remova a devDependency e desinstale de verdade (atualiza o lockfile):
   ```bash
   npm uninstall @opennextjs/cloudflare -w front
   ```
3. Em `front/package.json`, no bloco `"scripts"`, REMOVA as 3 linhas `"preview"`, `"deploy"`,
   `"cf-typegen"` e ADICIONE:
   ```json
   "cf:deploy": "npm run build && wrangler deploy"
   ```
   (script roda a partir de `front/`, mesmo padrão dos scripts existentes).

### 7. Build e validação Docker (o critério real desta fatia)

Rode a partir da RAIZ do repositório (não de `front/`):

```bash
git rev-parse --show-toplevel
docker build -f front/Dockerfile -t fraldinha-livre-frontend .
docker run --rm -d --name fraldinha-livre-frontend-test -p 8080:8080 fraldinha-livre-frontend
```

Aguarde o container subir (poll, não durma um valor fixo às cegas):
```bash
for i in 1 2 3 4 5 6 7 8 9 10; do
  curl -sf http://localhost:8080/ >/dev/null && break
  sleep 2
done
```

Smoke test das 4 rotas — leia os 4 códigos reais, não presuma:
```bash
curl -s -o /dev/null -w "/ -> %{http_code}\n" http://localhost:8080/
curl -s -o /dev/null -w "/catalogo -> %{http_code}\n" http://localhost:8080/catalogo
curl -s -o /dev/null -w "/login -> %{http_code}\n" http://localhost:8080/login
curl -s -o /dev/null -w "/minha-conta -> %{http_code}\n" http://localhost:8080/minha-conta
```

Se qualquer uma não for 200, rode `docker logs fraldinha-livre-frontend-test` e leia o erro real antes
de mexer em qualquer arquivo — **especialmente confira se NÃO é o `EvalError: Code generation from
strings disallowed`**: se esse erro específico reaparecer, é sinal de que o container não está
rodando Node.js completo (bug de configuração desta task), não o bug antigo do adapter.

Encerre o container ao final:
```bash
docker stop fraldinha-livre-frontend-test
```

### 8. Verificação estática (sanity check do isolamento de tipos da task 4)

```bash
cd front
npx tsc --noEmit -p tsconfig.worker.json
```
Deve passar sem erro — prova que `container-worker.ts` tipa certo isolado do resto do app.

## Testes e verificação (OBRIGATÓRIO — D-008)

No `front/` deste worktree, NESTA ORDEM:
1. `npm run lint` — RODE e LEIA o exit real (`npm run lint; echo "EXIT: $?"`); precisa ser EXIT 0.
2. `npm run build` — passa (mesmo build que a task 7 usa dentro do Docker).
3. `npm test` — suíte 100% verde, nenhuma mudança de código de aplicação nesta fatia.
4. Tudo da Tarefa 7 (docker build + docker run + as 4 rotas retornando 200, lidas de verdade).
5. Tarefa 8 (`tsc --noEmit -p tsconfig.worker.json`).
6. `git status` confirmando que `back/` e `packages/contracts/` não têm NENHUM arquivo modificado.

**Loop de encerramento:** se algo falhar, corrigir e re-verificar. MÁXIMO 3 TENTATIVAS.
Após a 3ª falha: PARE. Não improvise, não mude a abordagem por conta própria (ex.: não troque
`node:22-alpine` por outra imagem, não adicione `try/catch` silencioso pra "fazer passar"). Relate o
que falhou, o que tentou em cada tentativa, e o estado atual dos arquivos.

## Critérios de aceite

- [ ] `front/next.config.ts` com `output: "standalone"` e `outputFileTracingRoot` === `turbopack.root`
      (mesma variável `monorepoRoot`, não dois valores calculados separadamente).
- [ ] `.dockerignore` criado na raiz do repo (não em `front/`).
- [ ] `front/Dockerfile` criado, 2 estágios, `node:22-alpine` + `libc6-compat`, build a partir do
      contexto da raiz, caminhos `.next/standalone/front`, `.next/static`, `public` corretos.
- [ ] `front/src/container-worker.ts` criado (`Container` + `getRandom(env.FRONTEND_CONTAINER, 1)`).
- [ ] `front/tsconfig.worker.json` criado; `front/tsconfig.json` exclui `src/container-worker.ts`;
      `front/eslint.config.mjs` ignora o mesmo arquivo. `npx tsc --noEmit -p tsconfig.worker.json`
      passa.
- [ ] `front/wrangler.jsonc` reescrito: `main` aponta pro worker, `containers` com `max_instances`
      (não `instances`), `durable_objects.bindings`, `migrations`; sem resquício de `assets`/binding
      do OpenNext.
- [ ] `@opennextjs/cloudflare` desinstalado (lockfile atualizado); `front/open-next.config.ts`
      removido; scripts `preview`/`deploy`/`cf-typegen` removidos; `cf:deploy` adicionado.
- [ ] `@cloudflare/containers` e `@cloudflare/workers-types` instalados de verdade (via npm, versão
      real gravada no lockfile — não hardcoded no prompt).
- [ ] `docker build` completa sem erro a partir da raiz do monorepo.
- [ ] `docker run` local: as 4 rotas (`/`, `/catalogo`, `/login`, `/minha-conta`) retornam `200`, sem
      `EvalError` nos logs — LIDO de verdade nos códigos e nos logs, não presumido.
- [ ] `npm run lint` EXIT 0; `npm run build` passa; `npm test` 100% verde.
- [ ] `back/` e `packages/contracts/` sem NENHUM diff (`git status` confirma).

## Restrições

- Só os arquivos listados nas Tarefas 1-6 (mais o lockfile raiz, atualizado automaticamente pelos
  comandos `npm install`/`npm uninstall`). Nada em `back/`, `packages/contracts/`, nem em componentes
  de UI. Commits em pt-BR (Conventional Commits). Sem `--no-verify`.
- NÃO presuma resultados — rode e leia. Se o caminho do `.next/standalone` divergir do documentado
  aqui (algo mudou no Next.js entre esta sessão e a execução), PARE e relate o caminho real
  encontrado (`find front/.next/standalone -name server.js`) em vez de adivinhar um ajuste.
- Deploy real (`wrangler deploy`) e validação humana no navegador NÃO fazem parte desta task — ficam
  para uma task separada de coordenador+cliente (pré-requisito: Workers Paid ativado).

## Relatório esperado

`git show --stat <hash>` (ou hashes, se mais de um commit); confirmação de que `back/` e
`packages/contracts/` não aparecem no diff; saída REAL de cada comando da seção "Testes e
verificação" (lint exit lido, build, test, os 4 códigos HTTP do smoke test, `docker logs` se algo
falhou); pendências (se houver); hash(es) final(is).
