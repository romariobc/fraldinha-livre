# MP-02 — Integridade de pedidos e estoque

Data: 29/10/2026, America/Fortaleza. Escopo autorizado: somente MP-02 após aprovação da entrega MP-01. MP-03 não autorizado.

## Problema e mudança

O código anterior diminuía estoque antes de gravar o pedido e executava compensações em chamadas posteriores. Cancelamento também separava mudança de status e restituição. Uma falha intermediária podia deixar estado parcial; duas transições podiam sobrescrever o status lido antes.

Agora `back/src/lib/order-atomicity.ts` reúne cada criação ou transição em um único `D1.batch`: pedido, itens, estoque e evento. Guardas SQL consultam preço, fornecedor, atividade e quantidade dentro da transação. A expansão JSON mantém constante a quantidade de parâmetros da guarda para sacolas maiores. Produtos repetidos são rejeitados antes de escrever.

As transições comparam o status e o identificador da mutação anterior. Se outra requisição ganhou a disputa, nenhuma restituição/evento da perdedora é aplicada. Repetição do estado já alcançado devolve o pedido sem novo efeito; outras transições conflitantes retornam 409. Não há compensação posterior à transação.

## Contrato e compatibilidade

- `POST /orders`: a chave permanece globalmente única e vinculada ao dono. Outro UID recebe 403, preservando a política anterior; não é um namespace independente por comprador. SHA-256 do payload validado e canônico detecta conteúdo diferente na mesma chave (409 `IDEMPOTENCY_CONFLICT`). Ordem dos itens e chaves JSON não muda o significado. Campos ignorados pelo schema não entram no hash.
- Pedidos anteriores sem fingerprint são comparados ao snapshot persistido; não se presume que qualquer payload com a mesma chave seja equivalente. Retries recuperam o pedido mesmo após mudança de preço no catálogo.
- Comprador cancela somente em `aguardando`. Repetir cancelamento do próprio pedido já cancelado retorna 200 sem nova restituição. Confirmado continua proibido para o comprador.
- Fornecedor/admin cancelam somente em `aguardando` ou `confirmado`, com `reason` de 5 a 500 caracteres após trim. Depois de `a-caminho`, cancelamento direto é negado. Entregue/cancelado são terminais; repetir o mesmo estado não gera evento.
- O motivo é persistido no evento. O adaptador HTTP, contexto e modal mínimo do fornecedor foram alinhados; não foi implementada a expansão de telas/ações prevista no MP-07. O modal preserva o motivo em falha e impede confirmação duplicada durante a requisição.
- O fornecedor persistido no pedido é a autoridade para alterar status. Lookup por itens é fallback apenas para pedidos legados sem fornecedor persistido.
- `mutation_id`, `request_fingerprint` e chaves internas não são expostos na resposta pública. A consulta/apresentação da linha do tempo é MP-06; esta etapa grava sua base, sem iniciar aquele backlog.

## Migração e implantação futura

`back/migrations/0012_order_atomicity.sql` adiciona `orders.request_fingerprint`, `orders.mutation_id` e `order_events`, com unicidade de mutação e índice por pedido/data. O schema Drizzle acompanha os campos. Não altera nem inventa eventos antigos. Um cancelamento legado com itens válidos recebe somente seu evento atual; se um item referencia produto inexistente, a operação falha sem alterar status ou estoque, exigindo reconciliação dos dados.

**Executado apenas em D1 local via applyD1Migrations dos testes.** Nenhum comando de migração remota ou deploy foi executado.

Implantação posterior exige autorização específica: backup/inspeção dos dados, migração aditiva antes do backend e atualização coordenada do frontend. O motivo obrigatório é uma mudança deliberada de contrato: frontend antigo/abas antigas sem motivo recebem 400 e devem ser atualizados. Não declarar zero downtime; o workflow existente publica backend antes do frontend. Uma janela autorizada precisa prever essa incompatibilidade temporária ou uma estratégia de rollout específica. Não relaxar a regra inventando um motivo no servidor para o fornecedor.

