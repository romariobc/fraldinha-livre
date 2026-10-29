# Backlog vigente — Marketplace demonstrativo em produção

**Revisão:** 26 de outubro de 2026.

**Base local:** `1322ac6`; árvore de trabalho limpa na entrada do MP-00.

**Origem:** plano e decisões aprovados pelo usuário nesta conversa.

**Escopo desta edição:** somente MP-00, documental; nenhuma regra abaixo foi implementada no runtime por esta etapa.

## Objetivo e contrato da versão

Concluir um marketplace demonstrativo publicado em produção, com cadastro, catálogo, compra, venda, cancelamento, registro, acompanhamento e atendimento persistidos e consistentes entre comprador, fornecedor e administrador.

Produção designa o ambiente publicado. As compras, os pagamentos e as entregas são exercícios demonstrativos, sem cobrança ou obrigação de entrega física. A criação de um pedido no D1 não comprova pagamento recebido nem contratação de transporte.

### Decisões de produto aprovadas

| Tema | Regra da versão |
|---|---|
| Compra e pagamento | Simulados, com aprovação e recusa disponíveis; sem solicitar dados reais de cartão. Pagamento pending não será exposto até possuir ciclo completo. |
| Fornecedores | Novos fornecedores dependem de aprovação administrativa antes de publicar ofertas e receber pedidos. Papel e habilitação comercial são verificações distintas. |
| Cancelamento pelo comprador | Somente em `aguardando`. |
| Cancelamento por fornecedor/admin | Em `aguardando` ou `confirmado`, com motivo obrigatório. |
| Após despacho | Em `a-caminho`, registrar ocorrência; sem cancelamento direto ou devolução automática de estoque. |
| Entrega | Fornecedor marca `entregue`; comprador acompanha e pode registrar ocorrência. |
| Atendimento | Ocorrência vinculada ao pedido, com resposta e encerramento. |
| Avisos obrigatórios | Notificações internas persistidas. E-mail e push ficam posteriores. |
| Assistente de IA | Outra etapa; indisponível nesta liberação e não é critério de homologação do marketplace. |
| Expansões | Pagamento real, estorno financeiro, transporte/devolução física, leilão, ERP e aplicativo nativo ficam posteriores. |

Essas regras são o alvo aprovado. Não descrever aprovação de fornecedores, novo cancelamento, ocorrências ou notificações como entregues antes de seus critérios passarem.

## Execução e aprovação entre etapas

1. Cada item MP-00 a MP-12 é uma etapa. A ordem numérica é a sequência de execução, mesmo quando as dependências técnicas permitirem outro arranjo.
2. Executar somente a etapa explicitamente autorizada; validar, registrar resultado e limitações e parar para revisão do usuário.
3. `status: done` indica que os critérios técnicos/documentais da etapa passaram. `aprovacao_usuario` registra separadamente a aprovação humana da entrega/início da próxima etapa.
4. A conclusão de uma dependência não autoriza avanço. A aprovação deste planejamento tampouco representa aprovação antecipada de todas as implementações.
5. Commit, push, publicação, migrações e alteração de segredos seguem o escopo autorizado; não são efeitos colaterais de QA ou de conclusão de etapa.
6. Não delegar nem iniciar trabalho concorrente sem autorização. Não alterar o harness incidentalmente.

**Ponto de controle atual (29/10/2026):** MP-01 aprovado. MP-02 concluído, com testes e CI hospedado aprovados, aguardando aprovação da entrega; PR #23 em rascunho, dependente da PR #22. Sem merge/deploy/migração remota. MP-03 não iniciado e sem autorização. Ver [relatório MP-02](qa/MP-02-integridade-pedidos-estoque.md).

## Ordem do backlog

P0 = fluxo obrigatório, integridade ou condição de liberação; P1 = conclusão operacional. Todos os itens MP são obrigatórios para a liberação, inclusive MP-10. Prioridade não remove dependências nem substitui aprovação.

