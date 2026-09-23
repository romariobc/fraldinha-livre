# TOOLING-001 — verificação de retomada, 2026-09-22

Base: main com alterações locais preexistentes, sem commit nesta rodada. Relatório da IDE recebido em 2026-09-21 revisado contra o workspace. Node ativo: 22.23.2, C:/Program Files/nodejs/node.exe; nenhuma instalação de Node foi necessária nesta rodada.

## Correções desta retomada

- Sincronizados engines da raiz e de packages/contracts no lockfile via `npm install --package-lock-only --ignore-scripts --offline` (saída 0). Os quatro manifestos e entradas correspondentes no lockfile agora declaram >=22.0.0. .nvmrc/back/.node-version selecionam 22; Docker e CI usam 22. A versão efetivamente verificada é 22.23.2, não todas as versões aceitas pelo intervalo.
- Reforçada a asserção de frontend-diagnostics.test.ts: a ação deve conter label “Copiar código”. O if anterior permitia ignorar essa verificação caso a ação estivesse em outro formato. Substituído por objectContaining sem cast nem condição.
- Confirmada a exportação dos tipos AuthUser/AuthContextType e remoção dos casts permissivos dos mocks de domínio revisados. A afirmação “fim de todos os as unknown as” era ampla demais: CatalogoView.test.tsx ainda simula pathname nulo com um cast preexistente, fora dos mocks de domínio corrigidos.

## Evidências desta execução

| Verificação | Comando | Saída / resultado |
|---|---|---|
| Contratos | npm test --workspace packages/contracts | 0; 41 testes, 6 arquivos |
| Frontend | npm test --workspace front -- --maxWorkers=2 | 0; 594 testes, 59 arquivos |
| Backend | npm test --workspace back -- --maxWorkers=1 | 0; 274 testes, 26 arquivos |
| Diagnósticos isolados | npm test --workspace front -- src/lib/__tests__/frontend-diagnostics.test.ts --maxWorkers=1 | 0; 23 testes |
| Lint | npm run lint --workspace front | 0; 0 erros, 19 avisos |
| Tipos front | npm exec --workspace front -- tsc --noEmit -p tsconfig.json | 0 |
| Tipos back | npm exec --workspace back -- tsc --noEmit -p tsconfig.json | 0 |
| Tipos contracts | npm exec --workspace packages/contracts -- tsc --noEmit -p tsconfig.json | 0 |

Total das suítes completas: 909 testes. A primeira tentativa concorrente teve timeout de inicialização de worker no frontend e testes não executados no backend; as duas suítes completas iniciais foram interrompidas. A repetição com concorrência limitada passou, sem aumentar timeouts ou ocultar erros. A causa exata da lentidão não foi estabelecida. Não contar a tentativa interrompida como sucesso.

Os 19 avisos de lint permanecem triados no relatório anterior: 15 variáveis/parâmetros não usados, 3 imagens e 1 incompatibilidade com memoização automática. Vitest/Vite também emitiram avisos de depreciação de configuração/plugins e JSDOM de navegação não implementada, sem falhas na repetição. Não foram suprimidos.

## Conclusão

TOOLING-001 concluída segundo seus critérios locais. Build, inspeção visual e homologação remota não executados. AUDIT-001 continua in_progress. Nenhum agendamento, commit, push ou deploy realizado; alterações preexistentes preservadas. Próxima etapa de AUDIT-001: build e validação do fluxo em navegador antes de planejar homologação remota.
