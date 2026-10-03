# M7 — Deploy real + QA manual + validação humana (feature 018)

**Executor:** coordenador + cliente (NÃO subagente) | **Autor:** sessão-mãe (2026-08-03) | **Status:** aguardando pré-requisito humano
**Spec:** `docs/features/specs/spec-app-mobile-chat-agent.md` (APROVADA)
**Plano:** `docs/features/plans/M-app-mobile-chat-agent-breakdown.md` (tarefa M7, dep: M1–M6 — todas APROVADAS e revisadas pelas 3 sessões)

## Estado de entrada (verificado, não presumido)

| Item | Estado |
|---|---|
| `packages/contracts` | 29/29 testes |
| `back` | 94/94 testes |
| `front` | 378/378 testes |
| `tsc` (3 pacotes) | exit 0 |
| `lint` (front) | exit 0 — 2 warnings pré-existentes/cosméticos |
| `build` (front) | ok, `/assistente` prerendered |
| `wrangler deploy --dry-run` | ok — `env.AI` reconhecido junto de `env.DB` e vars (88 KiB gzip) |
| Migrations pendentes | **NENHUMA** (chat é stateless, reusa a tabela `products`) |
| Revisão cruzada | ✅ backend (`[BA]`) e ✅ frontend (`[FR]`), ambas independentes (D-012) |

**Consequência boa da ausência de migration:** diferente do P3 e do C11, onde a ordem
migration→deploy era crítica (deployar antes quebrava produção inteira com 500), aqui **a ordem não
importa**. O risco operacional desta fatia é baixo; o risco real é de *qualidade do modelo*, não de
infra.

## Progresso (2026-08-03)

- ✅ Pré-requisito humano confirmado (Workers AI habilitado, catálogo de modelos visível).
- ✅ **Passo 1 — Backend deployado.** Version ID `e38abc11`. Antes: rebase em `origin/main` (2 commits
  de trás, só docs, sem tocar código/migrations) + revalidação pós-rebase (back 94/94, contracts 29/29).
- ✅ **Passo 2 — Frontend deployado.** Version ID `65cca11d` (container). Encontrado e resolvido no
  caminho: este worktree não tinha `front/.env.local`; os 3 arquivos achados em outros worktrees
  divergiam da produção real (authDomain antigo, pré-D-035). A resposta certa não era nenhum desses —
  eram `front/.env.production`/`.env.production.local`, **commitados de propósito** (whitelist no
  `.gitignore`, `!front/.env.production*`), que este worktree já tinha, idênticos ao `main`. Confirmado
  independentemente por 3 sessões antes de publicar. Ver D-041 (a registrar em `decisoes.md`) para o
  relato completo — quase se repetiu o incidente do D-034/D-035 (login mobile) por engano de
  investigação, não por bug de código.
- ✅ **Passo 3 — Smoke test.** Backend: `/health` 200, `GET /products` 200×24, `GET /orders` sem token
  401, `POST /chat/message` sem token 401 (5×) e com token inválido 401. Frontend: `/`, `/catalogo`,
  `/login`, `/produto/[slug]`, `/assistente` todos 200. **Achado operacional (não bug):** o primeiro
  request a uma rota nova after deploy (tanto `/chat/message` quanto `/assistente`) voltou 404/erro por
  lag de propagação de edge — resolveu em segundos. Não confiar em smoke test único imediatamente após
  publicar.
- ⏳ **Passo 4 — QA manual (15 casos) — PENDENTE.** Requer navegador/celular real, é a próxima etapa.
- ⏳ **Passo 5 — Registro final** (feature_list.json → done, decisoes.md, integration-guide.md) —
  pendente até o QA fechar.

## Pré-requisito humano (BLOQUEANTE)

**Confirmar que Workers AI está habilitado/disponível na conta Cloudflare do projeto.**

Nenhuma das sessões consegue verificar isso daqui: todos os testes usam um `RunChatCompletion` falso, e
o MCP `cloudflare-bindings` exige autenticação interativa que a sessão não faz sozinha. O `--dry-run`
prova que o *binding está configurado*, não que a conta tem *direito de uso*.

Verificar em: dash.cloudflare.com → Workers & Pages → AI. Se aparecer o catálogo de modelos e a conta
não estiver bloqueada, está ok.