| Etapa | Prioridade | Entrega | Dependências técnicas | Estado |
|---|---|---|---|---|
| MP-00 | P0 | Organizar o backlog e o contrato da versão | — | done; aprovado pelo usuário |
| MP-01 | P0 | Tornar validação e publicação previsíveis | MP-00 | done; aprovado pelo usuário |
| MP-02 | P0 | Garantir integridade de pedidos e estoque | MP-01 | done; aguarda aprovação da entrega |
| MP-03 | P0 | Concluir cadastro, acesso e aprovação de fornecedores | MP-02 | todo; início depende de aprovação |
| MP-04 | P0 | Homologar catálogo e manutenção de ofertas | MP-03 | todo; início depende de aprovação |
| MP-05 | P0 | Fechar checkout simulado e recuperação de falhas | MP-02, MP-04 | todo; início depende de aprovação |
| MP-06 | P0 | Registrar e acompanhar o ciclo do pedido | MP-05 | todo; início depende de aprovação |
| MP-07 | P0 | Completar operação de venda e cancelamento nas interfaces | MP-06 | todo; início depende de aprovação |
| MP-08 | P0 | Implementar ocorrências com resposta | MP-06 | todo; início depende de aprovação |
| MP-09 | P0 | Entregar notificações internas persistidas | MP-03, MP-07, MP-08 | todo; início depende de aprovação |
| MP-10 | P1 | Concluir supervisão e relatórios confiáveis | MP-07, MP-08 | todo; início depende de aprovação |
| MP-11 | P0 | Preparar operação, recuperação e configuração de produção | MP-01, MP-10 | todo; início depende de aprovação |
| MP-12 | P0 | Homologar e liberar a versão completa | MP-00, MP-01, MP-02, MP-03, MP-04, MP-05, MP-06, MP-07, MP-08, MP-09, MP-10, MP-11 | todo; início depende de aprovação |

## Critérios e evidências por etapa

### MP-00 — Organizar o backlog e o contrato da versão

**Escopo:** Documentação e controle de execução.

**Itens anteriores relacionados:** `006`, `010`, `011`, `012`, `018`, `AUDIT-001`. Relação significa reaproveitamento/revalidação; não reabre nem conclui automaticamente o item anterior.

**Critérios de aceite:**

- Registrar as regras aprovadas da produção demonstrativa, os limites de escopo e o bloqueio de avanço sem aprovação do usuário.
- Organizar MP-00 a MP-12 com prioridade, dependências, critérios e evidências; reconciliar itens anteriores preservando identificadores, status e registros.
- Validar JSON, referências, dependências, consistência e diff; registrar a conclusão documental sem alterar o funcionamento do sistema.

**Evidência exigida:** Validação documental com resultado registrado no progresso; revisão do diff dos três arquivos e preservação dos 29 itens anteriores.

### MP-01 — Tornar validação e publicação previsíveis

**Escopo:** CI, scripts e publicação.

**Itens anteriores relacionados:** `TOOLING-001`. Relação significa reaproveitamento/revalidação; não reabre nem conclui automaticamente o item anterior.

**Critérios de aceite:**

- PRs destinadas à main executam testes de frontend/backend/contratos/runner, tipos, lint e build; o commit publicado precisa ter aprovação dos checks essenciais.
- Separar QA de deploy, manutenção de disco, commit e push; nenhum script de validação executa essas operações implicitamente.
- Comprovar o gate com caso de falha e execução aprovada; revisar configurações remotas necessárias sem inferir proteção de branch apenas pelo YAML.

**Evidência exigida:** Runs de CI ligados ao commit e caso negativo de bloqueio; diff dos scripts; registro de permissões/configurações e limitações remotas.

### MP-02 — Garantir integridade de pedidos e estoque

**Escopo:** API, D1, contratos e concorrência.

**Itens anteriores relacionados:** `006`, `017`, `QA-LOAD-001`. Relação significa reaproveitamento/revalidação; não reabre nem conclui automaticamente o item anterior.

**Critérios de aceite:**

- Criação, cancelamento e transição de status preservam a unidade atômica entre estado, movimento de estoque e evento; não há estoque negativo, restituição duplicada ou efeito parcial após falha.
- Idempotência é vinculada ao usuário e ao conteúdo: repetição equivalente recupera o resultado e reutilização com conteúdo diferente retorna conflito.
- Máquina de estados no servidor: comprador cancela em aguardando; fornecedor/admin em aguardando ou confirmado com motivo; a-caminho não permite cancelamento direto; entregue/cancelado são terminais.

