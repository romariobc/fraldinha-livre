# MP-03 — inventário e ativação da habilitação comercial

Consulta realizada em 29/10/2026 no D1 `fraldinha-livre-db`, ID `a6da1bcf-ed51-4c8a-8dcb-cfd0c6c9e612`, pelo conector Cloudflare. Apenas SELECT; respostas confirmaram `changed_db: false`, `changes: 0` e `rows_written: 0`. É uma fotografia, que deve ser refeita antes da ativação.

## Inventário verificado por execução

| Identificador no D1 | Ofertas / ativas | Pedidos aguardando | Confirmados | A caminho | Encerrados |
|---|---:|---:|---:|---:|---:|
| `8GyypkqWVdbAesG036qXIRVVOji1` | 5 / 5 | 7 | 3 | 0 | 0 |
| `RLZxfzeih2hvC5VukqzaHcI8qHn2` | 5 / 5 | 7 | 3 | 0 | 0 |
| `cSK4LXIakuajmCSiJFaHOccck2s1` | 5 / 5 | 40 | 11 | 4 | 8 |
| `sup-001` | 78 / 78 | 2 | 0 | 0 | 7 |
| `sup-002` | 72 / 72 | 1 | 0 | 0 | 1 |
| `sup-003` | 72 / 72 | 1 | 0 | 0 | 0 |
| `sup-004` | 77 / 77 | 0 | 0 | 0 | 0 |
| **Total** | **314 / 314** | **58** | **17** | **4** | **16** |

Os três UIDs longos também estão declarados em `SUPPLIER_UIDS` no código local. Os quatro identificadores `sup-*` existem nos seeds. Essa correspondência foi identificada por leitura de código; não comprova legitimidade comercial, propriedade de todas as ofertas nem identidade Firebase dos identificadores legados. Não transferir produtos ou pedidos entre eles por inferência.

O banco remoto contém migrations `0010_audit_logs.sql` e `0011_simulated_payment.sql`. As tabelas `order_events` e `supplier_applications` estavam ausentes. Portanto MP-02/MP-03 continuam sem ativação remota.

Consultas reproduzíveis, sem dados de comprador:

```sql
SELECT supplier_id, COUNT(*) AS offers,
       SUM(CASE WHEN active=1 THEN 1 ELSE 0 END) AS active_offers
FROM products GROUP BY supplier_id ORDER BY supplier_id;

SELECT supplier_id, status, COUNT(*) AS orders_count
FROM orders GROUP BY supplier_id, status ORDER BY supplier_id, status;

SELECT name FROM sqlite_master
WHERE type='table' AND name IN ('supplier_applications','order_events');
SELECT name FROM d1_migrations WHERE name LIKE '001%' ORDER BY name;
```

## Plano de ativação — não executado

1. Obter autorização específica para implantação e migrações. Resolver dependências das PRs anteriores, obter CI aprovado e preparar janela coordenada, backup e restauração. A publicação automática atual aplica o backend antes do frontend; não presumir implantação sem interrupção.
2. Refazer o inventário. Reconciliar cada UID com cadastro e responsável, registrar decisão e motivo. Os quatro `sup-*` permanecem sem comprovação de identidade; manter novas vendas bloqueadas para eles até decisão explícita, preservando produtos e pedidos históricos. Não aprovar nem mapear automaticamente para uma conta de QA.
3. Aplicar migrations 0012/0013 na janela autorizada. A 0013 cria somente tabela/índice vazios: não aprova ninguém e não reescreve ofertas ou pedidos. Contas ausentes, pendentes, rejeitadas e suspensas ficam indisponíveis para novas vendas quando a nova API entrar.
4. Publicar API/cliente de forma coordenada e manter a janela até validar acesso administrativo. Cada fornecedor identificado abre o painel para criar sua solicitação pendente idempotente. O administrador confere o UID e decide com motivo pela nova interface/API; claim e allowlist não substituem essa decisão. Para identidade legada sem conta acessível, preparar tratamento explícito separado, sem inventar login ou autoria.
5. Validar catálogo público, novas compras simuladas e pedidos anteriores. A suspensão bloqueia publicação/edição e novas compras, mas não consulta, cancelamento permitido, despacho/entrega de pedidos existentes ou a autorização das ocorrências. O fluxo de respostas de ocorrências será implementado em MP-08; MP-03 não o antecipa.
6. Encerrar a janela somente quando fornecedores escolhidos estiverem explicitamente aprovados e as ofertas esperadas visíveis. A aprovação não implica reativar produtos que estavam despublicados.
7. Se houver falha, interromper novas compras e seguir o plano de restauração coordenada. Reverter apenas a API para uma versão anterior removeria a exigência de aprovação; não usar esse procedimento como rollback silencioso. Não excluir registros ou trilhas de auditoria.

## Impacto conhecido

Publicar a API nova sem reconciliação ocultaria inicialmente **todas as 314 ofertas** inventariadas e impediria novas compras desses fornecedores. Os **79 pedidos não encerrados** continuam acessíveis aos respectivos responsáveis e à administração; a aprovação comercial não é exigida pelas rotas de atendimento de pedidos anteriores.

A migração local e os testes não substituem a reconciliação/ativação em produção. Não houve atualização remota de perfis, pedidos, ofertas, claims, segredos ou habilitações comerciais nesta entrega.