Em rollback operacional, pausar gravações e voltar código apenas com plano aprovado. Os campos/tabela adicionados devem ser preservados para auditoria; não apagar eventos como forma de rollback. O backend anterior não oferece as garantias transacionais desta etapa.

## Evidência e critérios

| Critério | Evidência executável | Resultado/limite |
|---|---|---|
| Criação sem efeitos parciais | Falha forçada por trigger no evento final, após itens/decrementos, pelos handlers reais | Passou no D1 local; pedido/itens/estoque são revertidos. |
| Cancelamento e confirmação atômicos | Falha no evento final e nova tentativa | Passou localmente; sem status parcial ou restituição duplicada. |
| Concorrência | Barreira sincroniza chegada dos batches; disputa de último estoque, mesma chave, cancelamento/confirmação/despacho | Passou localmente; invariantes observados no D1, não apenas em mocks. |
| Idempotência por conteúdo/dono | Mesmo payload, payload diferente, UID diferente, snapshot sem hash e itens reordenados | Passou localmente; 200/409/403 conforme contrato. |
| Regras de status/motivo | Contratos, testes de API e envio do motivo pelo cliente | Passou nos testes dirigidos; inclui admin após despacho e estados terminais. |
| Legado | Pedido sem mutation/hash e snapshot válido; nenhum evento de criação fabricado | Verificação local nos testes de mutação/replay. |
| Sacola maior | 21 produtos no novo teste de guarda JSON | Em consolidação. |
| Frontend | Suíte completa | 69 arquivos / 717 testes aprovados, exit 0. |
| Backend | Suíte completa antes do último caso de limite | 29 arquivos / 311 testes aprovados, exit 0. Nova execução dirigida inclui o caso de 21 produtos. |
| Contratos | Suíte completa | 7 arquivos / 58 testes aprovados, exit 0. |
| Tipos | Front, back e contracts | Aprovados, exit 0 nos três. |
| Lint e CI hospedado | Resultados a consolidar | Não confundir implementação local com aprovação operacional. |

Testes novos em `back/test/order-atomicity.test.ts` usam handlers e armazenamento D1/Miniflare reais. Somente autenticação é substituída por identidades de teste; proxies de D1 sincronizam entrada no batch ou mudam catálogo antes dele sem substituir a execução SQL. Não comprovam Firebase, Cloudflare de produção ou carga distribuída. O gatilho de falha existe somente na base de teste e é removido em finally.

Falhas iniciais registradas: motivos ausentes em fixtures antigas, fixture de cancelamento apontando para produto inexistente e mudança de texto do erro de estoque. Fixtures/contratos foram alinhados à regra aprovada, a mensagem de estoque foi preservada e os casos foram repetidos. Não foram ocultados erros de armazenamento como falta de estoque.

## Preservação, revisão e limites

- As alterações locais de MP-00/MP-01 e o commit de aplicação anterior `1322ac6` foram preservados no checkout principal.
- A branch `codex/mp-02-order-atomicity` parte de `f88027f` (PR #22). A nova PR depende da entrega anterior, ainda em rascunho; não há merge implícito.
- Sem homologação visual autenticada em navegador ou dispositivo físico nesta etapa. Os testes do modal cobrem comportamento/acessibilidade DOM, envio, falha e requisição pendente. A homologação completa das jornadas segue em MP-07/MP-12.
- Pagamento continua simulado. Aprovação de fornecedor, avisos e atendimento não foram antecipados.
- O veredito final e a revisão candidata serão registrados após consolidar testes e CI. Não iniciar MP-03 automaticamente.

## Referência técnica

A [documentação de D1.batch](https://developers.cloudflare.com/d1/worker-api/d1-database/) descreve a transação e o rollback da sequência em erro; [funções JSON do D1](https://developers.cloudflare.com/d1/sql-api/query-json/) documentam a expansão usada na guarda. As garantias desta implementação também foram exercitadas por falhas injetadas no runtime local.
