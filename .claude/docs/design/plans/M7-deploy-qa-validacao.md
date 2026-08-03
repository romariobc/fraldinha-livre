# M7 — Deploy real + QA manual + validação humana (feature 018)

**Executor:** coordenador + cliente (NÃO subagente) | **Autor:** sessão-mãe (2026-08-03) | **Status:** aguardando pré-requisito humano
**Spec:** `.claude/docs/design/specs/spec-app-mobile-chat-agent.md` (APROVADA)
**Plano:** `.claude/docs/design/plans/M-app-mobile-chat-agent-breakdown.md` (tarefa M7, dep: M1–M6 — todas APROVADAS e revisadas pelas 3 sessões)

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

### 4. Checklist de QA manual (o coração desta tarefa)

Não é automatizável — é o único jeito de saber se o modelo entrega. Registrar o resultado de CADA caso.

**Texto:**
1. Pedido direto por nome de produto real do catálogo ("quero Supersec Pants tamanho P").
2. Pedido vago ("preciso de fralda") → agente deve perguntar marca/tamanho, não chutar.
3. Produto que não existe ("quero fralda da marca XYZ") → deve informar que não achou, sem inventar id.
4. Quantidade explícita ("2 pacotes do…") → deve chegar ao checkout com quantidade 2.

**Foto (o motivo da feature existir):**
5. Foto nítida de embalagem de fralda de marca do catálogo → reconhece e sugere o produto certo.
6. Foto de embalagem de marca que NÃO está no catálogo → informa que não tem, sem alucinar.
7. Foto ambígua/borrada → pede esclarecimento (marca/tamanho), não chuta nem trava.
8. Foto de algo que não é fralda → responde com bom senso, não inventa produto.
9. Foto + texto juntos ("essa aqui, tamanho M").
10. **Foto tirada de iPhone** (valida a conversão HEIC→JPEG do `accept`).
11. Foto em formato não suportado, se conseguir forçar → deve dar a mensagem clara
    ("formato que não consigo ler"), não erro genérico.

**Fluxo e bordas:**
12. Seleção confirmada → cai no `/checkout` com produto e quantidade certos.
13. Fechar o pedido → aparece em `/minha-conta` (ponta a ponta real, mesma validação de B9/P3/C11).
14. Conta com **perfil incompleto** → ao selecionar, vai pro perfil, não pro checkout (RN-06).
15. Deslogado em `/assistente` → redireciona pro login.

**Custo:** ao final, anotar quantos neurons a sessão de QA consumiu (dashboard Workers AI) para ter
referência real de custo por conversa. Era uma constraint explícita da spec.

### 5. Registro
- `feature_list.json` (018 → done, com o resumo da validação real).
- `progresso.md`.
- `integration-guide.md`: seção sobre `POST /chat/message` (mesmo padrão das de `/orders` e `/products`).
- `decisoes.md`: registrar a decisão sobre o modelo — **manter llama-4-scout** ou **migrar para Claude
  via AI Gateway** — com base no que o QA mostrar, não em preferência.

## Critérios de aceite

- [ ] Workers AI confirmado na conta (pré-requisito humano).
- [ ] Backend e frontend deployados.
- [ ] Smoke test: 401 sem token, 200 com token, regressão de `/orders` e `/products` ok.
- [ ] Checklist de QA (15 casos) executado e **cada resultado registrado** — inclusive os que falharem.
- [ ] Validação ponta a ponta: login → chat → foto → seleção → checkout → pedido real em `/minha-conta`.
- [ ] Custo em neurons anotado.
- [ ] Decisão sobre o modelo registrada em `decisoes.md`.

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
