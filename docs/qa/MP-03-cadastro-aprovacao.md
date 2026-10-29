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
- Cadastro retomável: claim → renovação de token → perfil, sem sobrescrever perfil existente → solicitação D1. Falhas intermediárias podem ser repetidas. Login/cadastro encaminham perfil ausente ao onboarding; administradores com claim válida seguem para admin. Migração lazy só registra sucesso no cache depois de resposta bem-sucedida.
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

Em consolidação: testes completos, tipos, lint, navegador local com contas de QA e CI da branch isolada. Não considerar este parágrafo evidência de aprovação até os resultados finais serem registrados.

## Limites de ativação

O D1 remoto ainda não possui migrations 0012/0013. A publicação nova depende de janela/reconciliação explícita; a simples aplicação da migração não preserva visibilidade do catálogo sem decisões administrativas. O inventário não comprova que identificadores `sup-*` pertencem a contas Firebase válidas.

Claims conflitantes continuam negadas pela API. O fallback administrativo legado ainda existe e será tratado no trabalho de segurança/operabilidade; esta etapa não amplia seus privilégios. Avisos internos persistidos e atendimento completo por ocorrências continuam nos respectivos MPs.
