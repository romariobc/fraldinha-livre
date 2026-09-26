# Estado atual — 2026-09-23

## Plano de migração GPT-6 — 2026-09-26

- Plano solicitado: [migração do assistente](../../docs/features/plans/migracao-gpt-6.md). Candidato principal GPT-6 Luna via Responses; comparar com Sol antes da escolha definitiva. Inspeção confirmou Llama 4 Scout, três ferramentas e necessidade de adaptar a continuação estruturada do loop.
- Apenas planejamento e documentação. Sem inferência real, testes de aplicação ou deploy; feature 018 permanece pendente de homologação. Preservadas alterações locais preexistentes. Acesso à conta OpenAI, orçamento e métricas dependem da implementação/piloto.

## Marco corrente

Harness comum em AGENTS.md e .agents/, documentação em docs/ e estado em context/. QA com evidência por critério e smoke tests remotos. Estado remoto da infraestrutura Cloudflare D1, Workers e Firebase sincronizado com a branch `main`. PR #16 mergeada e deploys de produção concluídos. [Relatório QA AUDIT-001](../../docs/qa/AUDIT-001-QA-relatorio.md).

## Resultado de infraestrutura, deploys e produção

- **Migration D1 remota**: `0010_audit_logs.sql` verificada e ativa no D1 remoto `fraldinha-livre-db` (`applied_at: 2026-09-22 15:17:53 UTC`). Tabela `audit_logs` e 4 índices íntegros.
- **Regras Firestore (`firestore.rules`) e Segurança de Identidade**: Endurecidas com restrição estrita de roles a `comprador` e `fornecedor`, `hasOnly()`, validação de tipos/tamanhos e bloqueio de exclusão. UI (`auth-context.tsx`) desacoplada de `data.role` e condicionado a Custom Claims verificadas no JWT. **Publicado em produção no Firebase** (Ruleset `da8cfd7c-6472-480e-a23b-8094964ed4e1` liberado em `2026-09-23T11:06:15Z`).
- **Merge da PR #16**: Aprovada pelo usuário e mergeada na branch `main` via commit `4b66ac91277372146a1c7cbd5a852a9da50463ea`.
- **Deploy do Backend Worker (`fraldinha-livre-backend`)**: Publicado com sucesso na Cloudflare em `https://fraldinha-livre-backend.romariobc.workers.dev` (Version ID `39d7b1cb-7b4d-4b7c-8d80-a7e213c95149`).
- **Deploy do Frontend Container (`fraldinha-livre-frontend`)**: Publicado com sucesso na Cloudflare em `https://fraldinha-livre-frontend.romariobc.workers.dev` (Version ID `05e5d56c-6c08-49d4-8519-6193c395acf9`, Container Image Digest `sha256:fd3648a287ac983a244a51188a1731ae4aecf9e681886f30a89831ac608b4725`).
- **Smoke Tests Remotos Pós-Deploy**:
  - `GET /health` (Backend): HTTP 200 `{"ok":true}` com header `X-Request-Id`.
  - `GET /products?limit=1` (Backend): HTTP 200 lendo dados reais do D1.
  - `GET /admin/audit-logs`, `PATCH /admin/products/:id/status`, `POST /auth/claim`: HTTP 401 com erro unificado seguro `{ "error": { "code": "UNAUTHORIZED", ... } }`.
  - `GET /`, `GET /catalogo`, `GET /admin` (Frontend): HTTP 200 OK.
- **AUDIT-001**: Concluída (`done`). Suíte total com 933 testes 100% verdes (41 contracts, 274 back, 618 front), `tsc` limpo e lint 0 erros.

## Continuidade

- **AUDIT-001**: Implementada, testada e em produção. Homologação final com usuário e token admin real no navegador é o próximo passo operacional.
- **Pipeline CI/CD**: Proposta com diff pronta em `docs/qa/AUDIT-001-QA-relatorio.md` para incluir `wrangler d1 migrations apply` no workflow `.github/workflows/cloudflare-deploy.yml` via PR dedicada.
- **Próximas features do backlog**:
  - Feature 018: App mobile / chat-agent PWA M7 (deploy e validação humana da Workers AI).
  - Feature 011: Gateway de pagamento.
  - Feature 010: Notificações (ativação de `RESEND_API_KEY`).
