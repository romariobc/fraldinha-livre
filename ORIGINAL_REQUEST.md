# Original User Request

## Initial Request — 2026-08-09T04:03:15Z

Corrigir e finalizar o chat-agent do marketplace **Fraldinha Livre** para funcionar como app mobile PWA. O agente conversa com o usuário por texto/foto para encontrar fraldas no catálogo e, quando o produto é escolhido, direciona para o checkout na web.

Working directory: `E:\Labdev\Projetos\fraldinha-livre`

---

## Contexto do projeto

Stack: Next.js (front, Cloudflare Containers) + Hono/Drizzle/D1 (back, Cloudflare Workers) + Workers AI (llama-4-scout-17b).

- Frontend deploy: `https://fraldinha-livre-frontend.romariobc.workers.dev`
- Backend deploy: `https://fraldinha-livre-backend.romariobc.workers.dev`
- Branch atual: `chat-agent-hoje` (já no GitHub, PR #13 aberto para `main`)
- Rota do chat: `/assistente` (front) → `POST /chat/message` (back)
- Arquivo principal do backend do chat: `back/src/routes/chat.ts`
- Componente principal do frontend: `front/src/components/assistente/ChatUI.tsx`
- Arquivo de integração com Workers AI: `back/src/lib/chat-completion.ts`

**Bug crítico confirmado em produção:**
O modelo `llama-4-scout-17b` frequentemente **escreve chamadas de tool como texto** em vez de chamar a tool de verdade. Exemplos observados:
- Escreve `[search_products(brand="Pampers", size="XG", categoria="fralda")]` no meio de uma mensagem de texto
- Escreve `[select_product_for_purchase(productId="p3", quantity=1)]` em vez de disparar a ação

O SYSTEM_PROMPT já tem regras explícitas contra isso (`be5b04c`), mas o modelo continua violando.

---

## Requirements

### R1. Eliminar vazamento de sintaxe de tool nas respostas do assistente

O backend (`back/src/routes/chat.ts` e `back/src/lib/chat-completion.ts`) deve detectar e tratar padrões de tool call vazados como texto. Dois casos:

**Caso A — tool call vazada é recuperável:**
Se o texto da resposta contém um padrão `[select_product_for_purchase(productId="...", quantity=N)]`, parsear os argumentos e tratar como se o modelo tivesse chamado a tool de verdade (disparar a ação de checkout).

**Caso B — tool call de busca vazada:**
Se o texto contém `[search_products(...)]`, executar a busca com os argumentos extraídos, continuar o loop e retornar a resposta real ao usuário — sem exibir a sintaxe.

**Caso C — fallback seguro:**
Se não for possível parsear, remover os padrões `[nomefuncao(...)]` do texto antes de retornar ao usuário, nunca deixar sintaxe de programação aparecer na UI.

A remoção deve ser feita por regex cobrindo o padrão `\[nome_funcao\(.*?\)\]` (single-line e multi-line).

### R2. Melhorar a mensagem quando nenhum produto é encontrado

Quando `search_products` retorna array vazio, o assistente deve responder ao usuário de forma natural ("Não encontrei fralda Pampers tamanho XG no catálogo. Temos os tamanhos P, M, G e GG — qual prefere?") em vez de exibir erro genérico ou vazar sintaxe.

O backend pode enriquecer o resultado da tool com uma mensagem de fallback quando o array for vazio, para guiar o modelo.

### R3. UI do chat: experiência mobile-first

O componente `front/src/components/assistente/ChatUI.tsx` deve:

- Ter layout em tela cheia no mobile (ocupar `100dvh`, sem padding lateral desnecessário)
- Rolar automaticamente para a última mensagem quando uma nova chegar (`scrollIntoView`)
- Mostrar indicador visual de "digitando..." animado (3 pontos pulsando) enquanto aguarda resposta
- Suportar envio com Enter no teclado mobile (soft keyboard)
- Exibir uma mensagem de boas-vindas da assistente ao abrir o chat pela primeira vez ("Olá! Sou a assistente da Fraldinha Livre. Como posso te ajudar a encontrar o produto certo?")
- Manter a barra de input fixada na parte de baixo (não subir com o conteúdo)

### R4. Testes passando e deploy

Após as correções:
- `npm test` em `back/` deve passar (suite existente)
- `npm test` em `front/` deve passar (suite existente)
- `npm run lint` e `npx tsc --noEmit` em `front/` devem terminar com exit 0
- Deploy do backend via `npx -y wrangler@4.86.0 deploy` a partir de `back/`
- Commit e push na branch `chat-agent-hoje` (não na `main` — o PR #13 já está aberto)

---

## Acceptance Criteria

### Backend — sem vazamento de sintaxe
- [ ] Dado a mensagem de usuário `"fralda pampers G"`, a resposta do backend nunca contém os caracteres `[search_products` nem `[select_product_for_purchase` na string de texto retornada (`response.content`)
- [ ] Dado que o modelo retorna um texto contendo `[select_product_for_purchase(productId="p3", quantity=1)]`, o backend retorna `{"type":"action","productId":"p3","quantity":1}` — não um `type:"text"`
- [ ] Quando `search_products` retorna `[]`, a próxima resposta de texto do assistente menciona "não encontrei" ou "não temos" — sem erro 502 e sem sintaxe de função

### Frontend — UX mobile
- [ ] A `ChatUI` exibe uma mensagem inicial do assistente antes do usuário digitar qualquer coisa
- [ ] Após cada resposta do assistente, a área de mensagens rola automaticamente para mostrar a última mensagem
- [ ] O indicador "digitando..." é visível durante `sending === true`
- [ ] No mobile (viewport < 640px), a ChatUI ocupa a altura disponível sem overflow, com o input fixo na parte de baixo

### Testes e build
- [ ] `npm test` em `back/` passa com exit 0
- [ ] `npm test` em `front/` passa com exit 0
- [ ] `npm run build` em `front/` termina com exit 0 (sem erros de TypeScript)
- [ ] Deploy do backend retorna status `Success` (sem erro do wrangler)
- [ ] Branch `chat-agent-hoje` tem os commits das correções (verificável via `git log --oneline -5`)

---

## Restrições

- Não mergear na `main` — só commitar e fazer push na `chat-agent-hoje`
- Não criar novos endpoints nem mudar o schema do banco
- Não substituir o modelo de AI (`llama-4-scout-17b`) — apenas melhorar o handling do seu output
- Tudo em TypeScript; sem `any` nos arquivos tocados (salvo onde já existia)
- Conventional Commits em pt-BR para as mensagens de commit
