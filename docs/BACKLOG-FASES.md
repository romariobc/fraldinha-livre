# Backlog de Fases — Fraldinha Livre

**Revisão:** 20 de setembro de 2026  
**Base:** estado local no commit `d5b0ec373045a75fd9b59ac9fb660f44c8b007db`, backlog do projeto, PRD e checklist E2E do Gemini.  
**Regra:** este documento organiza o trabalho. Ele não altera o harness, não inicia tarefas concorrentes e não transforma relatos históricos em validação atual.

## Ordem recomendada

```text
FASE 0 — Fechar evidências e preparar o beta
    ├── AUDIT-001 — Trilha de auditoria administrativa
    ├── AUTH-SEC — Remover exceções administrativas legadas
    ├── PAY-001 — Pagamento real
    └── OPS-001 — Fulfillment, entrega e estados logísticos

FASE 1 — Operação confiável do marketplace
    ├── NOTIF-001 — Notificações operacionais
    ├── REPORT-001 — Relatórios baseados em dados reais
    ├── CHAT-001 — Fechar M7 do assistente com modelo real
    └── QA-001 — Regressão integrada e validação humana

FASE 2 — Retenção e eficiência comercial
    └── ORDER-001 — Pedidos preferenciais e recompra

FASE 3 — Leilão reverso como produto independente
    └── AUCTION-001 — Serviço de leilão reverso

FASE 4 — Integrações e escala
    ├── ERP-001 — Hub de fornecedores e ERPs
    ├── PUSH-001 — Notificações push
    └── SCALE-001 — Desempenho, capacidade e recuperação
```

## FASE 0 — Fechar evidências e preparar o beta

Objetivo: transformar o sistema atual em uma base verificável para operação controlada. O checkout cria pedidos reais no D1, mas pagamento e entrega continuam simulados.

### F0-01 — Fechar validação E2E atual

**Prioridade:** P0  
**Status:** aguardando conclusão do checklist do Gemini  
**Responsável sugerido:** Romário/Gemini, com revisão da sessão principal

Pendências observadas no scratchpad:

- Login como fornecedor.
- Conferência do pedido no painel do fornecedor.
- Consolidação dos resultados.

**Critério de saída:** checklist completo, ambiente registrado, evidência do comprador e do fornecedor, pedido persistido após atualização da página e nenhuma conclusão baseada apenas em screenshot.

**Bloqueia:** decisão de beta e priorização de correções de fluxo.

### F0-02 — AUDIT-001: trilha de auditoria administrativa

**Prioridade:** P0  
**Status:** próximo passo já registrado no progresso do projeto  
**Dependências:** F0-01

Registrar ator, recurso, ação, justificativa e timestamp para ações administrativas e futuras ações de moderação. Separar auditoria de logs operacionais, ocorrências de pedidos e analytics.

**Critério de saída:** schema e retenção definidos; rota ou serviço com autorização administrativa; registros imutáveis ou protegidos contra alteração indevida; consultas de auditoria cobertas por testes; PII minimizada; eventos ligados às ações reais.

### F0-03 — AUTH-SEC: eliminar exceções administrativas legadas

**Prioridade:** P0  
**Status:** pendente documentado como `ADMIN-002`  
**Dependências:** F0-02, provisionamento confirmado de Custom Claims

Remover, em tarefa própria, o fallback `ADMIN_UID` no backend e a exceção administrativa equivalente nas regras do Firestore. Primeiro confirmar que o administrador possui claim válida e que o acesso global continua funcionando.

**Critério de saída:** admin funciona apenas pela fonte de autoridade aprovada; nenhum usuário sem claim recebe admin; testes adversariais atualizados; Firestore Rules validadas e implantadas; rollback documentado.

### F0-04 — Definir contrato do beta

**Prioridade:** P0  
**Status:** decisão de produto pendente  
**Dependências:** F0-01

Definir público, região, fornecedores, catálogo habilitado, atendimento, comunicação de que o pagamento é simulado e tratamento de pedidos de teste. Especificar se o beta aceita pedido real sem cobrança ou se apenas percorre o fluxo.

**Critério de saída:** decisão registrada em documento de produto; ambiente e dados de teste separados dos dados de operação; mensagem pública consistente.

## FASE 1 — Operação confiável do marketplace

Objetivo: substituir os pontos simulados e corrigir as lacunas que afetam a confiança de comprador e fornecedor.

### F1-01 — PAY-001: gateway de pagamento

**Prioridade:** P0 para lançamento comercial  
**Status:** feature 011 pendente  
**Dependências:** F0-04, contrato comercial, escolha do provedor

Implementar PIX e/ou cartão conforme decisão comercial, mantendo a porta de pagamento existente. O servidor deve criar uma tentativa idempotente, receber confirmação confiável do provedor, tratar aprovação, recusa, expiração, cancelamento e estorno, e reconciliar divergências.

