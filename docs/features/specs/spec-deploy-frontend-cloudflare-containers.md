# Spec — Deploy do Frontend via Cloudflare Containers

**Domínio:** frontend/infra · **Feature relacionada:** substitui a abordagem original de
`spec-deploy-frontend-cloudflare.md` (adapter OpenNext, abandonada) · **Status:** proposta
(brainstorming concluído, aprovado, aguardando plano de implementação)

## Contexto

A tentativa original de deploy do frontend via Cloudflare Workers + adapter `@opennextjs/cloudflare`
travou em dois bugs reais, na ordem em que apareceram:

1. **Resolvido:** Turbopack não atravessava a fronteira do monorepo pra resolver `@contracts`
   (corrigido migrando `front/`+`packages/contracts` pra npm workspaces reais — ver
   `spec-npm-workspaces-front-contracts.md`, commits `1462da7`/`59164ed`).
2. **Bloqueado, sem fix oficial:** com o build funcionando, o runtime local (`wrangler dev` sobre o
   worker gerado pelo adapter) passou a falhar em **todas** as rotas com
   `EvalError: Code generation from strings disallowed for this context`. Causa raiz confirmada
   (via `gh issue view` na issue real do adapter, não só busca): o SDK completo do Firebase
   Firestore usa `@grpc/proto-loader` → `protobufjs`, que gera código em tempo de execução via
   `new Function()` — o isolamento V8 dos Workers proíbe isso por design de segurança. É específico
   do Next.js 16 (funcionava no 15), issue aberta, ainda sem correção oficial.

Depois de comparar 4 alternativas (trocar pra `firebase/firestore/lite`; Firebase App Hosting;
Cloud Run/GCP puro; Cloudflare Containers), o cliente decidiu por **Cloudflare Containers**:
elimina a causa raiz por completo (roda Node.js num container real, sem sandbox V8 — a classe
inteira do bug deixa de existir, não só esta instância), mantém tudo numa única conta/console
(honra o motivo original da D-029), e o WAF/DDoS da Cloudflare continua protegendo a origem
normalmente (confirmado: a proteção de borda da Cloudflare é desacoplada de onde o servidor roda —
funciona pra qualquer origem, containerizada ou não).

### Decisões de escopo (brainstorming com o cliente, 2026-07-24)

- **1 instância de container** para esta fatia (MVP, tráfego baixo). Sem balanceamento de carga
  ainda — `getRandom(binding, 1)` sempre resolve pra mesma única instância; subir o número depois é
  só mudar um parâmetro, não uma mudança estrutural.
- **`sleepAfter: "10m"`** — mesmo valor do exemplo oficial da Cloudflare, equilíbrio razoável entre
  custo (não fica ligado à toa) e cold start (não dorme com frequência excessiva).
- **Substitui, não coexiste com, a abordagem OpenNext.** `@opennextjs/cloudflare`,
  `open-next.config.ts`, e os scripts `preview`/`deploy`/`cf-typegen` do adapter são removidos —
  não ficam como código morto ao lado da nova abordagem.
- **`transpilePackages`/`turbopack.root` (da migração de workspaces) são mantidos.** São mecanismos
  do Next.js core, não do adapter OpenNext — continuam necessários pra qualquer `next build` neste
  monorepo, independente de onde/como o resultado é hospedado depois.

## Arquitetura

```
front/next.config.ts
  + output: "standalone"
  + outputFileTracingRoot: <raiz do monorepo> (MESMO valor de turbopack.root —
    evita o aviso "must have the same value" e ancora a estrutura do
    standalone corretamente; sem isto o Next usa front/ como raiz sozinho,
    conflitando com turbopack.root, do mesmo jeito que já vimos no log do
    adapter OpenNext antes)
  turbopack.root e transpilePackages: MANTIDOS sem alteração

front/Dockerfile (NOVO)
  Multi-stage, node:22-alpine.
  CONTEXTO DE BUILD = RAIZ DO MONOREPO, nao front/ isolado — este app usa
  npm workspaces (front/ + packages/contracts), o Dockerfile precisa copiar
  e instalar a partir da raiz pra @fraldinha-livre/contracts resolver
  corretamente, senao reproduz o mesmo bug do @contracts pela 3a vez,
  agora dentro do Docker.
  Estagio final copia de .next/standalone/front/ (NAO .next/standalone/
  direto — a saida standalone em monorepo aninha pelo caminho relativo do
  app a raiz, confirmado pelo erro real que ja vimos: ".next/standalone/
  front/.next/server/pages-manifest.json"). O CAMINHO EXATO deve ser
  verificado contra a saida real de um build, nao assumido — parte da
  tarefa de implementacao.

front/src/container-worker.ts (NOVO)
  class FrontendContainer extends Container {
    defaultPort = 8080
    sleepAfter = "10m"
  }
  export default { fetch(request, env) { usa getRandom(env.FRONTEND_CONTAINER, 1) } }

front/wrangler.jsonc (REESCRITO)
  main: "src/container-worker.ts" (antes: ".open-next/worker.js")
  + containers: [{ class_name: "FrontendContainer", image: "./Dockerfile", instances: 1 }]
  + durable_objects.bindings: [{ class_name: "FrontendContainer", name: "FRONTEND_CONTAINER" }]
  + migrations: [{ new_sqlite_classes: ["FrontendContainer"], tag: "v1" }]
  compatibility_date mantido em "2026-05-03" (limite do wrangler LOCAL
  pinado, D-021 — nao afeta o deploy real via Workers Builds/Cloudflare)
  assets/binding do adapter OpenNext REMOVIDOS (nao ha mais assets
  estaticos servidos assim — o proprio container serve tudo)

front/package.json
  REMOVE: devDependency @opennextjs/cloudflare
  REMOVE: arquivo open-next.config.ts
  REMOVE: scripts preview/deploy/cf-typegen (eram do adapter OpenNext)
  ADD: script "cf:deploy": "npm run build && wrangler deploy" (a partir de front/)
  MANTEM: devDependency wrangler (agora usado pro deploy de Containers,
  nao mais do adapter)

back/                                    packages/contracts/
  INTOCADOS — nenhuma mudanca               INTOCADO — nenhuma mudanca
```

