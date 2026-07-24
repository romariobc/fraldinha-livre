# Spec — npm workspaces (front/ + packages/contracts)

**Domínio:** frontend/infra · **Feature relacionada:** desbloqueia a Task 2 do
`deploy-frontend-cloudflare-breakdown.md` (adapter OpenNext) · **Status:** proposta (brainstorming
concluído, aprovado por ambas as sessões, aguardando plano de implementação)

## Contexto

A Task 2 do deploy do frontend (adapter `@opennextjs/cloudflare`) travou (BLOCKED) com
`Module not found: Can't resolve '@contracts'`. Investigação (duas sessões, independentemente)
confirmou a causa raiz: `front/tsconfig.json` mapeia `@contracts` para
`../packages/contracts/src/index.ts` — um caminho que sai da raiz de `front/`, sem nenhum
mecanismo de resolução de módulo real (não há `package.json` na raiz do repo, não há npm
workspaces). O Turbopack (bundler usado por `next build` no Next.js 16, confirmado no log de
build) vê o alias no `tsconfig.json` mas não consegue atravessar a fronteira do projeto pra
resolvê-lo — mesma classe de bug que já tinha mordido o Turbopack em modo dev antes (B9,
resolvido então com `turbopack.root`), agora sem escape equivalente no build de produção.
Tentativas de contornar via config (`outputFileTracingRoot`, `webpack.resolve.alias`,
`resolve.roots`) ou bump de versão do Next.js (pra `16.2.11`, satisfazendo o peer dependency do
adapter) não resolveram — e o próprio bump, embora seguro e útil por si (testado, suíte 298/298
verde), não tinha relação causal com o bug.

Confirmado por grep: **`back/` não importa `@contracts`** — só `front/` (8 arquivos). Hoje
existem 3 `package-lock.json` independentes (`front/`, `back/`, `packages/contracts/`), cada
pasta seu próprio `npm install`.

### Decisões de escopo (brainstorming com o cliente e a sessão de frontend, 2026-07-24)

- **Só `front/` e `packages/contracts` entram no workspace.** `back/` não importa `@contracts`
  hoje e já está estável em produção (Cloudflare Workers) — tocar nele seria risco sem ganho
  funcional (YAGNI). Fica com seu próprio `package.json`/`package-lock.json`, inalterado.
- **O alias `@contracts` é mantido** nos 8 arquivos de `front/` que já o usam — não renomeia
  para o nome real do pacote (`@fraldinha-livre/contracts`, já declarado em
  `packages/contracts/package.json`). Menor diff: só `tsconfig.json`/`package.json`/
  `next.config.ts` mudam, nenhum arquivo de aplicação é tocado.
- **`transpilePackages` mantido explícito, mesmo com risco de redundância.** A sessão de
  frontend observou que a doc do Next 16 (bundlada no projeto) diz que o Turbopack já transpila
  pacotes de workspace automaticamente nos dois routers — então
  `transpilePackages: ['@fraldinha-livre/contracts']` pode ser desnecessário. Mantido mesmo assim
  nesta fatia (default seguro e documentado, dado que este projeto já foi mordido duas vezes por
  suposições otimistas sobre resolução de módulo em monorepo); fica registrado como candidato a
  remoção futura, com teste antes — não investigado agora (fora de escopo, evitar scope creep).

## Arquitetura

```
package.json (NOVO, raiz do repo)
  { "workspaces": ["front", "packages/contracts"] }
  Sem scripts — so a declaracao do workspace.

packages/contracts/package.json
  + "exports": { ".": "./src/index.ts" }
  (hoje sem entry point declarado — precisa disso pra virar modulo Node resolvivel)

front/package.json
  + "@fraldinha-livre/contracts": "*" (dependencies)
  `npm install` na RAIZ cria o symlink:
  front/node_modules/@fraldinha-livre/contracts -> packages/contracts

front/tsconfig.json
  "paths": {
    "@contracts": ["@fraldinha-livre/contracts"],
    "@contracts/*": ["@fraldinha-livre/contracts/*"]
  }
  (antes apontava pra "../packages/contracts/src/..." — um caminho de
  arquivo cru que sai da raiz de front/. Agora aponta pra OUTRO
  especificador de modulo, "@fraldinha-livre/contracts" — nao mais um
  caminho de arquivo — deixando a resolucao de node_modules real (via
  o symlink que o workspace cria) fazer o trabalho, sem assumir se o
  npm hospeda o symlink dentro de front/node_modules/ ou na raiz do
  repo. E essa a mudanca que resolve o bug: o bundler nunca mais
  precisa atravessar a fronteira do projeto com um caminho de arquivo
  cru — so resolve um nome de pacote, do jeito que qualquer bundler ja
  sabe fazer.)

front/next.config.ts
  + transpilePackages: ['@fraldinha-livre/contracts']

REMOVIDOS:
  front/package-lock.json
  packages/contracts/package-lock.json
  (colapsam num package-lock.json unico na raiz)

INTOCADO:
  back/package.json, back/package-lock.json, back/tsconfig.json — nenhuma mudanca.
```

## Mudança de fluxo de trabalho

- **Instalar dependência nova** em `front/` ou `packages/contracts/`: passa a rodar `npm install`
  a partir da **raiz** do repo (não mais dentro da pasta individual).
