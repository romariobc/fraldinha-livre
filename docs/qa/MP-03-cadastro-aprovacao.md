# MP-03 — cadastro, acesso e aprovação de fornecedores

## Escopo e base

Etapa autorizada com “prossiga” após a entrega MP-02. Implementação sobre `580f2d8` (MP-02), preservando o checkout principal `1322ac6` e suas alterações preexistentes. Somente MP-03; MP-04 não autorizado. Sem merge, deploy ou migração remota.

## Implementação identificada por leitura de código

- `supplier_applications` no D1 guarda UID, estado comercial, motivo, versão e datas. Não existe aprovação implícita por claim, allowlist ou migração.
- `GET/POST /auth/supplier-application` consulta/cria a solicitação do próprio UID autenticado. POST é idempotente e não reinicia rejeição/suspensão. Body não escolhe identidade nem estado.
- `GET /admin/suppliers` lista em páginas de 50 por cursor. `PATCH /admin/suppliers/:uid` exige admin, motivo de 5–500 caracteres e versão esperada. Aprovação pode suceder pendência/rejeição/suspensão; rejeição somente da pendência; suspensão somente da aprovação. Revisões concorrentes não sobrescrevem decisões posteriores.
- Decisão e auditoria são gravadas no mesmo D1.batch. Retry idêntico de resposta perdida não cria um segundo evento. Metadados registram estado anterior/novo e versão, com ator e requestId.
- Publicação e edição de produtos usam guarda SQL no próprio INSERT/UPDATE. Catálogo público e ferramentas de consulta de produtos da IA filtram aprovação; o assistente permanece fora do objetivo da versão.
- Criação de pedido exige aprovação também dentro da transação de estoque. Suspensão entre preflight e batch impede pedido, reserva e evento. Replay de pedido já criado e atendimento de pedidos anteriores permanecem permitidos.
- Painel do fornecedor apresenta estado, motivo, erro/retry e atualização. Admin analisa solicitações com motivo e controle de versão na aba de usuários.
- Cadastro retomável: claim → renovação de token → perfil, sem sobrescrever perfil existente → solicitação D1. Falhas intermediárias podem ser repetidas. Login/cadastro encaminham perfil ausente ao onboarding; administradores com claim válida seguem para admin. Migração lazy só registra sucesso no cache depois de resposta bem-sucedida. Leituras assíncronas são vinculadas à revisão da sessão; respostas tardias de outra conta não substituem perfil, papel ou claims atuais. refreshClaims também verifica a identidade após cada espera.
- Recuperação de senha ligada ao login, via Firebase, com confirmação que não revela existência de conta. O envio real de e-mail não é necessário ao teste local e não foi disparado. Login, criação de identidade e logout continuam pelo Firebase; updateProfile continua removendo `role` do patch e as regras Firestore permanecem inalteradas.

## Matriz por critério

| Critério | Evidência | Resultado e limite |
|---|---|---|
| Estados e bloqueio independente de claims | `back/test/supplier-approval.test.ts` | D1 local: ausência/pendência/rejeição/suspensão negam vendas; payload não escolhe UID/estado. |
| Administração, motivo, concorrência e retry | Mesmo arquivo | Decisões conflitantes, versão obsoleta, motivo inválido e repetição testados; evento persistido e único. |
| Falha intermediária de decisão | Trigger de falha no UPDATE | Batch reverte também o evento de auditoria; retry conclui após remover falha. |
| Suspensão após validação preliminar | Proxy da chamada batch, D1 real | Compra negada; estoque preservado; transação guarda a aprovação vigente. |
| Pedidos anteriores e ownership | Novo arquivo + suítes de RBAC e pedidos | Suspenso consulta produtos/pedidos próprios, conclui entrega e reexecuta a compra anterior sem duplicação; testes de isolamento existentes preservados. Respostas de ocorrências pertencem a MP-08. |
| Retomada entre serviços | `complete-onboarding.test.ts` | Falhas em claim, renovação de token, Firestore e D1; perfil existente não sobrescrito. Dependências externas substituídas nesses testes. |
| UI administrativa e paginação | `AdminSupplierApprovals.test.tsx` + teste D1 com 55 registros | Motivo, envio da versão, erro, sucesso e segunda página cobertos. |
| Recuperação | `recuperar-acesso/page.test.tsx` | Confirmação sem enumeração e retry de rede; envio real de mensagem não comprovado. |
| Inventário e ativação | [Inventário verificado e runbook](MP-03-inventario-ativacao.md) | SELECT remoto, 314 ofertas/7 IDs; 79 pedidos abertos. Nenhuma aprovação automática. |

## Validação desta execução