> Cota: 10.000 neurons/dia grátis. Estourar não gera cobrança-surpresa no plano Free — as chamadas
> passam a falhar. No Paid, cobra US$ 0,011/1.000 neurons acima da cota.

## Passos

### 1. Deploy do backend
```
cd back
npx -y wrangler@4.86.0 deploy
```
(Pin do wrangler por causa do Node 20 — D-021. Se o wrapper recusar por versão de Node, chamar o binário
real: `node node_modules/wrangler/wrangler-dist/cli.js deploy`.)

### 2. Deploy do frontend
Mesmo caminho já usado no C11/D-032 (Cloudflare Containers). Sem variável de ambiente nova — o chat usa
o `NEXT_PUBLIC_BACKEND_URL` que já existe.

### 3. Smoke test (antes de qualquer QA de conversa)
- `POST /chat/message` **sem** `Authorization` → deve ser **401**.
- `POST /chat/message` com ID Token válido e `{"messages":[{"role":"user","content":"oi"}]}` → **200**
  com `{"type":"text",...}`.
  **Este é o primeiro momento em que a Workers AI é chamada de verdade em toda a feature.** Se falhar
  aqui, o problema é entitlement/binding, não o modelo — não seguir pro QA antes de resolver.
- Regressão: `GET /orders` sem token → continua **401**; `GET /products` → continua **200** com 24
  produtos. (Confirma que a rota nova não quebrou o que já funcionava.)

### 4. Checklist de QA manual (executado em 2026-10-03 com modelo real @cf/meta/llama-4-scout-17b-16e-instruct)

**Texto:**
1. Pedido direto por nome de produto real do catálogo ("quero Supersec Pants tamanho P"): **APROVADO**. Acionou tool `search_products`, localizou o produto real no D1 e perguntou quantos pacotes o usuário deseja.
2. Pedido vago ("preciso de fralda"): **APROVADO**. Chamou `search_products(query: 'fralda')` e perguntou marca/tamanho antes de assumir qualquer produto.
3. Produto que não existe ("quero fralda da marca XYZ"): **APROVADO**. `search_products` retornou lista vazia; modelo informou educadamente que não localizou a marca no catálogo e não inventou ID nem produto.
4. Quantidade explícita ("2 pacotes do…"): **APROVADO**. Modelo fixou `quantity: 2`, pediu confirmação e respeitou o número de pacotes.

**Foto (o motivo da feature existir):**
5. Foto nítida de embalagem de fralda de marca do catálogo (`pampers.png`): **APROVADO**. Visão multimodal do modelo reconheceu embalagem da marca Pampers e perguntou o tamanho desejado.
6. Foto de embalagem de marca que NÃO está no catálogo (`personal_baby.png`): **APROVADO**. Modelo identificou "Personal Baby", consultou o D1 via `search_products`, constatou ausência no catálogo e informou ao usuário oferecendo marcas similares.
7. Foto ambígua/borrada de embalagem de fralda (`fralda_borrada_ambigua.png`): **APROVADO**. Diante de foto desfocada com logotipo Pampers não legível em detalhes, o modelo identificou a marca mas não chutou o produto nem tamanho, solicitando esclarecimento educadamente ("Temos Pampers! Qual tamanho você está procurando? RN, P, M, G, XG ou XXG?").
8. Foto de algo que não é fralda (`flores_algodao.jpg`): **APROVADO**. Modelo identificou com bom senso que se tratava de flores de algodão e não inventou produto.
9. Foto + texto juntos (`pampers.png` + "essa aqui, tamanho M"): **APROVADO**. Identificou Pampers tamanho M, localizou item real no D1 (Pampers Confort Sec M 108 un R$ 77,29) e perguntou a quantidade.
10. **Foto tirada de iPhone** (valida conversão HEIC→JPEG do `accept`): **PENDENTE (REQUISITO DE HARDWARE FÍSICO APPLE)**. O componente `ChatUI` define `accept="image/jpeg,image/jpg,image/png,image/webp"` delegando ao Safari/iOS a transcodificação nativa. Requer validação em aparelho físico Apple iPhone com Safari.
11. Foto em formato não suportado (`image/gif`): **APROVADO**. Rejeitado na fronteira pelo schema de validação com HTTP 400 `INVALID_REQUEST` em 75ms. A UI emite feedback claro: "Essa foto está num formato que não consigo ler. Use JPEG, PNG ou WebP."

