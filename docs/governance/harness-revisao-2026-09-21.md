# Consolidação do harness — 2026-09-21

## Escopo e decisões

Execução autorizada das quatro fases: correção de instruções, núcleo comum, contexto seletivo e triagem. Código da aplicação, configurações locais e status de produto não foram alterados. Spec Kit removido das entradas .github porque seus scripts/templates .specify não existem; reintegrar somente com instalação completa e necessidade explícita.

Documentação e contexto comuns foram movidos de .claude/docs e .claude/context para docs e context. Configurações específicas das ferramentas permanecem em seus diretórios. Links para commits históricos do GitHub continuam intocados.

## Resultado e verificações

- 59 planos arquivados; 8 planos mantidos ativos por pendência, trabalho parcial ou falta de evidência individual suficiente. Os índices não contam como planos.
- Resumo ativo: 1.652 bytes; histórico integral: 160.768 bytes. Nenhum status de produto foi alterado.
- Verificação automatizada de destinos de links locais em 63 documentos Markdown ativos: nenhum destino ausente. Histórico preservado não foi reescrito para corrigir referências antigas.
- SHA-256 do histórico, backlog e 15 arquivos de agentes conferidos; nenhuma divergência.
- JSON do backlog válido; diff de front/, back/, app/ e packages/ vazio; git diff --check sem erros.
- Diretórios de execução dos três workspaces confirmados com npm exec --offline --workspace <workspace> --call "node -p process.cwd()". Scripts e tsconfig consultados nos respectivos workspaces.
- Testes funcionais e build não executados: mudança restrita ao harness e à documentação. Isso não representa nova homologação do produto.
- Configurações locais e front/.claude/ preexistente preservados. Sem commit, push, deploy ou migração remota.

## Preservação

- SHA-256 do progresso original e da cópia integral: `4a40a2fe83e86827efe089a9d769a034bd6b75fde7598f3dfa998e5aee8e2fb3`.
- SHA-256 do backlog original (preservado sem alteração de conteúdo): `a6e7959c9abe96ff303735537ec13d43e797c13fc7ccc007b9e6765b908fdc60`.
- Índice anterior dos planos preservado em [arquivo](../archive/harness-2026-09-21/plans-index-original.md).
- Handoffs incluem resultados conflitantes de execução/deploy, limitações de testes e revisão do catálogo. Foram preservados integralmente, inclusive arquivos locais antes ignorados, em docs/archive/harness-2026-09-21/agents/. Não se concluiu que suas ressalvas estavam todas resolvidas.
- PRD duplicado removido somente após comparação SHA-256; fonte canônica: docs/PRD-Fraldinha-Livre.md.

## Planos arquivados

Somente itens explicitamente APROVADO/DONE/FECHADO, sem indicação de pendência no índice consultado. Arquivamento não prova que a feature inteira está homologada. Breakdowns e demais casos incertos continuam ativos.

