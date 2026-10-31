# CTX-01 — Redução do custo de contexto

Entrega de 31/10/2026, anterior à MP-04. Escopo autorizado: resolver os cinco pontos da auditoria de arquitetura que dificultavam a leitura por agentes. Compra e pagamento continuam simulados. Nenhuma regra comercial, migração ou operação remota foi incluída.

## Resultado por critério

| Ponto | Alteração identificada por leitura de código | Evidência |
|---|---|---|
| Arquivos extensos | Tabela separada em controller, modelo, colunas, visualização e diálogo. Checkout separado em controller e quatro passos de apresentação. | `front/src/components/fornecedor/orders-table/` e `front/src/components/checkout/`; testes existentes e navegador. |
| Tipos e fixtures acoplados | Tipos em `lib/domain/account.ts` e `supplier.ts`; helpers em `formatters.ts`; projeções de contratos em adapters explícitos. Fixtures conservam somente dados de demonstração. | Verificação estrutural impede reintroduzir imports de tipos/helpers a partir de fixtures. |
| Bibliotecas substituídas por aliases ocultos | Implementações locais preservadas em `lib/compat/`; imports explícitos; removidos aliases de TypeScript/Vitest que aparentavam apontar para os pacotes externos. | Tipos, testes e verificação estrutural. Não houve troca de implementação visual. |
| Contexto carregado em excesso | Estado atual curto, histórico integral preservado, pacotes por tarefa e consulta do backlog por ID. | `context/README.md`, `context/packets.json` e `scripts/context.mjs`. |
| Guias e mapa desatualizados | Caminhos corrigidos, arquitetura vigente curta e resolução de imports pelo TypeScript, com hashes/proveniência. | `docs/architecture/arquitetura-vigente.md`; comandos `imports` e `graph --write`. |

## Medição antes/depois

| Entrada | Linhas antes | Linhas depois | Tokens antes | Tokens depois |
|---|---:|---:|---:|---:|
| OrdersDataTable.tsx | 1.292 | 291 | 10.031 | 2.298 |
| checkout/page.tsx | 737 | 336 | 6.610 | 2.973 |
| progresso.md, na medição anterior ao encerramento | 634 | 23 | 23.864 | 557 |

Tokens estimados com `cl100k_base`, normalizando quebras de linha em ambas as versões. A redução é da entrada necessária para compreender uma responsabilidade; o código extraído continua existindo. Isso não mede precisão de modelos nem prova um novo ranking entre IAs. O AGENTS.md cresceu de 909 para 1.082 tokens para orientar a leitura seletiva.

O conteúdo anterior de progresso foi copiado integralmente, sem reescrita, para `context/estado/progresso-ate-2026-10-30.md`. Registros anteriores do backlog e decisões de produto permanecem preservados. A comparação contra a base da cópia de revisão mantém os 42 identificadores existentes; o registro de MP-03 inclui seu encerramento local anterior, sem promoção para produção.

## Validação

- Verificada por execução: suíte frontend com 732 testes aprovados; contratos com 58 testes aprovados; regressões focadas em tabela/checkout com 46 testes aprovados (subconjunto do frontend).
- Verificada por execução: limites de contexto e segurança do harness, 14 testes aprovados (5 de contexto e 9 de segurança de CI).
- Verificada por execução: lint sem erros, com 10 avisos existentes. Tipos de frontend, backend e contratos aprovados. Build Docker de produção aprovado (imagem `fraldinha-livre-frontend:ctx01`, saída 0, 25 páginas geradas). A primeira tentativa falhou no carregador de Google Fonts do Next.js; a repetição completa passou sem alteração de código. A versão MP-03 também passou pela compilação e tipos na comparação local. Essa dependência de fontes externas ainda pode causar instabilidade de build.
- Verificada por execução no navegador: fornecedor lista pedidos da API local, abre detalhes, busca sem resultados e limpa filtros. Comprador percorre endereço, revisão e tela de pagamento simulado. Desktop e mobile sem transbordamento horizontal; nenhum pagamento foi submetido.
- Evidências locais em `docs/qa-artifacts/ctx-*.log`, `ctx-browser-result.json`, `ctx-metrics.json` e capturas. Artefatos de QA ignorados pelo Git não são evidência pública permanente.

## Harness e uso posterior

Começar pelo estado atual e por `node scripts/context.mjs status MP-04`, somente após autorização para executar essa etapa. Para escolher um pacote, usar `node scripts/context.mjs packet`; para relações atuais, `node scripts/context.mjs imports caminho.tsx`. `node scripts/context.mjs check` valida os limites e caminhos; seus cinco testes integram o runner e a matriz de CI.

O grafo regenerado representa imports locais de módulos, incluindo imports de tipos: 180 módulos e 562 relações na geração desta entrega. Não representa chamadas em execução, semântica completa ou implantação. O JSON antigo foi preservado localmente; HTMLs antigos do Graphify não foram regenerados e não comprovam atualização. O comando de imports consulta os arquivos atuais.

## Limites e ponto de parada

QA utilizou contas existentes, autenticação/leitura de perfil Firebase e backend/D1 locais. Não comprova homologação de produção, cadastro de nova identidade ou recuperação real de senha. Guias descrevem o código local, sem afirmar estado remoto atualizado.

Alterações anteriores de MP-00 a MP-03 foram preservadas. A cópia de revisão está em `E:/Labdev/Projetos/.worktrees/fraldinha-ctx01`, baseada em `17db34e`, com a refatoração de orders-context aplicada separadamente para excluir uma alteração funcional local anterior. Commit, push, merge e deploy não são necessários para esta entrega local e não foram executados nesta etapa.

Links dos dez guias/documentos iniciais conferidos sem referências quebradas; JSON válido; diff da tarefa sem erros de whitespace; histórico comparado byte a byte. Os 180 hashes do mapa correspondem aos arquivos atuais.

CTX-01 encerra a preparação estrutural; MP-04 permanece não iniciada, aguardando aprovação explícita. As pendências funcionais do marketplace continuam no backlog MP, sem promoção automática por causa desta refatoração.
