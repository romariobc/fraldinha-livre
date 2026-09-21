# T4 — Página de produto `/produto/[slug]` + cards linkam

**Spec:** spec-compra-direta-carrinho-checkout.md — **RN-04** (página) + **RN-05** (cards linkam). **Feature:** 016.
**Papel:** subagente SA-ProdPage (Haiku). Coordenador revisa pelo D-012. **Depende de:** T3 ✅ (slug/atributos/getProductBySlug).

## Coerência com o que JÁ existe (importante — a spec tem texto antigo)
A spec fala em `/carrinho` e "Adicionar ao carrinho", mas o que foi construído é **`/sacola`** com **"Adicionar à
sacola"**. Também já valem: **gate de login em toda ação de compra (D-024)**, **stepper de quantidade (S6)** e
**"Comprar agora" = addItem + navegar para `/checkout` (D-023, flip)**. A página de produto deve seguir ESSAS
regras, não o texto antigo. Reusar exatamente os padrões do `ProductCard.tsx`.

## Objetivo
Rota `/produto/[slug]` que mostra um produto (nome, marca, tamanho, preço, fornecedor+rating, descrição,
atributos), com **stepper de quantidade** e as CTAs **"Adicionar à sacola"** e **"Comprar agora"** — ambas
**gateadas por login** e **respeitando a quantidade**. Cards do catálogo passam a **linkar** para a página.
Slug inexistente → **404**.

## Parte 1 — CRIAR a página `src/app/(main)/produto/[slug]/page.tsx` (`'use client'`)
- **Ler o slug da rota:** este projeto é "NOT the Next.js you know" — **antes de escrever, cheque
  `node_modules/next/dist/docs/`** como ler params de rota nesta versão (16.2.4). Preferir `useParams()` de
  `next/navigation` num componente client (evita a questão de `params` ser Promise). Se usar outra forma, confirme
  nos docs instalados.
- `const product = getProductBySlug(slug)` (de `@/lib/products`). Se `!product` → **404**: use `notFound()` de
  `next/navigation` (confirme no docs instalado que funciona em client component; se não, renderize um estado
  "Produto não encontrado" com link para `/catalogo`).