**Evidência exigida:** Testes de integração D1 contra handlers com concorrência, retry, falha intermediária e disputa cancelamento/confirmação/despacho; contratos e tipos dos consumidores.

### MP-03 — Concluir cadastro, acesso e aprovação de fornecedores

**Escopo:** Identidade, perfil e habilitação comercial.

**Itens anteriores relacionados:** `005a`, `005b`, `007a`, `007`, `012`. Relação significa reaproveitamento/revalidação; não reabre nem conclui automaticamente o item anterior.

**Critérios de aceite:**

- Cadastro, login, recuperação de acesso, logout e perfil persistem corretamente; edição de perfil não altera privilégios.
- Habilitação comercial no D1 usa pendente/aprovado/rejeitado/suspenso; claims identificam papel e a API exige aprovação para publicar ofertas e receber novos pedidos.
- Admin decide com motivo e registro; fornecedor acompanha solicitação sem duplicação; suspenso não vende nem publica, mas consulta/conclui pedidos anteriores e responde ocorrências.
- Reconciliar fornecedores existentes por inventário explícito antes de ativar o bloqueio, sem aprovação automática por claim; assegurar retry seguro entre Auth, Firestore e D1.

**Evidência exigida:** Jornadas comprador/fornecedor/admin em navegador; testes de bypass da API, ownership, aprovação/rejeição/suspensão e falha entre serviços; inventário e plano de ativação.

### MP-04 — Homologar catálogo e manutenção de ofertas

**Escopo:** Catálogo público e fornecedor.

**Itens anteriores relacionados:** `002`, `007`, `014`. Relação significa reaproveitamento/revalidação; não reabre nem conclui automaticamente o item anterior.

**Critérios de aceite:**

- Fornecedor aprovado cadastra, edita e desativa somente suas ofertas; validações de preço, estoque e disponibilidade existem no servidor.
- Catálogo, vitrine e detalhe identificam a oferta e o fornecedor corretos, ocultam ofertas indisponíveis por moderação/habilitação e tratam filtros, paginação, vazio e erro.
- Preço/estoque são revalidados na compra; pedidos mantêm snapshots de itens, valores, fornecedor e endereço; produto com histórico é desativado preservando referências.

**Evidência exigida:** Testes de CRUD/escopos/contratos e navegação entre páginas; jornada com fornecedores distintos e produto alterado/desativado após compra.

### MP-05 — Fechar checkout simulado e recuperação de falhas

**Escopo:** Checkout, sacola e simulador.

**Itens anteriores relacionados:** `014`, `016`. Relação significa reaproveitamento/revalidação; não reabre nem conclui automaticamente o item anterior.

**Critérios de aceite:**

- Aprovação simulada gera pedido persistido e metadados de simulação no servidor; recusa não cria pedido nem consome estoque; não solicitar dados reais de cartão nem apresentar cobrança real.
- Preservar um pedido por fornecedor, sem prometer transação única da sacola; mostrar sucessos e falhas por grupo e remover da sacola apenas itens confirmados.
- Tentativa por usuário e chaves estáveis por fornecedor sobrevivem à recarga; retry após timeout recupera resultados existentes sem duplicar pedidos.
- Expor aprovação/recusa; cenário pending fica indisponível até possuir ciclo completo; endereço e itens são validados e a comunicação explica a simulação.

**Evidência exigida:** E2E de um/múltiplos fornecedores, aprovação/recusa, clique duplo, timeout antes/depois do commit, recarga e sucesso parcial; asserções de pedidos e estoque no D1.

### MP-06 — Registrar e acompanhar o ciclo do pedido

**Escopo:** Histórico persistido e acompanhamento.

**Itens anteriores relacionados:** `003`, `004`, `017`. Relação significa reaproveitamento/revalidação; não reabre nem conclui automaticamente o item anterior.

**Critérios de aceite:**

- Comprador, fornecedor e admin consultam o mesmo estado, snapshots e linha do tempo persistida com ator/horário/motivo aplicável, respeitando seus escopos.
- Atualizar ao abrir, retomar foco e a cada 30 segundos com página visível; oferecer atualização manual, evitar requisições sobrepostas e preservar dados em falha.
- Pedidos anteriores seguem legíveis como registros legados sem inventar autor/data de eventos inexistentes; detalhes e histórico continuam após nova sessão.

