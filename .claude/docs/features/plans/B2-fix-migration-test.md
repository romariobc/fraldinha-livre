# B2-fix — Corrigir teste para aplicar a migration real (não SQL duplicado à mão)

**Executor:** sessão Haiku | **Autor:** sessão-mãe/backend (2026-07-19) | **Status:** aguardando execução
**Motivo:** achado no sanity check do B2 (commit `b6aa44b`) pela sessão de backend — não é revisão D-012
formal (essa vem da sessão de frontend depois), é uma correção antes de repassar.

## Objetivo

O `back/test/health.test.ts` atual (commit `b6aa44b`) aplica as migrations com SQL **copiado à mão**
num array dentro do próprio teste (`beforeEach`, `env.DB.exec(query)`), com `IF NOT EXISTS` que **não
existe** no SQL gerado por `drizzle-kit generate`. Isso significa que o teste nunca executa o arquivo
real `back/migrations/0000_charming_mordo.sql` — testa uma cópia manual que pode divergir dele. Além
disso, `back/src/migrations-config.ts` (criado no mesmo commit, com o formato correto `D1Migration[]`
para a API oficial `cloudflare:test`) **existe mas nunca é importado/usado** — código morto.

Corrigir para que o teste aplique a migration a partir de uma fonte única de verdade (o arquivo gerado
ou o `migrations-config.ts` que já espelha ele), nunca uma terceira cópia manual.

## Contexto mínimo

- Worktree: `E:\Labdev\Projetos\fraldinha-livre\.claude\worktrees\blissful-lamport-ccb562`.
- **Não precisa resolver a questão de versão do Node/wrangler** — o `npm test` já roda e passa em
  Node 20.20.2 (só o binário CLI do wrangler exige Node 22, não o vitest-pool-workers). Isso está fora
  do escopo desta correção.
- Arquivos relevantes (já existem, do commit `b6aa44b`):
  - `back/test/health.test.ts` — o teste com o problema.
  - `back/src/migrations-config.ts` — já tem o `D1Migration[]` correto, só não é usado.
  - `back/migrations/0000_charming_mordo.sql` — a migration real gerada por `drizzle-kit generate`.

## Tarefas

1. Ler `back/src/migrations-config.ts` e conferir que o SQL nele bate com
   `back/migrations/0000_charming_mordo.sql` (mesmas colunas, mesma ordem de criação de tabelas,
   mesmo índice). Se houver qualquer divergência entre os dois, corrigir `migrations-config.ts` para
   bater exatamente com o `.sql` gerado (a fonte de verdade é sempre o arquivo `.sql`, nunca o
   inverso).
2. Reescrever `back/test/health.test.ts` para:
   - Importar `env` de `'cloudflare:test'` (não de `'cloudflare:workers'` — confirme qual módulo a
     versão instalada de `@cloudflare/vitest-pool-workers` realmente exige/aceita; se `cloudflare:test`
     não expuser `env` do jeito esperado, documente e ajuste, mas não volte a copiar SQL à mão).
   - Importar `applyD1Migrations` de `'cloudflare:test'` e `migrations` de `'../src/migrations-config'`.
   - No `beforeEach` (ou `beforeAll`, o que fizer mais sentido dado que D1 de teste é resetado entre
     testes — confira o comportamento real rodando e observando se as tabelas persistem entre `it`s),
     chamar `await applyD1Migrations(env.DB, migrations)` — **remover completamente** o array de SQL
     manual que existe hoje no teste.
   - Manter as mesmas 4 asserções que já existem (health 200, tabela orders existe, tabela order_items
     existe, índice idx_orders_uid existe) — não reduzir cobertura.
3. Rodar `cd back && npm test` — confirmar que os 4 testes continuam verdes, agora aplicando a
   migration real via `migrations-config.ts` (que espelha o `.sql` gerado).
4. Corrigir `back/package.json`: trocar as dependências fixadas literalmente como `"latest"` pelas
   versões realmente instaladas (ler os números resolvidos em `back/package-lock.json` — campo
   `"version"` de cada pacote no nível raiz de `node_modules/<pkg>`) usando range de caret (`^x.y.z`),
   igual ao padrão do `front/package.json`. Rodar `npm install` de novo depois de editar para confirmar
   que o lockfile não muda de forma inesperada (deve ficar estável, já que são as mesmas versões só
   escritas explicitamente).
5. Rodar de novo `cd back && npm test` — confirmar verde após o passo 4.

## Testes e verificação (D-008)

1. `cd back && npm test` — 4/4 verdes, migration real (não cópia manual) provadamente aplicada.
2. `cd back && npx tsc --noEmit` (se houver script equivalente; senão pular) — sem erro de tipo.
3. Conferir por leitura (`grep`/`Read`) que `back/test/health.test.ts` NÃO contém mais nenhuma string
   `CREATE TABLE` ou `CREATE INDEX` hardcoded — só a chamada a `applyD1Migrations`.

**Loop:** máximo 3 tentativas para problemas de código/API. Se a API de `cloudflare:test` não expuser
exatamente `applyD1Migrations` como documentado, tente variações razoáveis da mesma lib instalada antes
de desistir; se travar de verdade na 3ª tentativa, PARE e relate o obstáculo exato (não volte a copiar
SQL à mão como solução de contorno — essa é justamente a prática que está sendo corrigida).

## Critérios de aceite

- [ ] `back/test/health.test.ts` não tem mais SQL hardcoded — usa `applyD1Migrations` + `migrations`
      de `migrations-config.ts`.
- [ ] `migrations-config.ts` é de fato importado e usado (deixa de ser código morto).
- [ ] O conteúdo de `migrations-config.ts` bate exatamente com `migrations/0000_charming_mordo.sql`.
- [ ] `back/package.json` sem nenhuma dependência com valor literal `"latest"` — todas com versão
      real resolvida (`^x.y.z`).
- [ ] `npm test` continua 4/4 verde depois de todas as mudanças.
- [ ] Nenhum arquivo fora de `back/` foi tocado.

## Restrições

- **Não** reintroduza SQL duplicado à mão em lugar nenhum do teste.
- **Não** mexa em `back/migrations/*.sql` (a migration gerada é a fonte de verdade — se
  `migrations-config.ts` divergir dela, corrija o `migrations-config.ts`, nunca o `.sql`).
- **Não** tente resolver a questão de Node/wrangler CLI — fora de escopo aqui.
- **Não** use `any`.
- Commit em português, Conventional Commits, mensagem:
  `fix(back): teste aplica migration real via applyD1Migrations, remove SQL duplicado (thread B)`

## Relatório esperado

- Diff/conteúdo final de `health.test.ts` e `migrations-config.ts` (se alterado).
- Saída literal do `npm test` final.
- Confirmação (grep) de que não há mais `CREATE TABLE`/`CREATE INDEX` hardcoded no teste.
- Hash do commit.
- Qualquer divergência encontrada entre `migrations-config.ts` e o `.sql` gerado, e como foi resolvida.
