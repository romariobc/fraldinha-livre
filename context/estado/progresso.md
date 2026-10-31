# Estado atual — 2026-10-31

## Etapa autorizada: CTX-01 — reduzir custo de contexto (concluída localmente; aguarda aprovação)

- Pedido: resolver os cinco pontos da auditoria antes de MP-04. Escopo: guias, contexto seletivo, modelos/fixtures, imports locais explícitos e decomposição de tabela/checkout.
- MP-03: implementação entregue na PR #24, commit 17db34e; CI 40901914614 aprovado. Aprovação humana da entrega continua separada. PRs #22/#23/#24 sem merge/deploy por esta tarefa.
- MP-04: todo, não iniciado e sem autorização de início. Compra/pagamento permanecem simulados.
- Código local: monorepo front/back/contracts; identidade Firebase, perfis Firestore, dados comerciais D1. Alterações locais preexistentes das etapas anteriores preservadas.
- Fontes atuais: [arquitetura](../../docs/architecture/arquitetura-vigente.md), [roteiro de contexto](../README.md). Use node scripts/context.mjs status ID para ler somente o item do backlog.
- Dados remotos: inventário de 29/10 é fotografia, não revalidado nesta refatoração; nenhuma migração, publicação, aprovação comercial ou edição de dados remotos autorizada aqui.
- CTX-01 validada: 732 testes frontend, 58 contratos, 14 guardas; tipos nos três módulos; lint com 0 erros/10 avisos; imagem Docker de produção construída após repetição por falha inicial em next/font. Navegador desktop/mobile aprovado. [Relatório e limites](../../docs/qa/CTX-01-contexto-ia.md). Sem commit/push/deploy nesta etapa.

## Pendências da versão

- Seguir MP-04 a MP-12 somente conforme aprovação por etapa.
- Antes de ativar MP-03: reconciliar fornecedores e seguir [inventário/ativação](../../docs/qa/MP-03-inventario-ativacao.md).
- Cadastro de identidade nova e envio/retorno real da recuperação exigem homologação externa autorizada; evidências anteriores de navegador usaram contas QA existentes.

## Histórico sob demanda

- [Registro integral até 30/10, sem reescrita](progresso-ate-2026-10-30.md).
- [Histórico anterior](progresso-historico.md). Não carregar ambos na entrada normal.
- O registro curto descreve o estado; os relatórios em docs/qa/ guardam evidências e limites de cada entrega.
