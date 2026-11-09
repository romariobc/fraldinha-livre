# Operação e recuperação do marketplace

## Ambientes e validação

Use D1 local com um identificador novo, persistência em `docs/qa-artifacts` e URL HTTP de loopback para ensaios com fixtures. A configuração local aponta `main` e `migrations_dir` ao checkout candidato e usa `NOTIFICATIONS_ENABLED=false`. O roteiro `scripts/qa-mp11-access.mjs` autentica contas QA existentes no Firebase e envia as consultas de negócio exclusivamente ao Worker local. As regras do Firestore são exercitadas no projeto emulado `demo-fraldinha-mp11`.

O Worker `fraldinha-livre-backend-homologacao` tem o binding `DB` vinculado a `fraldinha-livre-qa-integrated`. O Worker `fraldinha-livre-backend` usa `fraldinha-livre-db`. Esses vínculos foram conferidos pela API Cloudflare em 08/11/2026. Antes de usar homologação, conferir também o endpoint no frontend, o projeto de autenticação, os papéis e a ausência de escrita em produção. Uma conta de QA não transforma um endpoint de produção em homologação.

As compras, os pagamentos e as entregas desta versão são simulados. Relatórios apresentam valores dos pedidos simulados e não apuram receita recebida. Use dados fictícios para ensaios e conserve artefatos de QA fora do Git.

## Suporte e sinais de incidente

Registre ambiente, horário com fuso, versão, rota, status e `X-Request-Id`. O operador da sessão busca o mesmo ID no evento `http.request.completed` no Workers Logs e registra a ação no incidente. Use o canal de suporte aprovado pelo responsável pelo projeto. O responsável de plantão e o canal devem constar no registro da liberação.

| Sinal inicial proposto | Como verificar | Primeira resposta |
|---|---|---|
| Três falhas consecutivas de saúde em intervalos de um minuto | `GET /health` deve responder 200 com `{"ok":true}` | Conferir disponibilidade do Worker e abrir incidente |
| 5xx em pelo menos 5% das requisições comerciais em 5 min, com no mínimo 20 requisições, ou três falhas consecutivas de pedido | Filtrar `http.request.completed` por ambiente, rota e status | Pausar liberação, guardar amostras de IDs e verificar persistência/estoque antes de repetir |
| Uma recusa ao administrador designado após renovar e verificar o token | Consultar `/admin/audit-logs` e correlacionar 401/403 com `auth.token.invalid` ou `auth.role.forbidden` | Conferir projeto, assinatura e claims. Se aparecer após atualização, seguir o retorno de acesso |
| Uma violação de integridade ou divergência entre pedido, estoque e eventos | Comparar invariantes com a consulta de reconciliação e o ponto de recuperação | Suspender novas escritas no fluxo afetado e preservar o estado para investigação |

A prova local conferiu o corpo de saúde e a correlação por ID para 401, 403 e 404. A saúde da aplicação precisa também de uma consulta que confira dados, pois `/health` não consulta D1. Os logs dos dois Workers de backend estão habilitados. A conta tinha duas políticas de orçamento e nenhuma política dedicada ao marketplace na consulta de 08/11. A tabela define sinais para acompanhamento manual até que responsáveis, frequência e destino sejam aprovados.

## Preparação da publicação

1. Fixe o SHA candidato, a execução de CI e os identificadores das versões de Worker, contêiner e regras Firestore em uso. Confirme que a branch integrada contém o workflow de produção disparado por `workflow_dispatch` com confirmação, restrição a `main` e validação do mesmo SHA. Em 08/11, a `main` remota ainda tinha gatilho por push e o ambiente GitHub `Production` estava sem regra de proteção ou política de branch.
2. Confirme o administrador designado com token Firebase novo, assinatura e projeto válidos, claim administrativa sem conflito e consulta real ao endpoint administrativo. No candidato, rode também as negativas de comprador, UID antigo sem claim e claim conflitante. Confira o acesso às regras em homologação antes da troca em produção.
3. Compare a lista e a ordem das migrações pendentes com o ledger D1. Valide a cadeia em banco isolado e capture o ponto de retorno do banco antes da janela aprovada. Os arquivos históricos `0002` e `0004` carregam ou atualizam seeds. Caso estejam pendentes em produção, confira a procedência do banco e a exposição das ofertas antes de aplicar a cadeia. Trate os fornecedores `sup-001` a `sup-004` como seeds até decisão explícita. A aprovação comercial é o filtro de exposição dos produtos na versão candidata.
4. Use [o inventário agregado](../../scripts/qa-mp11-reconcile.sql) para contar pedidos sem fornecedor persistido, sem modalidade de pagamento ou sem eventos, ocorrências sem autoria e seeds elegíveis ao catálogo. Preserve a classificação de legado quando faltar fonte. Corrija vínculos só com evidência de origem e plano revisado por registro. Catálogo atual, status e valor não preenchem histórico de fornecedor, pagamento, autoria ou aviso. A versão candidata mantém a cadeia existente até `0017`.
5. Na janela autorizada, obtenha a leitura de referência, aplique apenas a sequência revisada e valide saúde, negócio, admin, recusas, auditoria e assistente indisponível no candidato implantado. Registre o SHA, as versões, o resultado e o operador antes de considerar a janela encerrada.

## Retorno e restauração

Meta proposta para discussão operacional de RPO até **15 minutos** e RTO até **60 minutos**. O RPO é a distância aceitável entre o incidente e o último estado recuperável. O RTO conta do início da resposta até a confirmação da retomada da operação. O ensaio local mede cópia, restauração e verificação de uma fixture pequena. A confirmação das metas em produção depende de ensaio representativo e aprovação do responsável.

1. Em falha de código ou acesso, suspenda o avanço e retorne as versões conhecidas de frontend, backend e regras afetadas. Use uma versão que aceite o esquema já aplicado. Se a troca de regras bloquear o administrador, reaplique a revisão anterior de regras sob autorização e confirme a recuperação com token novo. Registre e corrija a claim antes de tentar novamente.
2. Se houver corrupção de dados, suspenda escritas no fluxo afetado, identifique o intervalo, preserve o estado corrente e compare o ponto anterior à falha. No D1, obtenha e registre o bookmark de referência antes da migração e confirme a janela de recuperação disponível. Uma restauração Time Travel regrava o banco e pode descartar operações posteriores. A execução exige autorização específica e plano para reconciliar essas operações. [Documentação Cloudflare sobre Time Travel](https://developers.cloudflare.com/d1/reference/time-travel/).
3. Para a cópia lógica, use exportação SQL e importe primeiro em um destino vazio e separado. Guarde o hash do arquivo e confirme integridade, chaves estrangeiras, contagens, estoque, pedidos, eventos, ocorrências, auditoria e avisos. O arquivo SQLite do ensaio físico serve à recuperação local. Para importar em D1, use o formato SQL aceito pela plataforma. [Documentação Cloudflare de importação e exportação](https://developers.cloudflare.com/d1/best-practices/import-export-data/).
4. Após restauração, confira a cadeia de migrações e o ponto da cópia. Reabra escritas após validação do operador. Registre o intervalo de dados a reconciliar e o tempo real até o serviço voltar. Tags Git identificam versões de código. Backups do banco e versões de regras são evidências separadas.

Use [o relatório MP-11](../qa/MP-11-operacao-recuperacao.md) para reproduzir os ensaios.