- Demais critérios em [feature_list.json](feature_list.json). Histórico da consolidação em [progresso-historico.md](progresso-historico.md).

## Próxima sessão

Atender à tarefa autorizada selecionada pelo usuário (homologação do login admin em navegador / automação D1 no workflow CI/CD / Feature 018 M7 / Feature 011). Não há agendamento ativo.

## Conferência do backlog — 2026-09-25

- Backlog conferido: 28 itens, sendo 23 `done`, 2 `in_progress` (010 e 018), 2 `todo` (009 e 011) e 1 `blocked` (008). Contagem de itens não representa percentual de prontidão do produto.
- Após `git fetch origin`, a branch local `ci/d1-migrations-workflow` contém todos os commits de `origin/main` e está 1 commit à frente: `8704fbe`. O workflow já aplica migrations D1 antes do deploy e serializa execuções de produção. Isso supera a descrição de “proposta com diff pronta” acima quanto à implementação local; integração em main e execução do pipeline não foram confirmadas nesta conferência.
- Pendências principais preservadas: homologação administrativa com token real; M7 do assistente com Workers AI real; gateway de pagamento; ativação de email e implementação de push. Leilão continua bloqueado.
- Reconciliação documental pendente: 007a está `done` com nota de validação humana faltante; 012 mantém critério de intervenção em disputas apesar de notas que retiram esse escopo; o veredito inicial do relatório AUDIT-001-QA descreve estado anterior ao deploy, superado pela atualização ao final do próprio relatório. A referência `.claude/docs/decisoes.md` no comentário do backlog também está desatualizada em relação ao caminho vigente `docs/governance/decisoes.md`.
- Esta conferência examinou registros, workflow e Git; não repetiu testes de aplicação nem verificou o estado atual de produção. Os 933 testes verdes e deploys são evidências registradas em 2026-09-23. Nenhum status de feature foi alterado.

## Diagnóstico de cadastro e navegação — 2026-09-25

- Revisão solicitada pelo usuário, sem correção de implementação: `/cadastro` oferece apenas email/senha; não possui botão nem chamada de autenticação Google, tanto em mobile quanto em desktop. `/login` possui o botão Google sem ocultação por breakpoint, abaixo do formulário de email/senha. O menu mobile do Header oferece Entrar e Criar conta quando aberto. A ausência do botão especificamente em `/login` no celular não foi reproduzida em navegador nesta revisão.
- Regressão confirmada no commit `ecdc460` (2026-08-20): `/minha-conta`, `/sacola` e `/checkout` foram movidos de `(main)` para `(comprador)`. O layout antigo inclui Header e Footer; o novo inclui somente RoleProtectedRoute e children. Minha conta perdeu a navegação global em todos os tamanhos de tela; as abas Pedidos/Histórico/Perfil permanecem. O link local para catálogo em PedidosTab só aparece quando não há pedidos ativos.
- Ajustes identificados: disponibilizar Google também no cadastro e restaurar a navegação do comprador preservando a proteção por papel. Validar em navegador mobile e desktop, com pedidos existentes e estado vazio. Diagnóstico baseado em código e diff histórico; nenhuma nova homologação de produção ou execução de testes de aplicação.

## CI/CD e Homologação Administrativa — 2026-09-25

- **Confirmação do Pipeline CI/CD**:
  - PR #17 mergeada na branch `main` via commit `d4eaeb5ced6d0507600fd2e03545837f23e6a236`.
  - Workflow `Deploy to Cloudflare` (Run ID `36148962628`) executou com sucesso total (2m34s).
  - Step `Apply D1 Migrations` executado automaticamente antes do deploy do backend (saída: `No migrations to apply!`; sem novas migrações pendentes no D1 remoto nesta execução; sem evidência explícita de backup pelo log).
  - Steps `Deploy Backend` e `Deploy Frontend (Container)` concluídos com sucesso.
  - Trava de concorrência (`concurrency: group: cloudflare-production`) validada e ativa.
