# IA — Estratégia de Modelo do Chat-Agent (feature 018)

> Registro do achado de QA em produção (2026-08-03) e da análise de opções de implementação
> (custo × experiência × eficiência de engenharia) para o motor do chat-agent, ANTES de qualquer
> mudança de código. Deve ser lido antes de qualquer sessão que for mexer em
> `back/src/lib/chat-completion.ts`, `back/src/routes/chat.ts`, ou no system prompt/tools do agente.
>
> **CORREÇÃO IMPORTANTE (mesmo dia, poucas horas depois):** a seção 2 concluiu "o modelo não chama
> tools de forma confiável" com base em sintoma (o que apareceu na tela). Instrumentando log real e
> capturando via `wrangler tail` (seção 7), essa conclusão **estava errada**: o modelo acertou a tool e
> o argumento certo nas 3 tentativas, inclusive inferindo contexto ("tamanho G" → buscou "Pampers
> tamanho G"). O bug era nosso parsing descartando toda chamada real. **Corrigido e deployado
> (commit `f829d98`).** Mantive as seções 2-6 como registro do raciocínio original — errar por sintoma
> e corrigir com dado é parte do processo, não algo pra apagar — mas a seção 7 é a conclusão válida
> agora. Se você está decidindo algo hoje, leia a seção 7 primeiro.
>
> **SEGUNDA CORREÇÃO (mesma noite):** com o parsing de M2 corrigido, apareceu um TERCEIRO bug — também
> nosso, também não é o modelo. Ver seção 8.
>
> Contexto arquitetural geral (infra Firebase+Cloudflare) está em `arquitetura-firebase-cloudflare.md`
> — este arquivo é específico do motor de IA, não repete o resto.

## 1. O que já está resolvido (não reabrir sem motivo novo)

- **Modelo em produção hoje:** `@cf/meta/llama-4-scout-17b-16e-instruct`, via `env.AI.run()` (Workers AI).
- **Motivo original da escolha:** único modelo do catálogo, no momento da decisão, que combinava
  function calling + vision nativos — vision é requisito da spec (foto do produto).
- **Arquitetura já isola o modelo atrás de uma interface** (`RunChatCompletion`, em
  `back/src/lib/chat-completion.ts`) — **trocar de modelo/provedor é uma mudança de baixo custo de
  engenharia**, não exige tocar na rota (`chat.ts`), no front, nem no contrato. Isso já foi um
  investimento consciente (D-040-ish, registrado no plano M2) especificamente para não travar essa
  decisão.
- **Bug de content vazio travando o histórico com 400** — CORRIGIDO (commit `279877a`, 2026-08-03).
  Não é mais um problema; ver seção 3 pra não confundir com o achado novo.

## 2. Achado de QA em produção (2026-08-03) — a causa do "vamos parar e pensar"

Testando `/assistente` em produção, duas falhas de experiência apareceram na mesma sessão de teste:

**Caso 1 — entrada curta ("FRALDA") não gera nem tool call nem pergunta de esclarecimento.**
O modelo retorna sem chamar `search_products` e sem escrever texto útil — só o fallback genérico
("Desculpe, não entendi. Pode reformular?") aparece, repetidamente. Do ponto de vista do usuário, é um
beco sem saída: nenhuma orientação sobre o que fazer diferente.

**Caso 2 — o modelo "escreve" a chamada da tool como texto, em vez de chamar de verdade.**
Resposta literal vista na tela:
> "Você está procurando pela fralda Pampers Supersec. Vou verificar se temos esse produto disponível
> em nosso catálogo. **[search_products(query="Pampers Supersec")]**"

Isso é o modelo simulando a sintaxe de uma chamada de função dentro do `content` de texto, em vez de
emitir um `tool_calls[]` estruturado de verdade. `result.toolCalls` veio vazio nessa rodada — o backend
tratou como resposta final e mostrou a sintaxe crua pro usuário.

**Diagnóstico (não é bug de código nosso):** os dois casos apontam pra a mesma causa — o
`llama-4-scout`, nesta integração via Workers AI, **não está chamando as tools de forma confiável**
quando a entrada é curta/ambígua. Confirmamos isso por leitura de evidência (Network tab 400 do bug
anterior + captura de tela do comportamento atual), não por suposição — mas ainda **não temos a resposta
crua do modelo instrumentada** (ver seção 5, pendência).

## 3. Por que isso é diferente do bug já corrigido

| | Bug corrigido (`279877a`) | Achado novo (esta sessão) |
|---|---|---|
| Sintoma | 400 travando a conversa | Fallback repetido / sintaxe de tool vazando como texto |
| Causa | Nosso código deixava `content` vazio sair como resposta válida | O modelo não está chamando tools de forma confiável |
| Camada do problema | Nosso backend (`chat.ts`) | Comportamento do modelo em si |
| Corrigível só com código nosso? | Sim, e já foi | Não necessariamente — pode exigir trocar modelo/prompt |

## 4. Opções de implementação avaliadas

Preço confirmado na documentação oficial da Cloudflare (2026-08-03), não estimado:

| Opção | Modelo/abordagem | Preço (in/out por M tokens) | Esforço de engenharia | Risco |
|---|---|---|---|---|
| **A** | Manter `llama-4-scout`, melhorar o `SYSTEM_PROMPT` (instrução explícita contra sintaxe de tool em texto, few-shot de exemplo, talvez `@cloudflare/ai-utils` embedded function calling p/ parsing defensivo) | Igual ao atual | **Mínimo** — só muda uma string/lib, nenhuma mudança de interface | Pode não resolver — é o mesmo modelo, prompt engineering tem teto |
| **B1** | Trocar pra `@cf/qwen/qwen3-30b-a3b-fp8` (function calling confirmado) | $0,051 / $0,34 — **mais barato que o atual** | **Baixo** — troca de 1 string no adapter (`RunChatCompletion` já isola) | Sem vision — teria que resolver foto separado (ex.: manter scout só pra foto, qwen pra texto — complexidade nova) |
| **B2** | Trocar pra `@cf/nvidia/nemotron-3-120b-a12b` — Cloudflare descreve como otimizado especificamente pra **tool-calling multi-turno em agentes**, é o caso de uso mais parecido com o nosso | $0,50 / $1,50 | **Baixo** — mesma troca de 1 string | Sem vision também. Mais caro que o atual, mas ainda ordens de grandeza abaixo de Claude |
| **C** | `anthropic/claude-haiku-4.5`, disponível pelo MESMO `env.AI.run()` via Unified Billing (Cloudflare cobra, sem precisar de chave própria da Anthropic) | Unified Billing + 5% sobre crédito carregado (preço base repassado sem markup) | **Médio** — formato de mensagem/tools da Anthropic é diferente do genérico Workers AI; o adapter precisaria de um branch de tradução | Melhor qualidade esperada de tool-use (é a reputação da família Claude), mas ainda sem confirmação de que aceita `tools[]` no formato genérico — pode exigir reescrever a tradução de tools inteira |
| **D** | Claude via chave própria da Anthropic (fora do Workers AI/env.AI) | Preço padrão Anthropic, sem repasse Cloudflare | **Médio-alto** — sai da simplicidade do binding único, precisa gerenciar `ANTHROPIC_API_KEY` como secret, novo vendor a monitorar | Mesma incerteza de esforço do C, mais a complexidade extra de um segundo provedor de credencial |
| **E** | Híbrido/escalonado: modelo barato por padrão, escala pra um mais confiável só quando detecta falha (ex.: resposta vazia 2x seguidas) | Custo médio, só paga o caro quando precisa | **Alto** — lógica de retry com troca de modelo, mais superfície de teste | Mais engenharia agora pra economizar depois — só compensa se a taxa de falha real for baixa (não sabemos ainda, falta medir) |

## 5. O que falta pra decidir com dado, não achismo

Antes de qualquer implementação, faltam duas coisas concretas:

1. **Instrumentar log temporário** no adapter (`chat-completion.ts`) pra capturar, por rodada, se o
   modelo devolveu `tool_calls` estruturado ou só texto — e o conteúdo bruto. Sem isso, estamos
   diagnosticando por sintoma na tela, não pela causa real.
2. **Reproduzir com `wrangler tail` ativo** as mesmas entradas que falharam ("FRALDA", "VOCES TEM ESSA
   FRALDA") pra ver a resposta crua da Workers AI nessas rodadas — confirma se é comportamento
   consistente ou intermitente, e se piora especificamente com entrada curta/ambígua.

Só depois disso — com taxa de falha real medida, não só 2 exemplos manuais — faz sentido decidir entre
A (mais barato, resolve rápido se for prompt) e B1/B2 (troca de modelo, ainda barato) antes de considerar
C/D (Claude, mais caro e mais esforço).

## 6. Recomendação preliminar (não decidida — para discussão)

Ordem sugerida de tentativa, do menor pro maior custo/esforço, testando cada uma antes de escalar pra
próxima:

1. **A primeiro** — é grátis em esforço de engenharia e não muda nada de arquitetura. Se resolver, os
   outros itens desta lista nem precisam ser implementados.
2. **B2 (nemotron) se A não resolver** — ainda dentro da mesma classe de custo do free tier, é o modelo
   que a própria Cloudflare posiciona pra exatamente este problema (tool-calling confiável em agente
   multi-turno). Perde vision — precisaria decidir se foto fica num modelo separado só pra essa etapa,
   ou se adia foto pra depois de validar o texto.
3. **C (Claude Haiku via mesmo binding) só se B2 também não resolver** — ainda evita o overhead de
   gerenciar uma chave de API separada (D), mas é a primeira opção que exige trabalho real de adapter.

**Isto não é uma decisão fechada.** Falta o Romario (e as sessões de backend/frontend, se quiser opinião
delas) avaliar esta análise antes de qualquer código ser tocado — é exatamente o pedido que gerou este
documento.

## 7. Causa raiz real (confirmada com dado, 2026-08-03 à noite) — LER PRIMEIRO

Instrumentei log temporário no adapter (`chat-completion.ts`) logando a resposta CRUA do modelo antes
de qualquer parsing nosso, e capturei via `wrangler tail` em produção, ao vivo, enquanto o Romario
reproduzia as mesmas 3 entradas da seção 2 ("fralda", "fralda pampers", "tamanho G"). As 3 chamadas
reais, sem edição:

```json
{"lastUserMessage":"fralda","rawResponseText":null,"rawToolCallsCount":1,
 "rawToolCalls":[{"arguments":{"query":"fralda"},"name":"search_products"}]}
{"lastUserMessage":"fralda pampers","rawResponseText":null,"rawToolCallsCount":1,
 "rawToolCalls":[{"arguments":{"query":"fralda pampers"},"name":"search_products"}]}
{"lastUserMessage":"tamanho G","rawResponseText":null,"rawToolCallsCount":1,
 "rawToolCalls":[{"arguments":{"query":"Pampers tamanho G"},"name":"search_products"}]}
```

**O modelo acertou as 3 vezes** — inclusive a terceira, onde "tamanho G" sozinho (sem repetir "pampers")
foi corretamente traduzido em `query: "Pampers tamanho G"` usando o contexto da conversa. Isso não é
comportamento de modelo pouco confiável — é exatamente o que a spec esperava dele.

**A causa raiz era nossa:** o payload real de `tool_calls` pra este modelo é **achatado**
(`{name, arguments}`, sem `function`, sem `id`) — diferente do formato **aninhado**
(`{function: {name, arguments}}`) que o pacote `@cloudflare/workers-types` declara, e que eu tinha usado
pra "corrigir" M2 no dia anterior (commit `0a47359`) com base no **tipo declarado**, não em dado real de
execução. O parsing só aceitava `call.function?.name` → descartava toda chamada real →
`toolCalls.length === 0` → caía no branch de "sem tool call" → como `result.text` também vinha `null`,
disparava o fallback genérico do fix de ontem (`279877a`). As duas correções anteriores (`279877a` e o
fix de imagem `10d27d1`) continuam corretas e necessárias — só não eram a causa deste sintoma.

**Fix aplicado (commit `f829d98`, deployado, Version ID `ab7938c3`):** o parsing agora aceita os dois
formatos — o achatado (confirmado real, é o caminho principal) e o aninhado (mantido por segurança,
documentado mas nunca confirmado em produção). Teste novo usa o payload exato capturado, não um mock
inventado; validado revertendo o fix antes de commitar (2 testes falham exatamente nos casos novos).

**O que isso muda nas seções 4-6:** a pergunta "qual modelo escolher" ainda não tem resposta definitiva,
mas a urgência mudou — não é mais "o modelo atual está quebrado, precisa trocar já". É "o modelo atual
está funcionando bem nos casos testados; validar mais casos (foto, ambiguidade real, produto fora do
catálogo) antes de decidir se vale a pena trocar por causa/custo". A tabela da seção 4 continua válida
como referência de preço/capacidade caso uma troca vire necessária depois.

**Log de diagnóstico:** ainda ativo em produção (`console.log('[chat-diag]', ...)`), marcado como
temporário no código. Remover depois de validar mais rodadas de QA (incluindo foto), não antes.

## 8. Terceiro achado real: busca não entendia campos separados (2026-08-03, mesma noite)

Com o parsing de tool_calls corrigido (seção 7), o Romario testou de novo. O agente melhorou de verdade
— perguntou "Qual tamanho você precisa? (P, M, G, RN, GG)" quando faltava informação, em vez de só cair
no fallback. Mas a conversa "marca pampers" → "G" → "M" → "P" mostrou:

- "G" → **"Desculpe, parece que não há produtos Pampers Supersec tamanho G disponíveis."**
- "M" → **"Parece que não há produtos Pampers tamanho M disponíveis."**
- "P" → voltou a escrever a sintaxe da tool como texto (`[search_products(query="Pampers tamanho P")]`)
  — esse comportamento específico (narrar a chamada em vez de fazer) **ainda não tem causa confirmada**,
  ficou registrado como pendência, não investigado ainda.

**Causa raiz das duas primeiras (confirmada direto no D1 de produção, não suposição):**
```
SELECT id,name,brand,size FROM products WHERE active=1 AND brand='Pampers' AND size='G'
→ 1 linha: p3 (Supersec Pants, Pampers, G) — O PRODUTO EXISTE.

SELECT id,name,brand,size FROM products WHERE active=1
  AND (name LIKE '%Pampers tamanho G%' OR brand LIKE '%Pampers tamanho G%' OR categoria LIKE '%Pampers tamanho G%')
→ 0 linhas — a query que a tool provavelmente rodou (frase composta) NAO bate em nenhum campo.
```

`search_products` (M3) fazia `LIKE` da frase inteira contra `name`/`brand`/`categoria`, e **nunca
olhava o campo `size`**. O modelo fez exatamente o certo (perguntou o tamanho que faltava, combinou
marca+tamanho da conversa) — a ferramenta de busca é que não sabia lidar com mais de um conceito ao
mesmo tempo.

**Fix (commit `0a4b0dc`, deployado, Version ID `1a65343e`):** `search_products` ganhou `brand`/`size`/
`categoria` como campos separados na tool (size com igualdade exata, não `LIKE` — "G" não pode casar com
"GG"/"XXG"). O `SYSTEM_PROMPT` instrui o modelo a preencher os campos separados em vez de concatenar
tudo numa frase.

**Padrão que se repete pela 3ª vez hoje, vale destacar:** nas três correções desta noite (`279877a`,
`f829d98`, `0a4b0dc`), a causa nunca foi "o modelo não presta" — foi sempre uma lacuna do nosso lado
(schema rejeitando a própria resposta do servidor; parsing baseado em tipo declarado em vez de
comportamento real; busca que não suportava consulta composta). **Antes de considerar trocar de modelo
(seção 4/6), vale esgotar essa classe de bug primeiro** — pode ser que o `llama-4-scout` seja bom o
suficiente e a experiência ruim seja inteiramente nossa, não dele.

**Pendência real, não resolvida:** o vazamento de sintaxe da tool como texto ("P" acima) ainda acontece
às vezes, mesmo com o parsing corrigido. Precisa da mesma instrumentação/captura ao vivo pra entender se
é nondeterminismo do modelo, um gatilho específico (ex.: depois de N chamadas de tool na mesma
conversa), ou outra coisa. Log `[chat-diag]` continua ativo em produção pra isso.

## Referências

- Spec da feature: `.claude/docs/design/specs/spec-app-mobile-chat-agent.md`.
- Plano/histórico da thread M: `.claude/docs/design/plans/M-app-mobile-chat-agent-breakdown.md`,
  `M7-deploy-qa-validacao.md`.
- Bug de content vazio (corrigido, contexto diferente): commit `279877a`.
- Preços e capacidades confirmados via `search_cloudflare_documentation` em 2026-08-03 (páginas de
  modelo do catálogo Workers AI + `/workers-ai/platform/pricing/` + `/ai-gateway/features/unified-billing/`).
