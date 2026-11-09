# MP-11 — Operação, recuperação e configuração

Aprovado para iniciar em 08/11/2026. Candidato na branch `codex/mp-11-operational-readiness`, sobre o commit `c3c8dbc` da PR #32. A CI de MP-10 foi reconferida com 12 checks bem-sucedidos. [Runbook do marketplace](../operations/marketplace.md).

| Critério | Evidência da etapa | Limite |
|---|---|---|
| Separação de QA e produção | Bindings D1 remotos de homologação e produção distintos. Ensaios com UUID D1 local novo, origem loopback e projeto Firestore demo | A jornada do candidato ocorreu em ambiente local |
| Operação, suporte e alertas | Sinais, janelas e primeira resposta no runbook. Logs habilitados nos dois backends e correlação por `X-Request-Id` conferida no Worker local | Limiares propostos. Políticas observadas na conta são de orçamento |
| Restauração | Backup de fixture em arquivo independente, alteração posterior simulada, restauração em novo arquivo com hash lógico idêntico, integridade `ok` e zero violações de chave estrangeira | Ensaio SQLite e D1 locais. RPO/RTO de produção ainda precisam de aprovação e prova representativa |
| Acesso administrativo por claims | Assinatura, emissor e audiência de token real verificados. Worker candidato retornou 200 para admin, 403 para comprador, 401 para token inválido. Onze verificações no emulador das regras | A troca em ambiente publicado tem validação própria |
| Revisão de migrações e reconciliação | Wrangler aplicou os 19 arquivos de migração até 0017 em D1 local. Inventário registrou 24 seeds históricos, zero elegíveis ao catálogo. Fixture pré-0013 preservou pedido sem vínculo/modalidade e texto inicial da ocorrência | Contagens de fixture e ambiente local |
| Assistente indisponível | Página `/assistente` orienta para catálogo. O Worker não registra `POST /chat/message` e retornou 404 com e sem token. ChatUI e handler seguem cobertos pelos testes existentes | Homologação da IA pertence a outra etapa |

## Reprodução

- Execute `python scripts/qa-mp11-restore.py` para criar fonte, backup, restauração e relatório sob `docs/qa-artifacts`. O resultado inclui SHA-256 lógico e do backup, hashes das migrações e contagens. O ensaio final preservou 25 produtos, dois pedidos, dois registros de ocorrência e um registro em cada uma das tabelas de itens, eventos, mensagens, auditoria, avisos e solicitações. A recuperação excluiu a única alteração posterior ao ponto salvo. Cópia em 0,131 s, restauração e verificação em 0,158 s, janela simulada entre o início da cópia e o incidente de 0,213 s.
- Com Java 21 e Firebase CLI, execute `firebase emulators:exec --only firestore --project demo-fraldinha-mp11 "node scripts/qa-mp11-firestore.mjs"`. O roteiro testa as duas formas de claim administrativa, negativas de escrita de perfil por admin, UID legado, conflito, acesso próprio e tentativa de promoção. A regra passou no emulador v1.19.8.
- Prepare um JSON local do Wrangler com binding DB novo, ID do projeto Firebase para as contas QA existentes, caminhos absolutos do Worker e das migrações e `NOTIFICATIONS_ENABLED=false`. Aplique `wrangler d1 migrations apply DB --local --config <json> --persist-to <diretorio>`. Rode a [consulta agregada](../../scripts/qa-mp11-reconcile.sql) com `d1 execute DB --local --file`, no mesmo diretório de persistência.
- Inicie o Worker com `node scripts/qa-mp10-local-api.cjs`, passando `QA_LOCAL_CONFIG`, `QA_LOCAL_PERSIST` com o caminho de `v3/d1` e `QA_API_ORIGIN=http://127.0.0.1:8796`. Execute `node scripts/qa-mp11-access.mjs` com essa origem. Use o arquivo de credenciais QA ignorado `.env.qa.local`. O roteiro não imprime e-mail, senha ou token.
- As regras administrativas removem a autorização baseada em UID no Worker, no frontend e no Firestore. O catálogo, os pedidos, a autoria e a edição de perfil seguem suas políticas. [Documentação Firebase sobre verificação e claims](https://firebase.google.com/docs/auth/admin/custom-claims).

A configuração real foi inspecionada em 08/11/2026 por consultas de metadados do GitHub e Cloudflare. A homologação publicada, a adoção das metas e a ativação dos alertas dedicados dependem da próxima decisão operacional.

## Resultado final

- O harness `node scripts/run-checks.mjs --build` saiu com código 0. Passaram 406 testes de backend, 790 de frontend, 75 de contratos e 47 do harness, total de 1.318. Tipos, lint e build passaram, com oito avisos de lint preexistentes. A primeira passagem encontrou uma expectativa antiga de acesso administrativo por UID. A expectativa foi atualizada para 403 e a suíte foi repetida.
- No navegador Edge em loopback, `/assistente` retornou 200 em 375 e 1024 px, com aviso, link focalizável, sem transbordamento e sem requisição de chat.
- O Wrangler exportou a base D1 local com `d1 export DB --local` e importou o SQL em persistência nova com `d1 execute DB --local --file`. As consultas via D1 retornaram 24 produtos e 19 migrações nas duas bases. A API D1 restringiu `PRAGMA integrity_check`, então os arquivos SQLite locais fechados foram abertos em modo somente leitura para conferir integridade, chaves estrangeiras e igualdade das linhas. SHA-256 da exportação `b4a9d0cf40b375167a9bc02d10ed7fdb02fa8632c1517c8432828eec6e18041a`.
- Os servidores de QA foram encerrados. O ensaio mede recuperação de uma fixture isolada. Time Travel e o tempo de retorno do serviço publicado ainda exigem a janela de homologação.
