# T3 — Enriquecer o schema de Produto (slug, categoria, descrição, atributos)

**Spec:** spec-compra-direta-carrinho-checkout.md — **RN-02** (D-020). **Feature:** 016 (trilha de enriquecimento).
**Papel:** subagente SA-ProdSchema (Haiku). Coordenador revisa pelo D-012. **Depende de:** nada. **Habilita:** T4.

## Objetivo
Dar ao `Product` os campos que a página de produto (T4, RN-04) precisa: `slug` (chave da rota
`/produto/[slug]`), `categoria`, `descricao` e `atributos` (registro tipado). Camada de dados pura + helper de
lookup por slug. Sem UI nesta task.

## Estado atual
`src/lib/products.ts`: `interface Product { id, name, brand, size, quantity, priceInCents, supplierId, badge? }`
+ `PRODUCTS` (23 itens) + `filterProducts`. `quantity` = unidades por pacote. Marcas: Pampers, Huggies,
MamyPoko, Turma da Mônica, Cremer. Tamanhos: RN, P, M, G, GG, XXG.

## Escopo — MODIFICAR `src/lib/products.ts`

1. **Tipos novos:**
   ```ts
   // Categoria do produto. Hoje o catalogo e 100% fraldas; o tipo deixa espaco para expandir
   // (maes/bebes/cuidados/wellness) sem quebrar consumidores. RN-02.
   export type ProductCategory = 'fraldas-descartaveis'

   export interface ProductAtributos {
     faixaPeso: string        // ex.: "5–9 kg" (mapeado por tamanho)
     genero: 'unissex'        // fraldas sao unissex; tipo deixa espaco para variar no futuro
     absorcao: string         // ex.: "ate 12 horas"
     tecnologia: string       // ex.: "camada seca antivazamento"
   }
   ```
   **Ponto de extensão UCP (RN-02):** deixar um comentário/tipo marcando onde um **descritor estruturado para
   descoberta por agentes** se encaixaria (ex.: `// UCP: aqui entraria um descriptor { schema, capabilities }
   para descoberta por agentes — NAO implementar agora`). NÃO implementar descoberta/UCP.

2. **`Product` ganha:** `slug: string`, `categoria: ProductCategory`, `descricao: string`, `atributos: ProductAtributos`.

3. **Popular os 23 produtos** com esses campos:
   - `slug`: kebab-case único derivado de marca+nome+tamanho, ex.: `pampers-supersec-pants-p`,
     `turma-da-monica-baby-rn` (sem acento: "Mônica" → "monica"). **Devem ser únicos** (marca+nome+tamanho já
     desambigua). Escreva os slugs literais no array (não gere em runtime, para serem estáveis/óbvios).
   - `categoria`: `'fraldas-descartaveis'` para todos.
   - `faixaPeso` por tamanho (mapa realista de fraldas):
     RN→"ate 4 kg", P→"3–6 kg", M→"5–9 kg", G→"9–12,5 kg", GG→"12–15 kg", XXG→"acima de 14 kg".
   - `genero`: `'unissex'` para todos. `absorcao`: `"ate 12 horas"` (pode variar 1–2 valores se quiser).
     `tecnologia`: uma frase curta coerente com a marca/linha (ex.: Pampers Supersec → "camada seca
     antivazamento"; Huggies Natural Fit → "toque suave com aloe"). Curto e plausível — é mock.
   - `descricao`: 1–2 frases por produto, concretas e específicas do produto (nome/marca/tamanho/uso). Evitar
     texto genérico repetido; pode variar por linha de produto. É mock, mas deve ler bem numa página real.

4. **Helper novo:** `export function getProductBySlug(slug: string): Product | undefined`
   (`PRODUCTS.find(p => p.slug === slug)`).

5. **`filterProducts`:** manter o comportamento atual. A busca por texto **pode** passar a considerar `categoria`
   também, mas é opcional e não pode quebrar os testes existentes do catálogo — se em dúvida, NÃO mexer na busca.

## CRIAR teste `src/lib/__tests__/products.test.ts`
- Todo produto tem `slug` não-vazio; **todos os slugs são únicos** (Set size === PRODUCTS.length).
- Todo produto tem `categoria`, `descricao` não-vazia e `atributos` com `faixaPeso`/`genero`/`absorcao`/`tecnologia`.
- `faixaPeso` bate com o tamanho (ao menos um caso por tamanho, ou um mapa esperado).
- `getProductBySlug` retorna o produto certo para um slug existente e `undefined` para inexistente.
- (Se houver teste do catálogo hoje, garantir que `filterProducts` segue verde.)

## Restrições (governança)
- "NOT the Next.js you know" — não relevante aqui (camada de dados), mas cheque docs se precisar.
- **NÃO usar `any`** (código nem teste). NÃO duplicar dinheiro (`formatPrice`).
- NÃO tocar na LÓGICA de: ProductCard, catálogo, checkout, contexts, `src/components`, `src/app`. **Código de produção
  só em `products.ts`.** EXCEÇÃO: literais de `Product` em **fixtures de teste** (ex.: `TEST_PRODUCT` em
  `ProductCard.test.tsx`) vão quebrar o `tsc` por faltarem os campos novos — você DEVE adicionar os 4 campos
  (`slug`/`categoria`/`descricao`/`atributos`) a esses literais, **sem** mudar a lógica/asserções dos testes.
  Faça um grep por literais de `Product` e corrija todos os que o `tsc` apontar.
- Não renomear/remover campos existentes de `Product` (id, name, brand, size, quantity, priceInCents, supplierId,
  badge) — só ADICIONAR. Não mudar `filterProducts` de forma que quebre a UI/os testes atuais.
- NÃO commitar.

## Critério de pronto (DoD) — provar com execução (front/ do worktree)
1. `npm test` → todos verdes (199 anteriores + os novos). Colar saída real.
2. `npm run lint; echo "exit=$?"` (SEM pipe, no **Bash**) → exit 0 (só o warning pré-existente de supplier-mock.ts).
3. `npx tsc --noEmit` → sem erro (importante: adicionar campos obrigatórios ao `Product` faz o compilador
   apontar qualquer consumidor que construa `Product` sem eles — resolver todos).
4. `npm run build` → sucesso.
Loop de no máx. 3 tentativas; depois PARAR e reportar o bloqueio literal.

## Entregável
Arquivos alterados; saída literal dos 4 comandos (exit real do lint no Bash); `git status --short`;
decisões de borda; confirmação: "sem any", "slugs unicos", "so adicionei campos (nada removido)",
"UI/testes existentes intactos".
