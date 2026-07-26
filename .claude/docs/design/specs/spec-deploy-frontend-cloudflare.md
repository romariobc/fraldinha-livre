# Spec — Deploy do Frontend em Produção (Cloudflare Workers + OpenNext)

**Domínio:** frontend/infra · **Feature relacionada:** nenhuma feature numerada — infraestrutura de
deploy, primeira vez que o front sai de `npm run dev` local · **Status:** proposta (brainstorming
concluído, aguardando aprovação do plano de implementação)

## Contexto

O backend (feature 006) já está em produção na Cloudflare desde a fatia 1 (B9): Workers + D1, decidido
em D-026/D-027. O frontend Next.js (`16.2.4`, React `19.2.4`) segue rodando **só localmente**
(`npm run dev`), sem nenhum deploy de produção até hoje.

**D-029** (`.claude/docs/decisoes.md`, emenda a D-001/D-027, corrigida no commit `054cf41`) já fechou a
decisão de **plataforma**: o frontend também vai para **Cloudflare Workers**, usando o adapter
`@opennextjs/cloudflare` — não Cloudflare Pages (a própria Cloudflare está descontinuando Pages em favor
de Workers + Static Assets) e não Firebase App Hosting (exige plano Blaze, ~US$9,37/mês de piso; e não é
"verified adapter" do Next.js — no mesmo balde de risco que o Cloudflare, ver Riscos abaixo). Firebase
continua sendo usado **só como serviço de autenticação** (Google Sign-In + Firestore para perfil), papel
que já tinha desde D-010/005a.

Esta spec cobre **o que falta decidir depois da escolha de plataforma**: como validar a compatibilidade
do adapter antes de comprometer o trabalho, como nomear/configurar o Worker, como resolver CORS entre os
dois Workers, CI/CD, e o que fica deliberadamente fora de escopo nesta primeira fatia.

### Decisões de escopo (brainstorming com o cliente, 2026-07-23/24)

- **Validação antes de comprometer.** O Next.js 16 tem uma Deployment Adapter API oficial nova
  (`adapterPath`); hoje só Vercel e Bun são "verified adapters" (rodam o test suite oficial). Cloudflare
  **e** Firebase App Hosting estão os dois na lista "Other Platforms" (integrações próprias, não
  verificadas pelo time do Next.js) — o risco de compatibilidade é simétrico entre as duas alternativas,
  não uma desvantagem exclusiva do Cloudflare. Mesmo assim, antes de configurar o deploy real, a primeira
  tarefa do plano é um **spike de validação**: scaffold do adapter sobre o app real, build, rodar local
  via `wrangler dev`/preview, confirmar que as rotas que o app usa de fato (login Firebase, client
  components, `/catalogo`, `/checkout`, etc.) funcionam no runtime `workerd`.
- **Sem domínio próprio ainda.** Lança no subdomínio gratuito `*.workers.dev`. Domínio próprio fica para
  quando o cliente registrar um.
- **CORS não é eliminado por estar na mesma conta Cloudflare — correção registrada.** Front e backend
  são dois Workers com hostnames diferentes (`fraldinha-livre-frontend.romariobc.workers.dev` vs
  `fraldinha-livre-backend.romariobc.workers.dev`). Toda chamada feita pelo navegador (a maioria do
  tráfego hoje — o app é majoritariamente client-side) continua sendo cross-origin e precisa de CORS,
  igual antes. O ganho real de estar na mesma conta é operacional (um `wrangler`/console/MCP) — **não**
  técnico-arquitetural. Service Bindings eliminariam CORS só em chamada servidor-a-servidor (SSR do
  front chamando o backend direto), que este app não usa hoje.
- **CI/CD via Cloudflare Workers Builds (nativo), não GitHub Actions customizado.** Conectar o Worker ao
  repo direto no dashboard da Cloudflare dá deploy automático no push da branch de produção **e** preview
  URL automática por PR (comentada no PR), sem workflow próprio para manter — decidido depois de
  confirmar que esse recurso é real e documentado (preview URLs por branch/versão desde jul/2025).
