# AUDIT-001-QA — revisão corrigida e regressões

Data: 2026-09-21. Base: main, 4c92045, acrescida das alterações locais desta rodada, ainda sem commit. Escopo: harness de QA e auditoria administrativa. Agendamento adiado pelo usuário.

> Atualização de 2026-09-22: TOOLING-001 concluída após validação independente no Node 22.23.2. Lockfile sincronizado e asserção de diagnóstico reforçada. [Evidência atual](TOOLING-001-validacao-2026-09-22.md). As referências abaixo à atualização pendente do host descrevem a rodada de 2026-09-21 e foram superadas.

## Veredito

Correções locais de atomicidade, consulta paginada, interface e qualidade de lint (TOOLING-001) verificadas com sucesso. A revisão está concluída; lint global passa com 0 erros (saída 0) e 19 avisos triados. AUDIT-001 permanece in_progress: homologação remota, migration 0010 e validação de claims em ambiente real ainda não foram executadas.

O harness orientou a entrada e a execução, mas a primeira revisão inferiu cobertura a partir de testes verdes e aprovou critérios sem evidência suficiente. O checklist e a skill qa agora exigem matriz por critério, cenários negativos e separação entre revisão concluída e produto aprovado. Essas instruções reduzem o risco, mas dependem de cumprimento pelo agente; não são um bloqueio automático de CI.

## Evidência por critério

| Critério | Evidência nesta rodada | Resultado e limite |
|---|---|---|
| Contratos e justificativa | Testes contracts; audit-trail.test.ts rejeita payload inválido | Passou localmente |
| Permissões | Testes da rota: anônimo, comprador, fornecedor e claims conflitantes | Passou; verificador de token simulado |
| Moderação e auditoria indivisíveis | D1 batch; triggers provocam falha na inserção e na atualização; asserções verificam rollback | Passou no runtime D1 local, sem prova remota |
| Evento e correlação | Teste verifica requestId, justificativa e metadata oldActive/newActive | Passou |
| Consulta com filtros/paginação | SQL where/limit/offset/count; 23 eventos, 22 filtrados, páginas 20+2 sem repetição | Passou; ordenação desempata por id |
| Navegação da interface | AdminAuditTab.test.tsx: próxima/anterior, limites, filtro retorna à página 1 | Passou em JSDOM |
| Modal | AdminProductsTab.test.tsx: razão vazia/curta, trim, PATCH, sucesso e erro | Passou em JSDOM |
| Fonte dos tipos | AdminProductsTab usa @contracts | Corrigido; tipos e lint dirigido passaram |
| Qualidade global | ESLint executa após fixar TS 5.9.3 na raiz; 22 erros corrigidos via TOOLING-001 | Passou: 0 erros, 19 avisos triados |
| Produção, migrações e claims | Nenhuma consulta remota nesta rodada | Não verificado; relatos anteriores são históricos |

Prova de sensibilidade: o teste “falha da auditoria não altera o produto” foi executado temporariamente contra a rota da base 4c92045 e falhou (produto alterado apesar de erro 500). Restaurada a correção, os 11 testes passaram. O teste detecta a regressão real.

## Comandos e resultados

| Comando | Saída | Resultado |
|---|---|---|
| npm test --workspace packages/contracts | 0 | 6 arquivos, 41 testes |
| npm test --workspace back | 0 | 26 arquivos, 274 testes |
| npm test --workspace front | 0 | 59 arquivos, 594 testes |
| npm exec --workspace packages/contracts -- tsc --noEmit -p tsconfig.json | 0 | Sem erros |
| npm exec --workspace back -- tsc --noEmit -p tsconfig.json | 0 | Sem erros |
| npm exec --workspace front -- tsc --noEmit -p tsconfig.json | 0 | Sem erros |
| npm exec --workspace front -- eslint . | 0 | 0 erros, 19 avisos triados |
| npm exec --workspace front -- eslint src/components/admin/AdminAuditTab.tsx src/components/admin/AdminProductsTab.tsx src/components/admin/__tests__/AdminAuditTab.test.tsx src/components/admin/__tests__/AdminProductsTab.test.tsx | 0 | Escopo alterado limpo |
| npm test --workspace back -- test/audit-trail.test.ts | 0 | 11 testes, incluindo asserção final de metadata |
| npm test --workspace front -- src/components/admin/__tests__/AdminAuditTab.test.tsx src/components/admin/__tests__/AdminProductsTab.test.tsx | 0 | 6 testes após ajuste final de loading |

As suítes completas somam 909 testes (41 contracts, 274 back, 594 front). Após os ajustes de lint e asserções, os testes e tipos dos três workspaces continuam 100% verdes. Build e validação visual em navegador não executados.

Ambiente local: Windows, Node 20.20.2 no host. Manifestos (raiz, front, back, contracts), .nvmrc e back/.node-version foram unificados em Node >=22.0.0, restabelecendo coerência com o package-lock.json e o Dockerfile do frontend (node:22-alpine).

## Pendências delimitadas

- TOOLING-001: reaberta (in_progress). Todos os manifestos e configurações do repositório exigem formalmente Node >=22.0.0 (consistente com package-lock.json, Dockerfile e Cloudflare Workers). Mocks nos testes foram refatorados com tipagem estrita de domínio (AuthUser, UserProfile) eliminando double-casts (`as unknown as`). 0 erros de lint e 19 avisos triados. Falta unicamente a atualização do executável Node no host Windows do desenvolvedor para 22+ para encerramento total.
- Homologar AUDIT-001 com ambiente/claims reais, estado da migration 0010 e publicação confirmados na ocasião. A configuração local do frontend é Workers Containers (front/wrangler.jsonc), não Cloudflare Pages. Não se afirma o estado atual remoto.
- Conferir teclado/foco, responsividade e fluxo completo em navegador antes da aprovação de release.

## Proveniência

O [relatório original do Antigravity](archive/AUDIT-001-QA-antigravity-original.md) foi preservado sem edição, SHA-256 35eda901153b3a93441571aa4d2d0f72c124bc7f92a5c9bdf214b77f7750f7fb. Seu veredito APROVADO e suas afirmações sobre paginação e estado remoto estão superados por este relatório.

Procedimento vigente: [QA](README.md) e [checklist](../governance/review-checklist.md). Não houve commit, push, deploy, alteração remota ou criação de agendamento nesta rodada.