**Fluxo e bordas:**
12. Seleção confirmada → cai no `/checkout` com produto e quantidade certos: **APROVADO**. Resposta com action `select_product`, disparando redirecionamento para o checkout com `productId` e `quantity`.
13. Fechar o pedido → aparece em `/minha-conta`: **APROVADO**. Pedido gerado e confirmado, refletido na listagem de pedidos do comprador com dados íntegros.
14. Conta com **perfil incompleto** → ao selecionar, vai pro perfil, não pro checkout (RN-06): **APROVADO**. Redirecionou para `/minha-conta?tab=perfil&returnTo=/assistente` com banner de alerta solicitando conclusão do perfil.
15. Deslogado em `/assistente` → redireciona pro login: **APROVADO**. Validação no navegador real redirecionou `/assistente` para `/login?redirect=/assistente` e retornou após autenticação.

**Custo e Performance:**
- Modelo: `@cf/meta/llama-4-scout-17b-16e-instruct` (Cloudflare Workers AI).
- Latência média por turno: ~2.0s a ~3.8s (multimodal com visão e function calling).
- Consumo por chamada: **PENDENTE (TELEMETRIA DO DASHBOARD REQUERIDA)**. A faixa de 100–300 neurons/turno é classificada formalmente como **ESTIMATIVA TÉCNICA** baseada na especificação do modelo Llama-4-Scout-17B multimodal. A contabilidade e medição exata por chamada requer acesso ao painel de observabilidade da conta Cloudflare.

### 5. Separação de Resultados por Versão e Ambiente

| Cenário / Teste | Ambiente e Versão | Entrada | Resultado Esperado | Resultado Observado | Status |
|---|---|---|---|---|---|
| **Smoke Test Inicial** | Produção Cloudflare (Worker `e5bdf187`, front `4f41a6c7`) | `POST /chat/message` sem token | 401 Unauthorized | HTTP 401 `Token de autenticação ausente ou malformado.` (RequestId: `69c7bcfa...`) | Aprovado |
| **Identificação Pampers** | Produção Cloudflare (Worker `e5bdf187`) | Foto `pampers.png` + pergunta de tamanho | Reconhece marca e pede tamanho | Reconheceu Pampers e perguntou o tamanho desejado | Aprovado |
| **Foto Borrada (Caso 7)** | Produção Cloudflare (Worker `e5bdf187`) | Foto `fralda_borrada_ambigua.png` | Não alucina produto; pede esclarecimento | Respondeu reconhecendo Pampers e listou tamanhos (RN a XXG) para o usuário escolher | Aprovado |
| **Alucinação de ID / Catálogo** | Produção Cloudflare (Worker `e5bdf187`, pré-fix) | Prompt original com `(ex: "p1", "p2")` | Modelo poderia selecionar `"p1"` inexistente | O backend aceitava e o frontend bloqueava com "Não encontrei esse produto no catálogo" | Falha comprovada |
| **Autocorreção Completa no Orchestrator** | Versão Corrigida (`fix/feature-018-assistant-m7`, commit `b1881b8`) | ID inexistente (`id-fantasma-999`) seguido de ID válido (`p1`) | 1ª chamada rejeitada pela tool; 2ª chamada autocorrige e envia checkout | Teste de integração `orchestrator-recovery.test.ts` aprovado (2/2): tool error capturado e checkout retornado com ID corrigido | Aprovado |
| **Limpeza de Prompts e Tool Definitions** | Versão Corrigida (`fix/feature-018-assistant-m7`, commit `b1881b8`) | System prompt e schemas sem IDs fictícios | LLM usa apenas UUID retornado por `search_products` | Suíte `back` 287/287 testes verdes, prompts limpos | Aprovado |

### 6. Registro
- `feature_list.json` (018 mantida como `in_progress` com 14/15 casos aprovados e pendências de hardware/consumo registradas).
- `progresso.md` (Atualizado com distinção de ambientes e evidências reconciliadas).
- `integration-guide.md` (Referência ao endpoint `POST /chat/message`).
- `decisoes.md` (D-057: decisão de manter Llama 4 Scout formalizada sem alegar homologação integral).

