# MP-04 — Catálogo e manutenção de ofertas

Data: 31/10/2026. Escopo: catálogo público, vitrine, detalhe, cadastro/manutenção de ofertas e preservação de pedidos. Compra e pagamento permanecem simulados. A MP-05 exige nova aprovação.

## Versionamento e retorno

Antes de implementar MP-04, o conjunto local anterior foi versionado no commit `c12d4dbfe4b43e4721c68d70a684fa34ae5f29e0`, publicado na branch `codex/checkpoint-pre-mp04-20261031` e na tag anotada `checkpoint/pre-mp04-2026-10-31`. O checkpoint inclui os incrementos anteriores e CTX-01, preservando também o ajuste `1322ac6`.

Verificada por execução: recuperação dessa tag diretamente do GitHub em um repositório bare separado, com `git fsck --full` e comparação da árvore `fc4ccc189e3a843acc371d02b6c8c16a62f84eca`, idêntica à origem. Procedimento não destrutivo em [retorno-pre-mp04](../governance/retorno-pre-mp04.md).

Código e documentação ficam no GitHub. Credenciais, arquivos ignorados, bancos, dependências instaladas e capturas de QA não são enviados. Retorno de código não restaura dados ou configuração remota. Main e as PRs #22/#23/#24 permanecem sem merge por esta entrega.

## Critérios e implementação

| Critério | Resultado identificado no código | Evidência de execução |
|---|---|---|
| Fornecedor aprovado cadastra, edita e desativa somente suas ofertas | Cadastro original funciona mesmo com catálogo público vazio; cópia de oferta existente preservada. Edição aceita preço e estoque; servidor verifica papel, ownership e aprovação. DELETE desativa, preservando o produto. | `mp04-catalog.test.ts`, testes CRUD e jornada autenticada em navegador. |
| Preço, estoque e disponibilidade no servidor | Escrita rejeita preço zero/negativo/fracionado, estoque negativo/fracionado, campos vazios e slug inválido. Preço anterior e bloqueio administrativo não são controlados pelo body do fornecedor. Catálogo público oculta estoque zero, despublicação, bloqueio administrativo e fornecedor sem aprovação. | Testes de contratos, API/D1 e transações. |
| Oferta e fornecedor corretos em catálogo, vitrine e detalhe | Identificação pública estável pelo ID do fornecedor; removidos nomes e estrelas fictícios. Links carregam o ID exato da oferta. ID inexistente não seleciona outro fornecedor. Slug com várias ofertas exige escolha. | Regressões de detalhe/vitrine e navegador com dois fornecedores. |
| Filtros, paginação, vazio e erro | Vitrine preserva escopo do fornecedor e filtros ao paginar/limpar. Cadastro e manutenção possuem retorno de erro. Catálogo permite tentar novamente após falha de leitura. | Testes frontend e navegador desktop/mobile, com mais de 12 ofertas. A paginação quebra os grupos de controles em telas estreitas; catálogo preenchido validado em 320 e 375 px, sem transbordamento. |
| Revalidação e snapshots | Preço/estoque/disponibilidade são conferidos no preflight e na transação. Nome do item vem do produto no D1; fornecedor é identificado pelo servidor. Pedido mantém valores, itens, fornecedor e endereço após edição/desativação. Replay não cria outra compra, e cancelamento continua restituindo estoque. | Testes D1, inclusive moderação entre preflight e batch, e histórico do comprador no navegador. |

## Moderação e persistência

A migração `0014_product_moderation.sql` separa `moderation_blocked` de `active`. Admin bloqueia/libera no fluxo existente com auditoria; fornecedor não consegue anular o bloqueio por republicação ou envio de campos extras. A migração preserva a última decisão administrativa registrada, incluindo produtos que tenham sido republicados pelo fornecedor no modelo anterior. O desempate usa a ordem de inserção do audit log (`rowid`), que registra as decisões transacionais.

Teste específico aplica migrações até 0013, cria históricos de bloqueio/liberação e despublicação própria, aplica 0014 e confere a projeção. O bloqueio é conferido também na guarda atômica da compra. **0014 aplicada somente em D1 local de QA; não aplicada remotamente.** Antes de publicar, seguir o processo de migração e backup operacional autorizado; reverter só o código não remove a coluna nem desfaz decisões/dados.

## Compilação e fontes

Duas tentativas de build expuseram falha de `next/font/google` ao interpretar URLs de fontes externas. Inter e Nunito, em versões latinas variáveis, foram incluídas localmente com licenças OFL, origem e hashes em `front/src/app/fonts/README.md`. O layout usa `next/font/local`, preservando variáveis CSS e famílias. A geração de fontes não depende mais de rede; instalação de dependências e obtenção da imagem base continuam externas. A imagem Docker passou após a mudança, com 25 páginas geradas.

## Validação e limites

- Suíte frontend: 737 testes aprovados; contratos: 63. Harness: 46 testes aprovados (contexto, segurança de CI e runner E2E).
- Suíte backend: 336 testes aprovados antes da separação final de moderação; 31 regressões de moderação/migração/atomicidade e 28 verificações finais de catálogo/migração aprovadas, após os ajustes finais. A matriz completa do candidato será conferida na PR.
- Tipos dos três workspaces aprovados nas verificações locais. Lint: zero erros e dez avisos preexistentes. Build de produção em Docker aprovado com fontes locais; CI valida novamente o candidato compartilhado.
- Navegador com contas QA existentes: cadastro original, duas ofertas com o mesmo slug, escolha exata, vitrine/paginação/filtros, vazio, mobile, edição de preço/estoque, desativação, histórico persistente e recuperação de erro. Moderação administrativa também aprovada na jornada final.
- Autenticação e leitura de perfis usam Firebase real; operações comerciais e migrações usam exclusivamente o D1 local separado `docs/qa-artifacts/mp04-d1`. Nenhum usuário, perfil remoto, aprovação comercial remota ou pedido remoto foi criado/alterado.
- Um primeiro acesso local às chaves públicas de autenticação retornou 401; identidade, projeto, validade e endpoint público foram conferidos, e nova execução autenticou com sucesso. Os testes não utilizam bypass de autenticação.
- Capturas inspecionadas e logs ficam em `docs/qa-artifacts/mp04-*` (ignorados pelo Git). `scripts/qa-mp04-browser.cjs` preserva a jornada reproduzível, sem incluir credenciais. Esperas de navegação do script foram corrigidas para aguardar a URL após paginação/limpeza.

Identificação por ID comprova o vínculo correto, mas não representa razão social validada ou avaliação comercial. Um cadastro público de nomes comerciais/reputação não foi inventado nesta etapa. Assistente e fluxo legado de compra por URL permanecem nos escopos posteriores; nenhuma funcionalidade de MP-05 a MP-12 foi promovida automaticamente.

Esta entrega é homologação local e CI, sem deploy, merge ou migração remota. O resultado final da CI e o commit compartilhado ficam registrados na PR e no encerramento da entrega.
