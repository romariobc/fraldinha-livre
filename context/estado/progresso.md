# Estado atual — 2026-10-31

## MP-04 — catálogo e manutenção de ofertas: entrega local concluída

- Execução autorizada pelo usuário em 31/10; MP-03 e CTX-01 aprovados para avançar. Compra e pagamento permanecem simulados.
- Checkpoint anterior publicado no GitHub: c12d4db; tag checkpoint/pre-mp04-2026-10-31; árvore recuperada por fetch em repositório separado e validada. [Como voltar](../../docs/governance/retorno-pre-mp04.md).
- MP-04: cadastro original, edição de preço/estoque, desativação preservando histórico, identificação por fornecedor/oferta e moderação separada da publicação. [Relatório](../../docs/qa/MP-04-catalogo-ofertas.md).
- Evidências locais: 737 testes front, 63 contratos, 46 harness; suíte back 336 antes da moderação final, seguida de 31 regressões e 28 verificações finais de catálogo/migração. Tipos aprovados; lint 0 erros/10 avisos. Navegador desktop/mobile e imagem Docker com fontes locais aprovados. CI completa do candidato fica registrada na PR.
- Migração 0014 aplicada apenas no D1 local separado de QA. Nenhum merge, deploy, edição de perfil/identidade ou migração remota nesta entrega.
- Branch da entrega: codex/mp-04-catalogo, baseada no checkpoint integral. PRs #22/#23/#24 preservadas como registros anteriores; não mesclar automaticamente branches sobrepostas.
- MP-05: todo, não iniciado e sem autorização. Aguardar aprovação explícita da entrega antes de avançar.

## Contexto seletivo e pendências

- [Arquitetura vigente](../../docs/architecture/arquitetura-vigente.md), [roteiro](../README.md); usar node scripts/context.mjs status ID ou packet para o escopo necessário.
- Homologação de produção, publicação e ativação continuam separadas. Antes de ativar MP-03, seguir o inventário e a reconciliação de fornecedores; antes da nova versão, planejar migração 0014 e backup operacional.
- Identificação pública usa o ID real do fornecedor; não inventa razão social/reputação. Cadastro de nova identidade e recuperação real de senha ainda exigem homologação externa autorizada.

## Histórico sob demanda

- [Registro integral anterior](progresso-ate-2026-10-30.md), [histórico anterior](progresso-historico.md). Não carregar ambos na entrada normal.
- CTX-01 e etapas anteriores preservados no Git e em docs/qa/. O checkpoint de código não restaura bancos ou configurações remotas.
