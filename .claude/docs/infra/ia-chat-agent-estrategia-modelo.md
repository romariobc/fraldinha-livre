# IA — Estratégia de Modelo do Chat-Agent (feature 018)

> Registro do achado de QA em produção (2026-08-03) e da análise de opções de implementação
> (custo × experiência × eficiência de engenharia) para o motor do chat-agent, ANTES de qualquer
> mudança de código. Decisão final ainda em aberto — este arquivo documenta o estado da investigação,
> não uma decisão fechada. Deve ser lido antes de qualquer sessão que for mexer em
> `back/src/lib/chat-completion.ts`, `back/src/routes/chat.ts`, ou no system prompt/tools do agente.
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

## Referências

- Spec da feature: `.claude/docs/design/specs/spec-app-mobile-chat-agent.md`.
- Plano/histórico da thread M: `.claude/docs/design/plans/M-app-mobile-chat-agent-breakdown.md`,
  `M7-deploy-qa-validacao.md`.
- Bug de content vazio (corrigido, contexto diferente): commit `279877a`.
- Preços e capacidades confirmados via `search_cloudflare_documentation` em 2026-08-03 (páginas de
  modelo do catálogo Workers AI + `/workers-ai/platform/pricing/` + `/ai-gateway/features/unified-billing/`).