## Pré-requisitos humanos (coordenador + cliente)

- **Ativar o Workers Paid plan** ($5/mês) no dashboard da Cloudflare antes do primeiro deploy real
  — Containers exige esse plano, confirmado na documentação oficial.
- **Docker instalado e rodando na máquina de desenvolvimento** para build/teste local da imagem
  antes do deploy real (confirmado presente nesta máquina: Docker 27.5.1, Docker Desktop).

## Testes / Validação

Dado que já erramos duas vezes com suposições sobre como o Next.js lida com monorepo (o alias
`@contracts` e o path do symlink do workspace), a validação real desta fatia não é `tsc`/lint —
é rodar a imagem Docker de verdade e bater nas rotas:

- `docker build` completa sem erro, a partir do contexto correto (raiz do monorepo).
- Container roda localmente (`docker run`), expõe a porta configurada.
- Smoke test das mesmas 4 rotas já usadas nas tentativas anteriores (`/`, `/catalogo`, `/login`,
  `/minha-conta`) retornando `200` — **este é o critério que prova que o EvalError não ocorre
  mais** (Node.js completo, sem sandbox V8, o SDK cheio do Firestore funciona sem troca de código).
- Suíte de `front/` continua 100% verde (nenhuma mudança de código de aplicação nesta fatia).
- `back/` e `packages/contracts` sem diff.

## Critérios de aceite

- [ ] `front/next.config.ts` com `output: "standalone"` e `outputFileTracingRoot` igual a
      `turbopack.root`.
- [ ] `front/Dockerfile` criado, build a partir do contexto da raiz do monorepo, referenciando o
      caminho real (verificado, não assumido) da saída standalone aninhada.
- [ ] `front/src/container-worker.ts` criado (classe `Container` + `fetch` handler via
      `getRandom(..., 1)`).
- [ ] `front/wrangler.jsonc` reescrito para Containers (sem resquício de config do adapter
      OpenNext).
- [ ] `@opennextjs/cloudflare`, `open-next.config.ts`, scripts `preview`/`deploy`/`cf-typegen`
      removidos.
- [ ] `docker build` + `docker run` local: as 4 rotas de smoke test retornam `200`, sem
      `EvalError`.
- [ ] Suíte de `front/` verde, `tsc`/lint limpos.
- [ ] `back/` e `packages/contracts` sem diff.
- [ ] Deploy real (`wrangler deploy`) — pré-requisito: Workers Paid ativado — fica para uma task
      separada de coordenador+cliente (mesmo padrão de B9/P3), não é parte da validação local desta
      spec.

## Fora de escopo (registrado, não é esquecimento)

- **Deploy de produção real e validação humana no navegador** — task separada, coordenador+cliente,
  depende do Workers Paid estar ativo.
- **Múltiplas instâncias / balanceamento de carga** — YAGNI pro tráfego atual; parâmetro fácil de
  ajustar depois (`instances` no wrangler.jsonc + o segundo argumento de `getRandom`).
- **CI/CD via Workers Builds** — a spec de deploy original já cobria isso (conexão do repo no
  dashboard); não muda com Containers, mas não foi reconfirmado nesta spec — verificar se o
  Workers Builds detecta automaticamente o `containers` field ou se precisa de ajuste manual do
  build command.

## Riscos

| Risco | Mitigação |
|---|---|
| Estrutura aninhada do standalone output em monorepo ser diferente do esperado | Task de implementação inspeciona a saída real (`ls -R .next/standalone`) antes de fixar os caminhos do Dockerfile — não assume, verifica. |
| `npm ci`/`npm install` dentro do Docker não resolver o workspace corretamente (mesma classe de bug já vista 2x) | Contexto de build = raiz do monorepo, copiando `packages/contracts` antes do build — replica exatamente a estrutura que já provou funcionar localmente. |
| Docker Desktop não estar rodando no momento da validação | Confirmado presente e iniciado nesta sessão antes de começar a implementação. |
| `wrangler dev`/deploy de Containers ter alguma peculiaridade não documentada nesta spec | Mesma disciplina de BLOCKED explícito das tentativas anteriores — reportar com erro completo em vez de forçar workaround. |

## Referências

- Tentativa anterior (abandonada): `spec-deploy-frontend-cloudflare.md`,
  `deploy-frontend-cloudflare-breakdown.md`.
- Migração de workspaces (pré-requisito, já feita): `spec-npm-workspaces-front-contracts.md`.
- Causa raiz do EvalError: issue `opennextjs-cloudflare#1301` (confirmada via `gh issue view`).
- Doc oficial de Containers: `containers` field no wrangler config exige Durable Object
  correspondente (`developers.cloudflare.com/workers/wrangler/configuration/#containers`).
- Relatório de decisão (artifact) com a comparação completa das 4 alternativas consideradas.