**Critério de saída:** nenhum pagamento é considerado concluído por resposta do navegador; webhook verificado; idempotência testada; estados financeiros separados dos estados logísticos; logs sem dados de cartão; contrato de suporte e conciliação definido.

### F1-02 — OPS-001: fulfillment, entrega e estados logísticos

**Prioridade:** P0 para promessa de entrega  
**Status:** simulado no checkout  
**Dependências:** F0-04; pode evoluir em paralelo ao gateway depois do contrato de operação

Substituir `MockFulfillmentService` por uma integração ou processo operacional definido. Modelar responsável, estoque reservado, separação, despacho, transporte, entrega, falha e devolução. Definir quem pode mudar cada estado e registrar eventos.

**Critério de saída:** pedido não aparece como enviado ou entregue por ação local do frontend; transições autorizadas no backend; comprador e fornecedor veem o mesmo estado; falhas e reprocessamentos são idempotentes.

### F1-03 — NOTIF-001: notificações operacionais

**Prioridade:** P1  
**Status:** código de e-mail presente, flag `NOTIFICATIONS_ENABLED=false`  
**Dependências:** F1-01 e F1-02 para mensagens financeiras/logísticas; domínio de envio verificado

Ativar e-mail de novo pedido, mudança de status, falha de pagamento e eventos relevantes. Push fica separado em `PUSH-001`. A notificação deve ser best-effort, observável e reprocessável sem duplicação indevida.

**Critério de saída:** domínio e segredo configurados; templates aprovados; fornecedor recebe novo pedido; falha do provedor não desfaz a operação; retry controlado; logs não expõem e-mails ou payloads pessoais.

### F1-04 — REPORT-001: relatórios com dados reais

**Prioridade:** P1  
**Status:** interface existe; parte dos indicadores parece fixa/demonstrativa  
**Dependências:** F1-02

Remover variações e séries hardcoded dos relatórios. Derivar entregas, cancelamentos, receita e categorias de fontes persistidas, com período, timezone e moeda definidos. Separar pedido criado, pago, enviado e entregue.

**Critério de saída:** CSV corresponde aos dados filtrados; valores demonstrativos desaparecem ou ficam explicitamente marcados; testes cobrem período, vazio, timezone, cancelamento e múltiplos fornecedores.

### F1-05 — CHAT-001: fechar o M7 do assistente

**Prioridade:** P1  
**Status:** código avançado; backlog registra M7 pendente  
**Dependências:** F0-01, Workers AI habilitado e ambiente de teste controlado

Executar deploy/QA com modelo real, testar texto e imagem, retry com imagem, HEIC, produto ausente, erro do provedor, vazamento de sintaxe e encaminhamento para o checkout. A IA continua sem autoridade para alterar papel, ownership ou pagamento.

**Critério de saída:** evidência do modelo real; resposta sem tool syntax; imagem chega ao modelo; seleção não cria pedido automaticamente; limites de custo, tempo e tamanho definidos; fallback de provedor documentado.

### F1-06 — QA-001: regressão integrada e validação humana

**Prioridade:** P0  
**Status:** parcialmente coberta por testes históricos e checklist Gemini  
**Dependências:** F0-01; repetir após F1-01/F1-02 antes de lançamento

Consolidar testes de contracts, backend, frontend, typecheck, build, autorização, concorrência de estoque, idempotência, checkout multi-fornecedor, assistente e mobile real. O workflow de deploy observado não contém etapas explícitas de teste, então o gate deve ser formalizado em CI antes da liberação.

**Critério de saída:** relatório com commit, ambiente, comandos, resultado e limitações; CI bloqueia deploy quando checks essenciais falham; matriz do PRD coberta; validação manual assinada pelo responsável.

## FASE 2 — Retenção e eficiência comercial

### F2-01 — ORDER-001: pedidos preferenciais e recompra

**Prioridade:** P1  
**Status:** feature 009 pendente  
**Dependências:** F1-01, F1-02 e histórico confiável de pedidos

Sugerir fornecedor/produto com base em histórico, permitindo aceitar ou ignorar. Não transformar preferência em obrigação: preço, estoque, prazo e disponibilidade devem ser revalidados no momento da recompra.

**Critério de saída:** sugestão explicável; usuário controla a decisão; pedido novo usa preço/estoque atuais; sem exposição de dados de outros compradores; métricas de aceitação e abandono definidas.

### F2-02 — UX e acessibilidade dos fluxos principais

**Prioridade:** P1  
**Status:** contínuo  
**Dependências:** F1-06