- **Suítes completas locais:** 728 testes front (72 arquivos), 324 back (30 arquivos), 58 contratos (7 arquivos), todos aprovados. Depois dos ajustes finais, rechecagem de 18 casos de login/onboarding/admin, quatro do painel e 12 casos D1 de habilitação, incluindo suspensão antes do INSERT de oferta. A suíte de segurança de identidade passou com seis casos, incluindo perfil anterior chegando depois do perfil atual. O CI final executa novamente todas as suítes na branch isolada; dois testes front anteriores do checkout principal ficam fora dela.
- **Tipos:** tsc --noEmit dos três workspaces aprovado. **Lint:** 0 erros, 11 avisos preexistentes. **Sintaxe do harness:** node --check aprovado.
- **CI candidato:** [run 40899799519](https://github.com/romariobc/fraldinha-livre/actions/runs/40899799519), commit 33423d4, 11/11 jobs aprovados (testes, tipos, lint, regressões do runner/CI e imagem Docker). O segundo candidato a96db2a também passou nos 11 jobs no [run 40901149885](https://github.com/romariobc/fraldinha-livre/actions/runs/40901149885). A proteção final contra resposta atrasada de outra sessão recebe novo run no commit final; consultar o status da [PR #24](https://github.com/romariobc/fraldinha-livre/pull/24), dependente de #22/#23. Não houve publicação.
- **Navegador Edge real:** comprador QA com perfil existente, fornecedor e admin autenticados pelo Firebase real, frontend localhost:3001 e API/D1 localhost:8787. Pendência após reload; aprovação com motivo; acompanhamento do estado; compra simulada local visível ao comprador após reload; suspensão impede nova compra/visibilidade pública; JWT do fornecedor atende pedido anterior; logout; rota de recuperação. Dados comerciais gravados somente no D1 local, sem editar perfis ou claims remotos.
- **Visual:** 1365×900 e 375×812. Captura mobile revisada, sem overflow horizontal e sem selo estático “Verificado” para suspenso; selo antigo também removido do menu lateral. Outras métricas/curadoria de painel pertencem a MP-10.
- **Artefatos locais ignorados:** docs/qa-artifacts/mp03-browser-result.json, mp03-fornecedor-mobile.png, mp03-admin.png e logs mp03-*. O JSON final registra passed=true; capturas inspecionadas. Não versionar credenciais ou tokens.
- **Ajustes do harness:** a automação agora espera o formulário estar hidratado antes de preencher; a primeira tentativa preenchia inputs antes do React assumir o controle e não submeteu credenciais. O comprador QA inicial tinha perfil Firestore ausente (404); outra conta existente retornou 200 e foi usada, sem fabricar perfil remoto. A primeira execução local de testes expôs uma fixture de estoque sem aprovação e a preparação sequencial de 55 solicitações excedendo 5s; foram corrigidas com fixture explícita/batch, seguidas de execução aprovada. Lint detectou dois efeitos HTTP; justificativa local documenta que suas alterações de estado ocorrem após await, mantendo a regra ativa no restante do projeto.

### Reprodução do navegador

Usar banco D1 local novo, migrations locais aplicadas e API na porta 8787; iniciar o front com NEXT_PUBLIC_BACKEND_URL=http://localhost:8787 na porta 3001. O teste requer .env.qa.local com QA_SUPPLIER, QA_ADMIN e QA_BUYER1 já existentes e com perfis; não cria identidades. Configurar PLAYWRIGHT_MODULE_PATH para package.json do Playwright instalado e QA_BROWSER_EXECUTABLE para o navegador; executar node scripts/qa-mp03-browser.cjs. A rotina usa o formulário de login e decisões pela interface; chamadas de API do navegador para outras origens são bloqueadas. Nova execução completa exige D1 local novo, pois o teste termina com fornecedor suspenso e não reinicia decisões administrativas.

### Limites da evidência externa

Cadastro de identidade nova, gravação de perfil em Firestore e envio de recuperação possuem testes de componentes/contratos e falhas entre serviços; não foram executados sobre novas contas remotas nesta etapa. Entrega de e-mail e retorno do link de redefinição precisam de homologação no ambiente autorizado da versão. O login/leituras de perfis e as claims das contas QA existentes foram executados, sem demonstrar sozinho o ciclo de cadastro de uma conta nova. Isso não autoriza promover o marketplace a pronto para produção antes de MP-12.

## Limites de ativação

O D1 remoto ainda não possui migrations 0012/0013. A publicação nova depende de janela/reconciliação explícita; a simples aplicação da migração não preserva visibilidade do catálogo sem decisões administrativas. O inventário não comprova que identificadores `sup-*` pertencem a contas Firebase válidas.

Claims conflitantes continuam negadas pela API. O fallback administrativo legado ainda existe e será tratado no trabalho de segurança/operabilidade; esta etapa não amplia seus privilégios. Avisos internos persistidos e atendimento completo por ocorrências continuam nos respectivos MPs.


## Confirmação final — 30/10/2026

CI do commit de código final 17db34e632ba8dff3cf8f53747f7cd3f57a3a2d8 reconsultado: [run 40901914614](https://github.com/romariobc/fraldinha-livre/actions/runs/40901914614), completed/success e 11/11 jobs. Foram aprovados 1.154 testes: 730 front, 325 back, 58 contratos, 32 runner e nove segurança do CI; tipos, lint e imagem Docker também passaram. Lint manteve 0 erros/11 avisos. Este registro final é documental e local, posterior ao snapshot validado da PR; não representa nova alteração de código. MP-03 aguarda aprovação e MP-04 não foi iniciado.