| Arquivo | Evidência registrada anteriormente |
|---|---|
| H-001-limpeza-docs-infra.md | APROVADO (commit 027edaf, revisado 2026-07-02) |
| H-002-gating-leilao.md | APROVADO (commit 61396e0, revisado 2026-07-02) |
| H-005-auth-firebase.md | DONE — validado pelo cliente no navegador (2026-07-02) |
| H-006-limpeza-codigo-morto-e-lint.md | APROVADO (commit 1355e51) via D-012 — branch verde (build+lint) |
| H-008-footer-e-links.md | APROVADO (f87b84f) via D-012 — branch verde |
| H-009-fix-mascaras-cpf-telefone.md | APROVADO (65d2e43) via D-012 — cap+mascara verificados por leitura; lint 0 |
| H-003-bugs-da-loja.md | APROVADO (b6c4e6c) via D-012 — lint 0, build ok |
| B1-contracts-zod.md | APROVADO (commit b908dfe) via D-012 pela sessão de frontend |
| B2-fix-migration-test.md | APROVADO (commits b6aa44b, 44aa81a, aa5d4e1) via D-012 pela sessão de frontend — incluindo D1 real criado via MCP |
| B2-worker-scaffold.md | APROVADO (commits b6aa44b, 44aa81a, aa5d4e1) via D-012 pela sessão de frontend — incluindo D1 real criado via MCP |
| B3-auth-orders-get.md | APROVADO (commits 2af35f6, 20c62dc) via D-012 pela sessão de frontend |
| B4-orders-post-cancel.md | APROVADO (commit 6309a1e) via D-012 pela sessão de frontend |
| B5-order-repository-mock.md | APROVADO (commit 5ba3b81) via D-012 pela sessão de frontend |
| B6-order-repository-contract.md | APROVADO (commit 4b18648) via D-012 pela sessão de frontend |
| B7-http-order-repository.md | APROVADO (commits a8ea692, fa32b6f) via D-012 pela sessão de frontend — verificação linha a linha do fix zod |
| B8-orders-provider-async.md | APROVADO (commit 3299c98) via D-012 pela sessão de frontend |
| P1-products-schema-seed.md | APROVADO (commits 6a0c9f4, ed1e9bb, 7d08f46) via D-012 — incidente de commit no repo errado corrigido; ressalva do seed resolvida com teste-sensor |
| P2-orders-validate-products.md | APROVADO (commit 256d22a) via D-012 |
| C1-products-contract.md | APROVADO (commit 32a4ae7) via D-012 — 15/15 testes verdes, tsc 0, escopo confere |
| C2-products-schema-migrations.md | APROVADO (commits c4ae8dd + 46f4d05, executado pela sessao de backend) via D-012 — bug de migration achado e corrigido (D-031), 35/35 testes verdes, sqlite3 isolado confirma 24 produtos |
| C3-products-get-scope-fornecedor.md | APROVADO (commits 70b9ee0 + 627a86a, executado pela sessao de backend) via D-012 — 39/39 testes verdes, tsc 0, escopo confere |
| C4-products-crud.md | APROVADO (commit 93e7f55, executado pela sessao de backend) via D-012 — 51/51 testes verdes, tsc 0, fix de badge null->undefined feito pelo proprio Haiku e confirmado |
| C5-orders-scope-fornecedor.md | APROVADO (commit 2e861d2, executado pela sessao de backend) via D-012 — 55/55 testes verdes, tsc 0, codigo identico ao prompt. Thread C fecha o lado backend (C2-C5) |
| C6-product-repository-mock.md | APROVADO (commit 34dd865) via D-012 — 311/311 testes verdes, tsc 0, desvio de design aceito (teste de ProductForbiddenError movido do contract pro mock-specific) |
| C7-http-product-repository.md | APROVADO (commit 1543b08) via D-012 — 325/325 testes verdes, tsc 0, zero import de zod direto, codigo identico ao prompt |
| C8-catalogo-migra-repository.md | APROVADO (commit 8e41af4) via D-012 + verificacao visual obrigatoria no navegador (maior risco da fatia) — 340/340 testes verdes, tsc 0, build ok, catalogo/produto/404 confirmados de verdade |
| C9-catalogo-tab-fornecedor.md | APROVADO (commit bb86c2d) via D-012 — 340/340 testes verdes (revalidado apos C8 commitar), tsc 0, codigo bate com o prompt |
| M1-chat-contract-zod.md | APROVADO (commit 0dff234) via D-012 — 25/25 testes verdes (10 novos), tsc 0, escopo confere (so packages/contracts). Achado de ambiente (nao de codigo): worktree estava sem node_modules instalado; `npm install` na raiz resolveu, nao contou como tentativa do loop D-008 |
| M2-workers-ai-adapter.md | APROVADO (commits e1c80c8 + fix 0a47359) via D-012 — 74/74 testes verdes, tsc 0. Revisao achou 1 problema real: o prompt original assumia `tool_calls[]` achatado (`{name,arguments}`), mas o `llama-4-scout` retorna aninhado em `.function.{name,arguments}` (confirmado em `@cloudflare/workers-types` instalado, nao na doc generica que usa outro modelo) — corrigido no breakdown/prompt e no codigo (fix novo, nao amend). `back/` nao tem `npm run lint` configurado (achado pre-existente, nao desta tarefa). Bonus: formato real de imagem confirmado (`content[].image_url.url`), fica registrado pra quando a foto for integrada |
| M3-chat-tools-search-get.md | APROVADO (commit 4e1a4b9) via D-012 — 82/82 testes verdes (8 novos), tsc 0, diff identico ao prompt. Reforca RN-007-04 (nunca retorna produto despublicado) e nunca expoe supplierEmail/supplierId no resultado — ambos exercitados por teste real, nao so declarados |
| M4-chat-message-route.md | APROVADO (commit 6e52124) via D-012 — 89/89 testes verdes (7 novos), tsc 0, diff identico ao prompt. Backend da feature 018 fechado: junta M1+M2+M3 na rota real atras do mesmo middleware de auth Firebase de /orders; para no primeiro select_product_for_purchase (nao itera de novo); 502 apos MAX_TOOL_ITERATIONS sem fechar; ultimo caso de teste usa search_products/get_product de verdade contra o D1 (nao mock) |
| M5-assistente-rota-chatui.md | APROVADO (commit 64dc72e) via D-012 — 373/373 testes verdes (7 novos), tsc 0, lint exit 0 (2 warnings pre-existentes/esperados), build ok com /assistente listada. Diff identico ao prompt, exceto um `beforeEach` de `mockClear()` que o executor adicionou por conta propria (achou que `vi.mock` nao reseta `mock.calls` entre `it()` sem isso) — divergencia pequena, disclosed no relatorio, conferida e aceita. Escopo respeitado: acao select_product ainda so gera mensagem informativa (M6 fecha o laco) |
| M6-chatui-intercepta-selecao.md | APROVADO (commit c60fef1) via D-012 — 375/375 testes verdes (3 novos + 2 mantidos), tsc 0, lint exit 0 (mesmos 2 warnings), build ok, diff identico ao prompt. Fecha o laco funcional da feature 018: produto real (p1) + perfil completo → addItem certo + push('/checkout'); perfil incompleto → redireciona pro perfil sem adicionar (RN-06, mesma trava do "Comprar agora"); productId inexistente → mensagem informativa sem carrinho/redirect. Checkout confirmado intocado (ultimo commit no path e anterior a este) |