Revisar login, catálogo, sacola, checkout, chat e painel do fornecedor em mobile e desktop. Corrigir foco, teclado, mensagens, estados vazios, rolagem e linguagem de pagamento/entrega.

**Critério de saída:** checklist WCAG aplicável executado; fluxos críticos navegáveis sem mouse; erros acionáveis; validação em dispositivo real.

## FASE 3 — Leilão reverso como produto independente

### F3-01 — AUCTION-001: especificação e serviço de leilão reverso

**Prioridade:** P2  
**Status:** bloqueado pela decisão D-014 e pela flag `LEILAO_ATIVO=false`  
**Dependências:** F1-06, marketplace estável, contrato comercial e arquitetura própria

Tratar leilão como microserviço reutilizável. Definir solicitação com prazo, elegibilidade, lances em tempo real, não concorrência, encerramento, escolha, auditoria, autorização por tool/API e integração reversível com o marketplace.

**Critério de saída:** spec e ADR aprovadas; serviço não altera diretamente o checkout sem contrato; concorrência e relógio testados; fornecedores não veem dados indevidos; flag reativa todos os pontos sem regressão.

## FASE 4 — Integrações e escala

### F4-01 — ERP-001: hub de fornecedores e ERPs

**Prioridade:** P2  
**Status:** feature 007 do roadmap futuro  
**Dependências:** F1-01, F1-02, catálogo e pedidos estáveis

Definir sincronização de catálogo, estoque, preços, pedidos e status. Especificar fonte de verdade, conflitos, retries, autenticação por fornecedor e observabilidade.

**Critério de saída:** contrato por ERP; sync idempotente; fila/reprocessamento; reconciliação; isolamento de credenciais; piloto com um fornecedor.

### F4-02 — PUSH-001: notificações push

**Prioridade:** P2  
**Status:** feature 010b pendente  
**Dependências:** F1-03, decisão de PWA e consentimento

Adicionar service worker, inscrição, revogação e eventos push. E-mail permanece canal de fallback para eventos críticos.

**Critério de saída:** consentimento explícito; revogação funciona; tokens não aparecem em logs; notificações duplicadas são evitadas; comportamento offline documentado.

### F4-03 — SCALE-001: desempenho, capacidade e recuperação

**Prioridade:** P2  
**Status:** metas ainda não definidas  
**Dependências:** F1-06 e definição de volume esperado

Definir SLOs de API, frontend, chat e dependências. Medir p50/p95, concorrência de estoque, custo de Workers AI, limites do container frontend, backup/restore D1 e rollback de Worker.

**Critério de saída:** baseline reproduzível; limites conhecidos; alertas; procedimento de rollback; RPO/RTO aprovados; teste de restauração executado.

## Itens transversais obrigatórios

| Item | Motivo | Quando revisar |
|---|---|---|
| Harness de desenvolvimento | É a proteção de previsibilidade definida pelo projeto | Em toda sessão; não modificar incidentalmente |
| Harness de ferramentas de IA | Valida argumentos e contexto de usuário | Antes de cada nova tool mutável |
| Contratos Zod | Frontend e backend compartilham semântica | Ao alterar API, pagamento, logística ou leilão |
| Request ID e logs | Suporte e diagnóstico sem PII | Em toda integração externa |
| RBAC e ownership | Proteção contra acesso cruzado | Em toda rota, tool ou webhook |
| Idempotência | Evita duplicidade financeira, logística e notificações | Em retry, webhook, fila e sync |
| PRD/spec/ADR | Evita implementar decisão não aprovada | Antes de cada fase de código |

## Priorização imediata

1. Concluir as três pendências do checklist E2E do Gemini.
2. Planejar `AUDIT-001` com spec própria.
3. Formalizar o contrato do beta e a diferença entre pedido de teste, pedido pago e entrega.
4. Escolher entre iniciar `AUTH-SEC` como correção de segurança ou detalhar `PAY-001` como primeiro grande marco comercial.
5. Depois da decisão, executar uma única feature por sessão conforme o harness.

## Não iniciar ainda

- Não ligar `LEILAO_ATIVO`.
- Não ativar `NOTIFICATIONS_ENABLED` em produção sem domínio, segredo e templates validados.
- Não trocar mocks por gateway/fulfillment sem decisão comercial e specs.
- Não remover `ADMIN_UID` implicitamente dentro de outra tarefa.
- Não editar `AGENTS.md`, `CLAUDE.md`, `GEMINI.md`, `.agents/`, `docs/governance/` ou outras partes do harness como efeito colateral deste backlog.

## Critério de atualização

Ao concluir uma fase, atualizar este arquivo, o backlog de máquina legível e o progresso de sessão somente com evidência reproduzível. Registrar commit, testes, ambiente, validação manual, limitações e a próxima dependência. Um relato de agente é contexto; testes e validação são a prova.