- **Rodar teste/lint/build**: continua idêntico (`cd front && npm test`, `cd front && npm run
  lint`, etc.) — o Node resolve `node_modules` subindo diretórios normalmente, isso não muda.
- **`back/`**: nenhuma mudança de fluxo — `cd back && npm install` continua funcionando exatamente
  como antes, independente do workspace novo.

## Testes

- `front/src/lib/__tests__/contracts-alias.test.ts` (já existe, é o sensor que guarda a resolução
  do alias `@contracts`) — deve continuar passando sem nenhuma mudança no próprio arquivo de
  teste, só na forma como `@contracts` resolve por baixo.
- Suíte completa de `front/` (298 testes) deve continuar 100% verde após a migração.
- Suíte completa de `packages/contracts` deve continuar verde (roda de dentro da própria pasta,
  `cd packages/contracts && npm test`, inalterado).
- Suíte completa de `back/` deve continuar verde, comprovando que nada vazou pra lá.
- **Critério de aceite final desta spec:** `cd front && npm run build` (o `next build` puro, que
  foi onde o erro apareceu originalmente via Turbopack, antes mesmo do wrapper do OpenNext entrar
  em ação) completa **sem o erro `Module not found: Can't resolve '@contracts'`**. Não precisa
  necessariamente rodar `npm run preview` (build + wrangler dev) aqui — isso é retomar a Task 2 do
  plano de deploy, fora desta spec.

## Critérios de aceite

- [ ] `package.json` na raiz com `"workspaces": ["front", "packages/contracts"]`.
- [ ] `packages/contracts/package.json` com `"exports"` declarado.
- [ ] `front/package.json` com `@fraldinha-livre/contracts` como dependency de workspace.
- [ ] `front/tsconfig.json` com os `paths` de `@contracts`/`@contracts/*` apontando pro
      especificador de módulo `@fraldinha-livre/contracts` (não mais um caminho de arquivo cru
      pra fora de `front/`).
- [ ] `front/next.config.ts` com `transpilePackages: ['@fraldinha-livre/contracts']`.
- [ ] `front/package-lock.json` e `packages/contracts/package-lock.json` removidos; um
      `package-lock.json` na raiz cobrindo os dois.
- [ ] `back/` inalterado — `package.json`, `package-lock.json`, `tsconfig.json` sem diff.
- [ ] Suítes de `front/`, `back/`, `packages/contracts` todas verdes; `tsc --noEmit` limpo nos
      três.
- [ ] `cd front && npm run build` completa sem o erro de `@contracts` — não precisa
      necessariamente completar TODO o smoke test do deploy aqui (isso é escopo da Task 2
      retomada), só provar que o bloqueio específico desta spec foi removido.

## Fora de escopo (registrado, não é esquecimento)

- **Incluir `back/` no workspace** — sem necessidade funcional hoje (não importa `@contracts`);
  reabrir se/quando `back/` precisar consumir contratos compartilhados (ex.: quando `/catalogo`
  migrar pra consumir o backend real de produtos, mencionado como fatia futura na spec de
  Produtos).
- **Renomear os imports de `@contracts` para `@fraldinha-livre/contracts`** nos 8 arquivos — só o
  mecanismo de resolução muda, não o nome usado no código.
- **Remover `transpilePackages`** mesmo que possivelmente redundante com o Turbopack — candidato a
  limpeza futura, precisa de teste dedicado antes, não decidido agora.
- **Retomar a Task 2 do plano de deploy** (adapter OpenNext) — spec separada já existe
  (`spec-deploy-frontend-cloudflare.md`); esta spec só desbloqueia, não reexecuta aquela task.

## Riscos

| Risco | Mitigação |
|---|---|
| `npm install` na raiz falhar por conflito de versão entre deps de `front/` e `packages/contracts` | Ambos já compartilham o ecossistema (TypeScript, Vitest) com versões próximas — checar `npm install` com `--dry-run` antes de aplicar de verdade. |
| Migração afetar `back/` por engano (arquivo tocado sem querer) | Critério de aceite explícito: diff de `back/` deve ser vazio. Revisão confere isso especificamente. |
| `contracts-alias.test.ts` mascarar uma resolução errada (ex.: symlink apontando pro lugar errado) | Teste já existe e é específico o suficiente (importa e valida um schema real) — se a resolução quebrar, ele falha. |
| Regressão silenciosa em `packages/contracts` por ganhar um consumidor via symlink pela primeira vez | Rodar a suíte de `packages/contracts` isoladamente também, não só a de `front/`. |

## Referências

- Bloqueio original: relatório BLOCKED da Task 2, `deploy-frontend-cloudflare-breakdown.md`.
- Investigação da causa raiz: mensagens cross-session desta sessão (2026-07-24), confirmando
  Turbopack + `outputFileTracingRoot`/`turbopack.root` em conflito.
- Precedente do mesmo bug em dev: B9, `turbopack.root` em `front/next.config.ts` (ver
  `.claude/context/estado/progresso.md`, estado 2026-07-21).
- Mecanismo oficial do Next.js: `front/node_modules/next/dist/docs/01-app/02-guides/package-bundling.md`
  (`transpilePackages`).
- Nome real do pacote já declarado: `packages/contracts/package.json` (`@fraldinha-livre/contracts`).