**Evidência exigida:** Testes de histórico/escopos/atualização e falha de rede; jornada cruzada entre papéis, nova sessão e fixtures de pedidos legados.

### MP-07 — Completar operação de venda e cancelamento nas interfaces

**Escopo:** Ações de comprador, fornecedor e administrador.

**Itens anteriores relacionados:** `004`, `017`, `012`. Relação significa reaproveitamento/revalidação; não reabre nem conclui automaticamente o item anterior.

**Critérios de aceite:**

- Interfaces oferecem apenas ações compatíveis com papel, ownership e estado, reutilizando a autorização definitiva do backend.
- Fornecedor confirma, despacha e marca entregue; comprador acompanha/cancela em aguardando; fornecedor/admin cancelam antes do despacho com motivo obrigatório.
- Conflitos concorrentes retornam mensagem acionável e atualizam o estado; entregue/cancelado não reabrem; após despacho, encaminhar problema para ocorrência.

**Evidência exigida:** Testes comportamentais e jornada completa por papel, cancelamento permitido/negado, estado terminal, concorrência e atualização após erro.

### MP-08 — Implementar ocorrências com resposta

**Escopo:** Atendimento vinculado ao pedido.

**Itens anteriores relacionados:** `003`, `004`, `012`. Relação significa reaproveitamento/revalidação; não reabre nem conclui automaticamente o item anterior.

**Critérios de aceite:**

- Comprador ou fornecedor vinculado abre ocorrência; partes e admin consultam/respondem sem exposição a terceiros.
- Persistir mensagens e estados aberta/em_atendimento/resolvida; encerramento exige resposta de resolução e registro de ator/horário.
- Ocorrência não muda estoque/status comercial implicitamente; anexos e reabertura ficam fora desta versão; adaptar registros anteriores sem perda.

**Evidência exigida:** Testes de autorização/ownership, mensagens, resolução e compatibilidade dos reports existentes; jornada entre comprador, fornecedor e admin.

### MP-09 — Entregar notificações internas persistidas

**Escopo:** Central de avisos dentro do sistema.

**Itens anteriores relacionados:** `010`. Relação significa reaproveitamento/revalidação; não reabre nem conclui automaticamente o item anterior.

**Critérios de aceite:**

- Eventos de novo pedido, mudança de status, cancelamento, decisão de cadastro e resposta em ocorrência geram aviso para o destinatário correto.
- Avisos persistem, têm estado de leitura e link autorizado; deduplicar por evento/destinatário e permitir recuperação sem perda ou duplicação.
- Notificações derivam de eventos persistidos; falha visual não desfaz a operação; e-mail/push não são dependências desta entrega.

**Evidência exigida:** Testes de destinatário, isolamento, deduplicação, leitura, retry e destino do link; jornada de cada evento com nova sessão.

### MP-10 — Concluir supervisão e relatórios confiáveis

**Escopo:** Administração e indicadores.

**Itens anteriores relacionados:** `012`, `AUDIT-001`. Relação significa reaproveitamento/revalidação; não reabre nem conclui automaticamente o item anterior.

**Critérios de aceite:**

- Admin acompanha solicitações, pedidos e ocorrências e intervém com autorização, justificativa e trilha de auditoria; preservar moderação/auditoria já entregues.
- Indicadores e CSV derivam de dados persistidos com filtros, período, timezone e moeda consistentes; remover deltas/séries fixos.
- Exibir valor de pedidos simulados separado de recebimento financeiro; busca, paginação, estados vazios/erro e exportação refletem os dados consultados.

**Evidência exigida:** Testes de filtros/páginas/CSV/limites de período e ações administrativas; conciliação de indicadores com fixtures persistidas e jornada no navegador.

### MP-11 — Preparar operação, recuperação e configuração de produção

**Escopo:** Ambientes, acesso administrativo e operação.