- **Produção + preview por PR**, ambos via Workers Builds.
- **Login Google não funciona em preview URLs — limitação aceita, não resolvida nesta fatia.** Firebase
  Auth exige "authorized domains" com match exato; não aceita wildcard para os subdomínios dinâmicos que
  o Workers Builds gera por branch/PR. Preview serve para validar UI/páginas públicas (catálogo,
  landing); fluxos que exigem login continuam sendo testados via `npm run dev` local, como hoje, até
  existir domínio próprio.

## Arquitetura

```
front/                                          back/ (existente, 1 mudança)
  wrangler.jsonc (NOVO)                           src/index.ts
    name: "fraldinha-livre-frontend"                ALLOWED_ORIGIN (linha 12) ganha o padrao de
    main: gerado pelo adapter OpenNext              producao + preview do front, alem do localhost
    compatibility_date + nodejs_compat              existente (regex, nao lista fixa — preview URLs
  open-next.config.ts (NOVO)                        tem host dinamico por branch/versao)
    defineCloudflareConfig() (padrao)               back/test/cors.test.ts ganha os casos novos
  next.config.ts
    ajustes minimos exigidos pelo adapter
    (confirmar no spike quais)
```

- **Nome do Worker:** `fraldinha-livre-frontend` — espelha `fraldinha-livre-backend`, já existente.
- **Padrão de CORS proposto** (a validar/testar na task de implementação, não fixado aqui):
  `origem == localhost (dev, já existe)` OU `origem == https://fraldinha-livre-frontend.romariobc.workers.dev`
  (produção) OU `origem casa com https://<branch-ou-versao>-fraldinha-livre-frontend.romariobc.workers.dev`
  (preview, prefixo dinâmico). Rotas públicas (`GET /products`, `GET /health`) continuam acessíveis de
  preview; rotas autenticadas (`/orders/*`) na prática só respondem 401 em preview mesmo com CORS OK,
  porque o login não funciona lá (ver Decisões de escopo) — comportamento aceito, não é bug.
- **Variáveis de ambiente:** `NEXT_PUBLIC_BACKEND_URL=https://fraldinha-livre-backend.romariobc.workers.dev`
  e `NEXT_PUBLIC_USE_BACKEND=true`, configuradas como build variables no Workers Builds (não em
  `.env.local`, que é gitignored por worktree — mesmo gotcha já documentado na memória do projeto).

## Pré-requisitos humanos (coordenador + cliente, não execução autônoma — mesmo padrão de B9/P3)

- Conectar o repositório GitHub ao novo Worker via dashboard da Cloudflare (Workers Builds).
- Configurar as build variables (`NEXT_PUBLIC_BACKEND_URL`, `NEXT_PUBLIC_USE_BACKEND`) no Workers Builds.
- Adicionar o domínio de produção (`fraldinha-livre-frontend.romariobc.workers.dev`) em
  **Firebase Console → Authentication → Settings → Authorized domains** — sem isso, login Google quebra
  em produção (mesma classe de gotcha já documentada nesta memória de projeto).

## Testes

- `back/test/cors.test.ts` — casos novos: origem de produção do front permitida; origem de preview
  (`abc123-fraldinha-livre-frontend.romariobc.workers.dev`, formato versão) permitida; origem de preview
  por branch (`minha-branch-fraldinha-livre-frontend.romariobc.workers.dev`) permitida; origem
  desconhecida continua rejeitada (regressão do caso já existente).
- Spike de validação (task 1 do plano): não é teste automatizado — é um scaffold descartável/dry-run
  para provar que o adapter funciona com o app real antes de configurar o deploy de verdade.
- Validação humana no navegador (ao final): login Google + catálogo + checkout completo contra o
  frontend de produção real (mesmo roteiro já usado em B9/P3), confirmando que o front deployado fala
  com o backend de produção sem regressão.

## Critérios de aceite