## Resíduos removidos

- changes.patch
- changes_utf8.patch
- .github/logs_88557076837.zip

## Manifesto dos handoffs preservados

- .agents/orchestrator/BRIEFING.md → docs/archive/harness-2026-09-21/agents/orchestrator/BRIEFING.md — SHA-256 9aaf53ceb11a1cd8f976ff42fef8fd0569efdc66c33d5179d8b37d703f30724d
- .agents/orchestrator/progress.md → docs/archive/harness-2026-09-21/agents/orchestrator/progress.md — SHA-256 26dba205aa0d847afcf13f8c2a1c8e122a3a3e6fc39c07896c414c2610253ff0
- .agents/sentinel/BRIEFING.md → docs/archive/harness-2026-09-21/agents/sentinel/BRIEFING.md — SHA-256 a0c4faac71f03da34a1f02eb26620c9d1eb26633c57e5e3c70b7ac6f0c61df18
- .agents/sentinel/handoff.md → docs/archive/harness-2026-09-21/agents/sentinel/handoff.md — SHA-256 6a994a624dc011fcc9874ff3db4e21134d7c96d6643f55115eac5c7482746faf
- .agents/swe_catalog/handoff.md → docs/archive/harness-2026-09-21/agents/swe_catalog/handoff.md — SHA-256 eaaade26a0cfeba3f8c3050fe1a36f46e2ef9f40e9e7ee6258bb706fa291c2e6
- .agents/teamwork_preview_reviewer_1/handoff.md → docs/archive/harness-2026-09-21/agents/teamwork_preview_reviewer_1/handoff.md — SHA-256 98da4dfda2061dee08dfdb568c9c7218ba1f7a551b03070bb236c4ef47e8deb4
- .agents/teamwork_preview_reviewer_1/progress.md → docs/archive/harness-2026-09-21/agents/teamwork_preview_reviewer_1/progress.md — SHA-256 515cfda996d1f6de0074206a265d749ca55a79a020a629c7affa943794b63717
- .agents/worker_backend/BRIEFING.md → docs/archive/harness-2026-09-21/agents/worker_backend/BRIEFING.md — SHA-256 272cacc2af55324e886d75aebb25236fb0a1f99b48fa5136294c54aea4839b3e
- .agents/worker_backend/handoff.md → docs/archive/harness-2026-09-21/agents/worker_backend/handoff.md — SHA-256 da8840a9c106f25041aea4bc5f45f3dbea8b8bf190dd215df59e90d47b6e1d46
- .agents/worker_backend_retry/handoff.md → docs/archive/harness-2026-09-21/agents/worker_backend_retry/handoff.md — SHA-256 9b00e8413654c37b317bae05e3f4f8b13dfcab4f59fba17c6c098d840c16b8b9
- .agents/worker_deploy/handoff.md → docs/archive/harness-2026-09-21/agents/worker_deploy/handoff.md — SHA-256 1e3ba289899ffd5c49022db1bc08102a07ae33b09d5d6d712329babcd3ee363a
- .agents/worker_deploy_final/handoff.md → docs/archive/harness-2026-09-21/agents/worker_deploy_final/handoff.md — SHA-256 1540fd94d2d1cb1105c8a9739d9ce65f3a8eb695324edef318b7cefd0139c7c3
- .agents/worker_deploy_final2/handoff.md → docs/archive/harness-2026-09-21/agents/worker_deploy_final2/handoff.md — SHA-256 83b1c280b6e878edc6f6129bc4e5843c7bafd170d169c78f25dc0724675f5a51
- .agents/worker_deploy_retry/handoff.md → docs/archive/harness-2026-09-21/agents/worker_deploy_retry/handoff.md — SHA-256 abcb1fa88c6fb5a413484a8a2af0ee3096faf7fb1b851c408ff4178db451fbec
- .agents/worker_frontend/handoff.md → docs/archive/harness-2026-09-21/agents/worker_frontend/handoff.md — SHA-256 9310dbdf419f0deca54e47b7389ede7dd8eac6a9c8c2bf814692366ceb564080