**Itens anteriores relacionados:** `OBS-001A`, `OBS-001B`, `OBS-002`, `OBS-002.1`, `OBS-004`, `AUDIT-001`, `TOOLING-001`. Relação significa reaproveitamento/revalidação; não reabre nem conclui automaticamente o item anterior.

**Critérios de aceite:**

- Separar QA e dados demonstrativos de produção; documentar limites operacionais, suporte, alertas mínimos e rollback sem ativar integrações fora do escopo.
- Ensaiar backup/restauração em ambiente isolado e registrar integridade, duração e metas RPO/RTO; não considerar simples configuração como prova de recuperação.
- Remover exceções administrativas por UID no backend/Firestore somente após confirmar claims e acesso administrativo; validar casos negativos e plano de rollback.
- Preparar migrações aditivas, reconciliação de dados e desativação do assistente nas superfícies e rota desta versão, sem apagar sua implementação ou iniciar homologação de IA.

**Evidência exigida:** Relatório do ensaio de restauração, runbooks e configuração/alertas verificáveis; testes de claims e regras Firestore; evidência administrativa e negativa; revisão de migrações.

### MP-12 — Homologar e liberar a versão completa

**Escopo:** Homologação integrada e liberação controlada.

**Itens anteriores relacionados:** `001`, `002`, `003`, `004`, `005a`, `005b`, `006`, `007a`, `007`, `012`, `013`, `014`, `015`, `016`, `017`, `QA-LOAD-001`. Relação significa reaproveitamento/revalidação; não reabre nem conclui automaticamente o item anterior.

**Critérios de aceite:**

- Aprovar a matriz funcional/negativa no commit candidato: cadastro, aprovação de fornecedor, catálogo, checkout multi-fornecedor, venda, cancelamento, ocorrência, avisos, administração e relatórios.
- CI aprova testes/tipos/lint/build; navegador desktop/mobile comprova fluxos e acessibilidade básica; concorrência e recuperação não deixam falhas críticas/altas conhecidas nos fluxos obrigatórios.
- Depois de autorização específica para operações remotas, aplicar migrações/publicação controladas e comprovar smoke e jornada demonstrativa identificada pós-deploy; registrar ambiente, versão e limites.
- Comunicação em catálogo/checkout/confirmação/pedidos/relatórios explica simulação; assistente/leilão ficam indisponíveis; nenhuma evidência local isolada substitui homologação operacional.

**Evidência exigida:** Matriz por critério com commit, ambiente e resultados, CI e build; capturas e jornada autenticada; evidência de migração, publicação, smoke e rollback disponível.

## Regras de implementação já definidas

- Preservar `aguardando → confirmado → a-caminho → entregue`; `cancelado` e `entregue` são terminais. O servidor centraliza transições, ownership e permissões.
- No D1, tratar estado, movimento de estoque e evento correspondente como unidade atômica, com controle de concorrência e proteção contra repetição.
- Manter um pedido por fornecedor. Recuperar compra parcial com tentativa por usuário e chaves estáveis por grupo; não prometer atomicidade de toda a sacola.
- O backend identifica simulação e gera seus metadados; o navegador não tem autoridade para declarar pagamento real. Usar “valor do pedido simulado”, sem confundir com faturamento recebido.
- Habilitação comercial do fornecedor no D1: `pendente`, `aprovado`, `rejeitado`, `suspenso`. Suspenso não publica/não recebe novas compras, mas atende pedidos anteriores. Reconciliar fornecedores existentes explicitamente.
- Preservar snapshots comerciais e referências de produtos; não reescrever pedidos ao alterar perfil/catálogo.
- Acompanhamento ao abrir, retomar foco e a cada 30 segundos com página visível, com atualização manual, sem requisições sobrepostas e sem apagar dados em falha.
- Ocorrências: `aberta`, `em_atendimento`, `resolvida`; participantes vinculados e admin podem responder; resolução exige resposta. Anexos e reabertura ficam posteriores.
- Notificações derivam de eventos persistidos e são deduplicadas por evento/destinatário. Migrações são aditivas e não inventam atores/horários para eventos legados.
- Preservar Firebase Auth/Firestore e Cloudflare Workers/D1/Containers. Reutilizar contratos Zod, cliente HTTP, ports/adapters e erros tipados existentes.

## Reconciliação do backlog anterior