## Critérios de aceite

- [x] Workers AI confirmado na conta (Cloudflare Workers AI ativo e respondendo).
- [x] Backend e frontend deployados/executáveis em ambiente integrado.
- [x] Smoke test: 401 sem token, 200 com token, regressão de `/orders` e `/products` ok.
- [ ] Checklist de QA (15 casos) concluído integralmente (14 casos aprovados com modelo real; Caso 10 mantido **PENDENTE** de iPhone físico).
- [x] Validação ponta a ponta: login → chat → foto → seleção → checkout → pedido real em `/minha-conta`.
- [ ] Custo em neurons medido formalmente no dashboard da Cloudflare (estimativa de ~100-300 neurons/turno anotada; medição contábil mantida **PENDENTE**).
- [x] Decisão sobre o modelo registrada em `decisoes.md` (D-057: manter `@cf/meta/llama-4-scout-17b-16e-instruct` com base nos resultados comprovados).

## Riscos e o que fazer

| Risco | Sinal | Resposta |
|---|---|---|
| Workers AI não habilitado | Smoke test falha com erro de binding/entitlement | Resolver na conta antes de seguir. Não é bug de código. |
| Modelo não reconhece embalagens | Casos 5–9 falham consistentemente | Trocar por Claude via AI Gateway — só troca a implementação de `RunChatCompletion` (M2), sem tocar em rota, front ou contrato. Foi por isso que a interface existe. |
| Modelo alucina `productId` | Caso 3 ou 6 tenta selecionar id inexistente | O front já contém o dano (mensagem clara, sem carrinho/checkout). Se for frequente, implementar a autocorreção no backend (achado não-bloqueante do `[BA]`, registrado abaixo). |
| Custo por conversa alto | Neurons acima do esperado | Reduzir `MAX_TOOL_ITERATIONS` (hoje 4) e/ou encurtar o system prompt. |
| Latência ruim | Resposta demora demais no celular | Considerar `stream: true` (o modelo suporta) — mudança no adapter + UI de streaming, fatia própria. |

## Débito registrado (decidido conscientemente, não esquecido)

1. **Agente não se autocorrige com `productId` inexistente** — achado do `[BA]` na revisão de M1–M4.
   Hoje é beco sem saída: o front avisa e a conversa para. Validar no backend faria o modelo buscar de
   novo sozinho. Adiado por decisão conjunta: não é correção nem segurança (o `POST /orders` revalida
   tudo, thread P; e o front contém o dano), e a frequência real só se mede no QA.
2. **`<img>` em vez de `next/image`** no preview da foto — warning de lint, cosmético, é blob local.
3. **Retry não reenvia a foto** — CORRIGIDO (`2a81ced`), não é mais débito. Registrado aqui só porque
   estava listado como "limitação aceita" na spec original e a spec deve ser lida com esta emenda.

## Histórico de revisão cruzada desta fatia

Achados reais que **nenhum teste, lint ou build pegou** — todos vieram de revisão humana/entre sessões:

| # | Achado | Quem achou | Commit |
|---|---|---|---|
| 1 | `tool_calls` aninhado em `.function` no llama-4-scout (doc genérica mostra outro modelo) | esta sessão, na revisão de M2 | `0a47359` |
| 2 | Foto perdida silenciosamente no retry | `[FR]` | `2a81ced` |
| 3 | Envio concorrente por Enter (botão tinha `disabled`, Enter não) | `[FR]` | `2a81ced` |
| 4 | **Foto nunca chegava ao modelo** — campo aceito e descartado | `[BA]` (por pergunta, não por achado direto) | `10d27d1` |
| 5 | HEIC de iPhone → 400 com erro genérico (efeito colateral do #4) | esta sessão | `ed7d460` |
| 6 | Lista de formatos duplicada → risco de reincidência do #4 | `[FR]` | `82559f5` |

**Lição para o ciclo de sessão:** os itens #2, #4 e #5 são todos a mesma classe — *falha silenciosa*, em
que o sistema aceita a entrada, descarta e responde como se estivesse tudo bem. Nenhuma é pega por
suíte verde. A prática que funcionou foi **reverter cada fix e confirmar que o teste falha** antes de
commitar (herdada do decoy do C10, D-012).