## Triagem complementar com o backlog

O índice antigo não era a única evidência. Os arquivos abaixo foram arquivados conforme registros posteriores do backlog, sem alterar seus status. T0 e H-010 conservados por falta de conclusão individual inequívoca nos registros consultados; planos parciais/pendentes permanecem ativos.

| Arquivo | Evidência |
|---|---|
| S-sacola-navegacao-breakdown.md | Feature 016 done; notas registram entrega da thread S e validação humana em 2026-07-21. |
| S1-cart-context.md | Feature 016 done; notas registram entrega da thread S e validação humana em 2026-07-21. |
| S2-adicionar-a-sacola.md | Feature 016 done; notas registram entrega da thread S e validação humana em 2026-07-21. |
| S3-pagina-sacola.md | Feature 016 done; notas registram entrega da thread S e validação humana em 2026-07-21. |
| S4-navegacao-header.md | Feature 016 done; notas registram entrega da thread S e validação humana em 2026-07-21. |
| S5-checkout-breakdown.md | Feature 016 done; notas registram entrega da thread S e validação humana em 2026-07-21. |
| S5a-checkout-state-machine.md | Feature 016 done; notas registram entrega da thread S e validação humana em 2026-07-21. |
| S5b-checkout-efeito-pedidos.md | Feature 016 done; notas registram entrega da thread S e validação humana em 2026-07-21. |
| S6-ux-fixes-quantidade.md | Feature 016 done; notas registram entrega da thread S e validação humana em 2026-07-21. |
| S7-gate-login-e-quantidade-onbuy.md | Feature 016 done; notas registram entrega da thread S e validação humana em 2026-07-21. |
| T1-contratos-dominio.md | Feature 016 done; notas identificam commits T1, T1.5, T2, T3 e T4 e validação humana. |
| T1.5-migracao-order-items.md | Feature 016 done; notas identificam commits T1, T1.5, T2, T3 e T4 e validação humana. |
| T2-adaptadores-mock-contract-tests.md | Feature 016 done; notas identificam commits T1, T1.5, T2, T3 e T4 e validação humana. |
| T3-schema-produto.md | Feature 016 done; notas identificam commits T1, T1.5, T2, T3 e T4 e validação humana. |
| T4-pagina-produto.md | Feature 016 done; notas identificam commits T1, T1.5, T2, T3 e T4 e validação humana. |
| U1-contexts-cancelar-e-seed.md | Feature 017 done; commits U1/U2 e validação humana registrados no backlog. |
| U2-ordercard-acordeao-cancelar.md | Feature 017 done; commits U1/U2 e validação humana registrados no backlog. |
| B-backend-pedidos-breakdown.md | Feature 006 done; fatias B9/P3 validadas em produção e épico fechado em 2026-07-29. |
| P-backend-produtos-breakdown.md | Feature 006 done; fatias B9/P3 validadas em produção e épico fechado em 2026-07-29. |
| C-catalogo-fornecedor-breakdown.md | Feature 007 done; backlog registra C1-C10 aprovadas e C11 fechado em 2026-07-26. |
| C10-market-provider-sync-real.md | Feature 007 done; backlog registra C1-C10 aprovadas e C11 fechado em 2026-07-26. |
| H-004-compra-direta-multivendedor.md | Feature 014 done e explicitamente superada pela 016 no backlog. |
| H-007-area-cliente-perfil.md | Feature 007a done, com implementação e validação registradas no backlog. |
| H-012-painel-admin.md | Feature 012 done; H-012 executado, revisado e deployado em 2026-08-02. AUDIT-001 permanece ativo. |
| npm-workspaces-front-contracts-breakdown.md | Feature 006 registra migração para npm workspaces realizada antes de H-010; estrutura confirmada no package.json. |
| deploy-frontend-cloudflare-breakdown.md | Plano OpenNext substituído por Cloudflare Containers nas notas da feature 006 e no plano H-010. |