Os 29 registros anteriores de [feature_list.json](../context/estado/feature_list.json) permanecem com seus identificadores, status, critérios e notas originais. Cada um recebe contexto de reconciliação; os 13 itens MP são novos. `fase` preserva o significado histórico; a sequência vigente usa `ordem` dos itens MP.

| Registro anterior | Tratamento vigente |
|---|---|
| 002, 003, 004, 006, 007a | Notas iniciais de mocks, Google Cloud ou homologação pendente são históricas; não descrevem sozinhas o estado atual. Reaproveitar a integração e conferir a evidência por item MP. |
| 005a, 005b, 007, 014, 016, 017 | Preservar entregas; MP-02 a MP-07 cobrem mudanças/revalidações necessárias. Compra/cancelamento anteriores não comprovam as regras novas desta versão. |
| 012, AUDIT-001, AUDIT-001-QA | Administração e auditoria possuem entregas e homologação registradas; não recriá-las como inexistentes. Ampliar somente o necessário nos itens MP. |
| OBS-* e TOOLING-001 | Reaproveitar observabilidade, erros e ferramentas; verificar condições atuais quando a etapa correspondente exigir. |
| QA-LOAD-001 | Preservar o teste de carga registrado; ele não prova todos os cenários de cancelamento concorrente/falha intermediária do MP-02. |
| 010 | E-mail/push continuam com status histórico `in_progress`, fora desta liberação. Notificação interna é MP-09 e não depende de Resend. |
| 011 | Gateway real continua `todo`, posterior; não bloqueia a produção demonstrativa. |
| 018 | Assistente continua com status histórico `in_progress`, em outra etapa; não iniciar sua homologação nesta sequência. |
| 008, 009 | Leilão e recompra preferencial permanecem posteriores, com status e dependências históricos preservados. |
| F0-01/F0-02 do documento anterior | Pendências antigas de jornada/admin não devem ser reapresentadas como inexistência: consultar os marcos posteriores já registrados no progresso. |
| AUTH-SEC, REPORT-001, SCALE-001 | Partes aplicáveis à versão estão em MP-11, MP-10 e MP-11/MP-12. Escala/integrações futuras não entram automaticamente no escopo. |

O [PRD anterior](PRD-Fraldinha-Livre.md) e as [decisões existentes](governance/decisoes.md) permanecem como referências datadas. Para o escopo desta entrega, prevalecem as decisões explícitas do usuário registradas acima; esta edição não altera esses arquivos nem o harness.

## Homologação e definição de pronto

Aplicar a [matriz por critério](qa/README.md) e os [comandos proporcionais ao escopo](governance/ciclo-de-sessao.md).

- Jornadas: cadastro/recuperação/login/perfil; aprovação de fornecedor; catálogo; compra simples e multi-fornecedor; confirmação/despacho/entrega; cancelamento; ocorrência/resposta; avisos; administração/relatórios.
- Casos negativos: token/papel inválido, acesso cruzado, fornecedor não aprovado, manipulação de preço/quantidade, estoque insuficiente, retry, chave conflitante, falha entre gravações e transições concorrentes.
- Verificar contratos, API/D1, componentes, tipos, lint e build conforme impacto; navegador desktop/mobile e acessibilidade básica no candidato à liberação.
- Evidência registra revisão, ambiente, comandos, resultados e limitações. Testes herdados ou mockados não comprovam nova homologação operacional.
- Liberar somente com MP-00 a MP-12 homologados/aprovados, sem defeitos críticos/altos conhecidos nos fluxos obrigatórios, comunicação de simulação e procedimentos de suporte/recuperação/rollback verificáveis.

**MP-00 valida somente documentação.** Nenhum teste de aplicação, deploy, migração ou mudança de comportamento é requisito desta etapa.

## Referência histórica — planejamento de 20/09/2026 (superado)

O conteúdo integral anterior está preservado abaixo apenas para rastreabilidade. Sua ordem, prioridades, pendências e responsáveis sugeridos não autorizam trabalho e não substituem MP-00 a MP-12. Não carregar este trecho por padrão em sessões de implementação.

<details>
<summary>Consultar o backlog anterior, sem vigência como sequência de execução</summary>

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

</details>
