# Plano de migração do assistente para GPT-6

Data: 2026-09-26. Status: proposto; implementação e homologação pendentes.

## Objetivo e escolha

Migrar o motor do assistente de compras da feature 018 para **gpt-6-luna**, pela Responses API. A recomendação é uma hipótese fundamentada no escopo delimitado do produto, a confirmar por avaliação real. GPT-6 Luna aceita texto/imagem e function calling e é apresentado pela OpenAI como opção eficiente para tarefas focadas. Começar com `reasoning.effort: "none"`, comparando com `low` se houver falhas de compreensão; o adaptador atual não configura esforço equivalente. [Modelo e capacidades](https://developers.openai.com/api/docs/models/gpt-6-luna).

Usar GPT-6 Sol como comparador de qualidade na homologação. Promovê-lo a padrão apenas se Luna não atingir os critérios e Sol atingir com custo aceitável. Astra não é o candidato inicial: o fluxo observado não exige pesquisa ampla nem raciocínio aberto prolongado. Essa escolha é julgamento de engenharia, não resultado de benchmark já executado. [Comparação da família](https://developers.openai.com/api/docs/models).

Escopo: IA da aplicação. Não altera o modelo utilizado pelo desenvolvedor no Codex. Preservar autenticação, catálogo D1, carrinho, checkout e contrato HTTP público. Não incluir pagamentos, nova interface ou migração de banco.

## Evidências locais

- `back/src/lib/chat-completion.ts`: `RunChatCompletion` separa inferência da aplicação; adaptador usa `@cf/meta/llama-4-scout-17b-16e-instruct` e recupera chamadas vazadas em texto/JSON.
- `back/src/index.ts:149`: `/chat/message` instancia o adaptador Workers AI.
- `back/src/routes/chat.ts`: valida contrato Zod, obtém identidade do middleware, encaminha imagem e chama o orquestrador.
- `back/src/lib/ai/orchestrator.ts`: limite de quatro iterações; chamadas são reenviadas como mensagens assistant contendo JSON; seleção encerra o loop e retorna ação ao frontend.
- `back/src/lib/ai/tools/index.ts`: três ferramentas: busca, detalhe e seleção. Parâmetros opcionais e endereço aninhado exigem atenção na conversão de schema.
- `back/src/env.d.ts`, `back/wrangler.jsonc`: binding AI presente; `back/package.json` não possui SDK OpenAI.
- Feature 018 permanece `in_progress`; M7 real está pendente nos registros. Há comentários no código sobre observações em produção: reconciliar essas evidências antes de estabelecer baseline, sem assumir homologação completa.

## Etapas executáveis

### 1. Baseline e preparação

1. Ler guias api-contract, risk-zone-protocol e qa antes da implementação. Preservar as alterações locais preexistentes de autenticação/navegação e estado.
2. Registrar decisão de produto que substitui a escolha Workers AI na spec e no backlog, preservando histórico e status pendente. Criar emenda em `docs/governance/decisoes.md` com referência à feature 018.
3. Confirmar acesso aos modelos na conta OpenAI, faturamento, limites e orçamento do piloto. Provisionar `OPENAI_API_KEY` somente como segredo do Worker, nunca no frontend ou Git.
4. Montar conjunto fixo de 60 conversas de avaliação com catálogo controlado e fotos autorizadas: busca exata (10), contexto em múltiplos turnos (10), fotos (10), ambiguidade/sem estoque/sem resultado (10), seleção/quantidades (10), entradas adversariais e falhas (10).
5. Medir o provedor atual quando disponível; se não estiver, documentar ausência de baseline operacional e avaliar contra respostas e ações esperadas.

### 2. Adaptador OpenAI e configuração

1. Criar `back/src/lib/openai-chat-completion.ts` com factory compatível com `RunChatCompletion`, usando HTTP `fetch` nativo para `/v1/responses`. Validar payloads de resposta; considerar SDK somente se reduzir complexidade demonstravelmente.
2. Introduzir configuração validada `CHAT_PROVIDER`, `OPENAI_MODEL`, `OPENAI_REASONING_EFFORT` e segredo tipado em `env.d.ts`; selecionar o provedor no ponto de composição em `index.ts`. Modelo e provedor são definidos pelo servidor.
3. Converter texto/imagem para os itens corretos da Responses API e ler texto, function calls, recusas, resultados incompletos e erros explicitamente. Não executar ferramentas extraídas de texto livre no adaptador OpenAI.
4. Aplicar prazo total por requisição, cancelamento e limite de saída configurável. Tratar 429/5xx com tentativas limitadas dentro desse prazo; normalizar falha para `AI_PROVIDER_ERROR`, sem expor detalhes do provedor ao usuário.
5. Registrar modelo, duração, iterações, uso de tokens e categoria de erro, sem fotos, endereços, chaves ou conversa integral nos logs.

### 3. Compatibilidade do loop e schemas

Esta etapa é necessária: trocar apenas o identificador do modelo não basta.

1. Instanciar estado do adaptador por requisição HTTP. Manter os itens estruturados de saída da Responses API dentro dessa execução e devolver resultados como `function_call_output` associados ao `call_id` original. Preservar também os itens de raciocínio retornados. Nunca compartilhar esse estado entre usuários. Preferir histórico explícito com `store: false`; validar o mecanismo de continuação stateless e itens de raciocínio exigidos pela API antes de habilitar esforço `low`.
2. Ajustar a interface interna/orquestrador onde necessário para diferenciar chamadas de ferramentas de texto do assistant. Não inferir chamadas por `JSON.parse` de mensagens comuns. Preservar o contrato público `ChatResponse`.
3. Mapear todos os resultados de chamadas múltiplas corretamente, incluindo seleção com argumentos inválidos. Começar com chamadas paralelas desativadas e testar que a seleção não deixe uma continuação inválida ou dispare duas ações.
4. Converter schemas para `strict: true`: `additionalProperties: false` em objetos, campos obrigatórios conforme regras da API e opcionais representados por tipos anuláveis. Normalizar `null` para ausência antes do harness existente; testar endereço/complemento e quantidade. Manter validação Zod e identidade obtida do middleware.
5. Preservar limite de quatro iterações, fallback para texto vazio e handoff para checkout. Não permitir produto/preço inventado nem execução de ferramenta fora da lista permitida.

A documentação exige correlação por `call_id` e preservação dos itens necessários à continuação; schemas estritos precisam atender às regras de propriedades e campos obrigatórios. [Function calling](https://developers.openai.com/api/docs/guides/function-calling).

Usar Responses permite raciocínio com ferramentas. Remover parâmetros de amostragem incompatíveis ao habilitar raciocínio; não introduzir `temperature` no baseline. [Migração GPT-6](https://developers.openai.com/api/docs/guides/latest-model).

### 4. Testes e escolha definitiva

1. Testar serialização multimodal e garantir que a foto efetivamente chega ao provedor; cobrir retry, resposta vazia, JSON inválido, recusa, saída truncada, timeout, 429 e 5xx.
2. Testar busca → detalhe → seleção, múltiplas chamadas, erro de argumentos seguido de correção, correlação de IDs, limite de iterações e isolamento entre requisições concorrentes.
3. Executar testes backend e tipos; contratos e testes dirigidos de ChatUI para demonstrar preservação do handoff. Fazer dry-run do Worker. Usar comandos do ciclo de sessão, sem deploy implícito.
4. Rodar o conjunto real em Luna e Sol com entradas equivalentes e contabilizar todas as chamadas do loop, tokens de raciocínio e imagens. Ajustar esforço ou prompt isoladamente, mantendo a mesma avaliação.
5. Critérios propostos para o piloto: pelo menos 95% de sucesso nas conversas; zero seleção incorreta nos casos críticos, vazamento entre usuários ou bypass de autenticação; 100% das respostas respeitam o contrato. Meta inicial de latência p95 até 10 s por mensagem completa e custo médio até US$ 0,01 por mensagem, incluindo iterações. São metas do projeto a calibrar com a medição, não garantias da OpenAI.
6. Se Luna falhar em qualidade, comparar Luna `low` e Sol. Se nenhum atingir os critérios, manter migração pendente. Não ativar escalonamento automático entre modelos sem evidência de necessidade e testes próprios.

### 5. Implantação e reversão

1. Publicar primeiro em ambiente de homologação com dados de teste e validar `/assistente` autenticado em mobile/desktop: texto, foto, ambiguidade, catálogo vazio, seleção, carrinho e checkout.
2. Executar piloto interno com seleção de provedor no servidor; observar métricas e orçamento antes de ampliar para usuários. Não considerar testes simulados como homologação do modelo.
3. Manter adaptador e binding Workers AI durante a transição. Reversão por configuração para o provedor anterior somente se sua operação tiver sido comprovada; caso contrário, desabilitar temporariamente o assistente preservando catálogo e checkout convencionais.
4. Reverter em caso de ação incorreta, quebra de contrato ou isolamento. Investigar se erro, latência ou custo excederem as metas; não repetir silenciosamente ações de compra em outro provedor.
5. Atualizar spec, M7 e estado com evidências reais. Marcar feature concluída somente após os critérios completos, inclusive homologação humana prevista.

## Entregáveis e limites desta sessão

- PR de implementação: adaptador, configuração, continuação estruturada e testes.
- Relatório de avaliação: casos, resultados Luna/Sol, custo total por mensagem, p50/p95, falhas e decisão final.
- Evidências de homologação e procedimento de reversão exercitado.

Este plano foi produzido a partir de inspeção local e documentação oficial. Nenhuma chamada de inferência, teste de aplicação, alteração de código ou deploy foi executado. Disponibilidade da conta e desempenho não foram verificados. O grafo existente mostrou relações da ChatUI; as conclusões de backend foram conferidas diretamente no código. O terminal apresentou falta de espaço em disco em uma tentativa; leituras posteriores funcionaram, mas o espaço deve ser verificado antes de build/deploy.