- **Conteúdo (reusar tokens do projeto — `container-fl`, `brand-*`, `primary-*`, `rounded-card`, `shadow-card`):**
  - Breadcrumb simples: `Catálogo` (Link → /catalogo) / `{product.name}`.
  - Coluna imagem: placeholder grande (emoji 🧷, `aspect-square bg-primary-light`, igual estética do card) + badge se houver.
  - Coluna info: marca (uppercase), `name`, `Tam. {size} · {quantity} un.`, fornecedor + estrelas
    (STORE_SUPPLIERS lookup, mesmo padrão do ProductCard: rating → `★`/`☆`), preço via `formatPrice(priceInCents)`.
  - `descricao` (parágrafo).
  - **Atributos** (lista/tabela pequena): Faixa de peso (`atributos.faixaPeso`), Gênero (`atributos.genero`),
    Absorção (`atributos.absorcao`), Tecnologia (`atributos.tecnologia`), Unidades por pacote (`quantity`).
  - **Stepper de quantidade** (mesmo componente visual do card/sacola: pílula `bg-slate-100 rounded-full`,
    `Minus`/`Plus` de lucide-react, guard mínimo 1, `aria-label`).
  - **CTAs:**
    - **"Adicionar à sacola"** (primária): se `!isLoggedIn` → `router.push('/login?redirect=/produto/${slug}')`;
      senão monta `CartItem` (`productId: product.id`, `productName: `${name} ${size}``, supplierId, supplierName,
      unitPrice: priceInCents, quantity: <stepper>, unit: 'un'`), `cart.addItem`, `toast.success('Adicionado à
      sacola', { action: { label: 'Ver sacola', onClick: () => router.push('/sacola') } })`, **reset stepper p/ 1**,
      permanece na página.
    - **"Comprar agora"** (secundária): se `!isLoggedIn` → login (mesmo redirect); se logado e
      `!isProfileComplete(profile)` → `router.push('/minha-conta?tab=perfil&returnTo=/produto/${slug}')` (RN-06);
      senão `cart.addItem(item)` (com a quantidade) + `router.push('/checkout')`.
  - `isLoggedIn = user !== null` (de `useAuth()`).
- **Reuso obrigatório:** `useCart`, `useAuth`, `isProfileComplete` (@/lib/utils), `formatPrice`, `STORE_SUPPLIERS`,
  `type CartItem`, `toast`. **NÃO** duplicar dinheiro. NÃO usar `any`.
- **Dívida técnica a marcar (não resolver):** a lógica das CTAs replica o `ProductCard.tsx`. Deixe um comentário
  `// TODO(T4.1): extrair hook compartilhado de compra com ProductCard (evitar drift do gate/quantidade)`.

## Parte 2 — Cards do catálogo linkam para a página (RN-05) — `src/components/catalogo/ProductCard.tsx`
- Envolver **apenas a imagem e o bloco de nome/marca/tam** num `<Link href={`/produto/${product.slug}`}>`
  (NÃO envolver os botões — evita link aninhado com controles interativos). Manter as 3 CTAs como estão.
- Cuidado a11y: o Link não deve quebrar os `aria-label`/roles existentes dos botões. Nada de `<a>` dentro de `<button>` nem vice-versa.

## Testes
- **CRIAR** `src/app/(main)/produto/[slug]/__tests__/page.test.tsx` (RTL; mocke `useParams`/`useRouter` de
  next/navigation, `useCart` e `useAuth` com **`vi.mocked`**; mocke `sonner`). Cobrir:
  - Renderiza nome/preço/atributos de um slug válido.
  - Slug inexistente → 404/estado "não encontrado" (se usar `notFound`, verifique que é chamado; mocke-o).
  - Deslogado + "Adicionar à sacola" → NÃO chama `addItem`, redireciona `/login?redirect=/produto/<slug>`.
  - Logado + "Adicionar à sacola" com stepper em 2 → `addItem` recebe `quantity: 2` + toast.
  - "Comprar agora" logado (perfil completo) → `addItem` + `push('/checkout')`.
- **ATUALIZAR** `src/components/catalogo/__tests__/ProductCard.test.tsx` se o Link novo exigir (ex.: novo teste:
  a imagem/título linka para `/produto/${slug}`). Não quebrar os testes existentes.

## Restrições (governança)
- "NOT the Next.js you know": **cheque `node_modules/next/dist/docs/`** para params de rota e `notFound` antes de escrever.
- UI: invoque `Skill(ui-system)` se existir.
- **NÃO usar `any`** (código nem teste). Mocks com `vi.mocked`.
- NÃO tocar em: cart-context, orders-context, checkout, `src/lib` (T3 já fechou o schema), `src/components/ui`,
  feature-flags. Só criar a página + seu teste e alterar `ProductCard.tsx` (só o Link) + seu teste.
- NÃO commitar.

## Critério de pronto (DoD) — provar com execução (front/ do worktree)
1. `npm test` → todos verdes (211 anteriores + os novos). Colar saída real.
2. `npm run lint; echo "exit=$?"` (SEM pipe, no **Bash**) → exit 0 (só o warning pré-existente de supplier-mock.ts).
3. `npx tsc --noEmit` → sem erro.
4. `npm run build` → sucesso (a rota `/produto/[slug]` deve aparecer na saída do build).
Loop de no máx. 3 tentativas; depois PARAR e reportar o bloqueio literal.

## Entregável
Arquivos criados/alterados; saída literal dos 4 comandos (exit real do lint no Bash); `git status --short`;
decisões de borda (inclusive COMO leu o slug e o 404, citando o doc do Next que consultou); confirmação:
"sem any", "CTAs gateadas por login + quantidade", "cards linkam para /produto/[slug]", "slug inexistente = 404",
"checkout/flip/contexts intactos".