- [ ] Spike de validação do adapter OpenNext contra Next.js `16.2.4` concluído — rotas reais do app
      confirmadas funcionando via `wrangler dev`/preview local antes de prosseguir.
- [ ] `front/wrangler.jsonc` + `front/open-next.config.ts` criados, Worker nomeado
      `fraldinha-livre-frontend`.
- [ ] `back/src/index.ts` (linha 12, `ALLOWED_ORIGIN`) atualizado para aceitar produção + preview do
      front, com testes novos em `back/test/cors.test.ts` (suíte completa do `back/` continua verde).
- [ ] Workers Builds conectado ao repo (dashboard) — deploy automático + preview URL por PR funcionando.
- [ ] Domínio de produção autorizado no Firebase Auth.
- [ ] Build variables (`NEXT_PUBLIC_BACKEND_URL`, `NEXT_PUBLIC_USE_BACKEND=true`) configuradas no
      Workers Builds.
- [ ] Validação humana completa no navegador: login Google, catálogo, checkout, painel do fornecedor —
      tudo funcionando na URL de produção real.
- [ ] Suíte de `front/` e `back/` verdes, `tsc`/`lint` exit 0.

## Fora de escopo (registrado, não é esquecimento)

- **Domínio próprio** — fica para quando o cliente registrar um; a decisão de zona/DNS/subdomínio único
  para eliminar CORS de vez (front e back sob o mesmo domínio exato) fica registrada como opção futura,
  não decidida agora.
- **Service Bindings** (RPC direto front→back sem HTTP público) — só faz sentido se/quando o front
  ganhar rotas SSR que chamem o backend server-side; hoje o app é majoritariamente client-side.
- **Ambiente de staging com login funcional** (branch estável com preview URL fixa, autorizada uma vez
  no Firebase) — cliente optou por aceitar a limitação de login em preview por agora; revisitar se virar
  fricção real no dia a dia.
- **CORS para rotas de fatias futuras** (sync do painel do fornecedor, estoque, feature 007) — a regex
  desta fatia já é por padrão de host (não lista fixa de rotas), então cobre rotas novas automaticamente;
  nenhuma mudança de CORS adicional prevista quando essas fatias chegarem, só documentado aqui para não
  reabrir a dúvida depois.

## Riscos

| Risco | Mitigação |
|---|---|
| Adapter OpenNext não é "verified" pelo Next.js 16 — feature específica pode ter gap (risco simétrico com Firebase App Hosting, não exclusivo do Cloudflare) | Spike de validação como primeira tarefa, antes de qualquer configuração de deploy real. Se travar, decidir entre workaround, downgrade controlado do Next, ou reabrir a comparação de plataforma com dado real em mãos. |
| Regex de CORS nova permitir origem indevida (preview URL forjada) | Testes dedicados cobrindo origem válida de preview vs. origem arbitrária/maliciosa — mesmo padrão do teste "origin desconhecido nao e refletido" já existente. |
| Login quebrado em preview confundido com bug por quem testar | Documentado explicitamente aqui e no critério de aceite — mesma disciplina já usada para a nota de escopo do Perfil do Fornecedor. |
| Cliente esquece de autorizar o domínio no Firebase antes do primeiro teste em produção | Listado como pré-requisito humano explícito, não implícito. |

## Referências

- Decisão de plataforma: `.claude/docs/decisoes.md` (D-029, commit `054cf41`),
  `.claude/docs/design/adr/adr-001-estrategia-backend.md` (§13).
- CORS atual: `back/src/index.ts:10-21`, `back/test/cors.test.ts`.
- Padrão de deploy coordenador+cliente já usado: B9 (`.claude/context/estado/progresso.md`, estado
  2026-07-21), P3 (estado 2026-07-23).
- Gotcha de env var gitignored por worktree: memória de sessão `worktree-env-local-gotcha`.
- Next.js Deployment Adapter API / status "verified adapter": `front/node_modules/next/dist/docs/01-app/01-getting-started/17-deploying.md`,
  `front/node_modules/next/dist/docs/01-app/02-guides/deploying-to-platforms.md`.
