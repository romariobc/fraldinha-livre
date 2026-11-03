# MP-06 — Histórico e acompanhamento persistidos

Base: 7ad88a9 (MP-05), preservada na tag remota checkpoint/mp05-2026-11-02. Branch de trabalho: codex/mp-06-order-tracking. Escopo autorizado: somente MP-06. Compras, pagamento e entrega continuam demonstrativos.

## Implementação identificada por leitura de código

- GET /orders/:id?scope=comprador|fornecedor|admin valida papel e vínculo. Snapshot, itens e order_events são lidos em um D1.batch. A resposta é validada por OrderDetailSchema.
- Eventos expõem apenas ID, status anterior/novo, UID do ator, horário e motivo registrado. Não expõem requestId, mutationId nem efeito interno de estoque. Empate de horário respeita ordem de inserção no banco.
- O fornecedor gravado em orders.supplier_id prevalece sobre alterações no catálogo. Somente registros legados sem esse vínculo conservam o fallback anterior por itens/produtos, também usado na operação legada. Essa compatibilidade não comprova a identidade histórica do fornecedor; registros sem vínculo confiável precisam de reconciliação administrativa antes da liberação.
- historySource=legacy significa ausência de eventos; partial significa que não existe evento inicial de criação; complete começa pelo evento de criação. Não há backfill de autoria, horário ou eventos fictícios.
- OrderTracking compartilha a apresentação entre os três perfis: estado, snapshot da compra e linha do tempo. Pedidos legados sem linhas exibem resumo identificado como legado.
- use-live-order-query.ts atualiza ao montar, retomar foco/visibilidade e a cada 30 segundos visíveis. Telas comprador/fornecedor solicitam atualização ao abrir a rota. Atualização manual usa a mesma consulta; gatilhos simultâneos compartilham a requisição em andamento por recurso. Respostas de contas anteriores são descartadas.
- Falha de rede mantém dados carregados com aviso. Detalhes e listas têm chaves próprias por conta/escopo/pedido; não são sincronização em tempo real nem um cache compartilhado entre dispositivos. Leitura após nova sessão vem da API/D1.

## Matriz de aceite e evidência

| Critério | Evidência | Resultado e limite |
|---|---|---|
| Mesmo snapshot, estado e eventos nos três papéis | back/test/mp06-history.test.ts: criação, confirmação, despacho, entrega e novas consultas; escopos cruzados negados | Verificada por execução no D1 real de testes |
| Autor, horário e motivo persistidos | Cancelamento administrativo e ordenação de eventos com o mesmo timestamp | Verificada por execução no D1 de testes |
| Edição de produto não transfere pedido com fornecedor gravado | Troca de nome/preço/fornecedor do produto e consultas pelas duas contas | Verificada por execução |
| Abertura, foco, 30s visíveis e manual; sem sobreposição | front/src/hooks/__tests__/use-live-order-query.test.tsx | Verificada por execução com relógio controlado |
| Falha de rede preserva dados; conta anterior não vaza | Testes do hook, OrderTracking e providers comprador/fornecedor | Verificada por execução |
| Legado sem eventos ou apenas com mudanças posteriores | Fixtures D1 sem eventos/itens e teste visual legacy/partial | Verificada por execução; sem histórico inventado |
| Jornada autenticada entre papéis e nova sessão | scripts/qa-mp06-browser.cjs | Em validação; resultado final registrado na PR |

## Validação desta execução

- Frontend completo: 753 testes em 77 arquivos aprovados antes dos ajustes finais de dependências/abertura de rota; tipos finais aprovados. Contratos: 63 testes aprovados.
- Backend focal: 13 testes de histórico e escopo fornecedor aprovados, com testTimeout=30000 e hookTimeout=60000 no ambiente local. Os quatro testes novos também passaram isoladamente com a configuração original.
- A suíte backend completa local teve limites de tempo excedidos sob concorrência com os servidores de QA. A matriz original, sem ampliar limites no repositório, é obrigatória na CI final. Nenhuma configuração de testes foi relaxada no código versionado.
- A primeira execução frontend por pipes não iniciou workers dentro do limite. Reexecução em terminal próprio passou; houve também correção de fixtures administrativas para o schema compartilhado e substituição da expectativa antiga de consultas sobrepostas pela regra aprovada da MP-06.
- Lint completo sem erros; três avisos novos de dependências foram corrigidos e os módulos alterados passaram no lint focal. Permanecem dez avisos preexistentes. CI final, build de produção e commit exato ficam na PR.
- O primeiro servidor dev Turbopack não concluiu a compilação de login; reiniciado com --webpack, sem alterar configuração de produção. Fixture QA recebeu o campo obrigatório descricao. Falha inicial de JWKS recebeu 401; houve retry autenticado normal, sem bypass.

## Limites operacionais e retorno

Sem nova migração nesta etapa. O D1 local separado mp06-d1 recebeu as migrações existentes até 0015; nenhum banco remoto foi migrado. Contas QA existentes são usadas apenas para autenticação/leitura de perfil; operações comerciais são restritas ao backend local e notificações externas ficam desativadas. A jornada não chama o assistente/AI.

Não houve merge, deploy ou nova identidade. Antes de publicação, é necessário reconciliar as PRs anteriores, cumprir o processo de migração/backup e homologar o ambiente remoto. Os checkpoints preservam código e documentação, não dados remotos ou credenciais.

Logs, imagens e estado D1 em docs/qa-artifacts/ são locais e ignorados pelo Git. O script reproduzível não contém credenciais nem grava sessão de autenticação em arquivo. O checkpoint anterior é checkpoint/mp05-2026-11-02 (7ad88a9); o checkpoint final será publicado somente após CI aprovada.

MP-07 não iniciado: depende de aprovação explícita do usuário após esta entrega.