- **Preparação da Homologação Administrativa**:
  - Segredo de produção `ADMIN_UID` configurado no Cloudflare Worker `fraldinha-livre-backend` via `wrangler secret put ADMIN_UID` com o valor `KOQclmb5eshfkufioK03ayRh6Fi2`.
  - Frontend (`NEXT_PUBLIC_ADMIN_UID`), Firestore Rules (`isAdmin()` com fallback temporário de transição) e Backend Worker (`uid === c.env.ADMIN_UID`) agora possuem configurações coerentes para a conta administradora.
  - **Homologação administrativa NÃO concluída**: O acesso à rota `/admin` e a resposta pública HTTP 200 não comprovam a autorização das chamadas autenticadas nem o carregamento das quatro abas (Usuários, Pedidos, Produtos e Auditoria). A homologação permanece formalmente pendente de validação em navegador real com a conta `romariobc@gmail.com`.
- **Limitações de Ambiente**:
  - Alerta de espaço em disco no drive `C:` (0,00 GB livres / `ENOSPC` observado em gravações de log local do Wrangler). Deve ser mitigado antes de novas compilações ou deploys locais.
- **Próximos passos operacionais alinhados**:
  1. Concluir a homologação funcional das 4 abas administrativas em navegador real pelo usuário com `romariobc@gmail.com`.
  2. Validação do assistente real (Feature 018 / M7 - Workers AI).
  3. Avançar na integração do gateway de pagamento (Feature 011).



## QA local de autenticação e navegação — 2026-09-25

- Verificação das alterações locais existentes em login, cadastro, layout do comprador e minha conta, sem editar a implementação. Servidor Next iniciado em http://127.0.0.1:3000.
- Chromium headless: /login e /cadastro responderam 200 em 360x800, 390x800 e 1440x900. Botões Google visíveis, habilitados, focáveis e dentro da primeira tela nesses tamanhos; sem overflow horizontal ou exceções de página. Captura do cadastro mobile inspecionada visualmente.
- Menu mobile abriu com Início, Catálogo, Entrar e Criar conta. Acesso anônimo a /minha-conta, /sacola e /checkout redirecionou para /login.
- Vitest dirigido aos quatro arquivos de testes de login, cadastro, layout comprador e minha conta: 4 arquivos / 27 testes passaram, código de saída 0. Navegação autenticada coberta com autenticação simulada, não homologada visualmente com conta real.
- Limites: OAuth Google real não executado; nenhuma sessão real de comprador disponível no navegador de QA. Diagnóstico products.load_list registrou NETWORK_ERROR no ambiente local; integração com catálogo/pedidos não homologada. Sem deploy ou alteração das configurações de autenticação.

## Deploy de cadastro Google e navegação — 2026-09-26

- Publicação autorizada pelo usuário: commit `507e29db65e48cf9ebb12cb2a87f071fa6b8d9ce` enviado para main, limitado aos quatro arquivos de UI e seus quatro arquivos de testes. Documentação concorrente e front/.claude/ preservados fora do commit.
- Tipos frontend e lint dos oito arquivos passaram (exit 0). Evidência anterior desta tarefa: 27 testes dirigidos passaram e QA visual local mobile/desktop em 2026-09-25; OAuth real e navegação autenticada real continuam sem homologação.
- GitHub Actions [run 36266666408](https://github.com/romariobc/fraldinha-livre/actions/runs/36266666408): success, deploy em 2m31s, incluindo build do container; migrations: No migrations to apply.
- Backend publicado: `7e41779c-2862-468e-8795-92d9b362357d`. Frontend publicado: `737acc4b-3940-4668-b56f-c583928d5f71`; imagem `sha256:2b6c519d64e1298b2bffe5c6efba86ddfc86322dea448f91503768d949307c66`.
- Smoke HTTP após deploy: /, /login, /cadastro, /catalogo, /minha-conta, /sacola e /checkout retornaram 200; backend /health retornou 200 com {"ok":true}. Resposta 200 em rota protegida não homologa autenticação. HTML inicial de login/cadastro contém skeleton; bundle público `1v1rywbtk77w2.js` confirmou o texto Continuar com Google no cadastro.
- Registro de publicação e plano de migração GPT-6 sincronizados com o repositório por autorização do usuário. Disco C: continua com pouco espaço livre; builds realizados no runner do GitHub Actions.
