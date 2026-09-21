# S6 — Correções de UX: menu duplicado, plural, quantidade no card

**Origem:** feedback de usabilidade do cliente (2026-07-10), após validação do checkout (S5).
**Papel:** subagente SA-UXFix (Haiku). Coordenador revisa pelo D-012.

## Contexto
Três achados independentes, todos pequenos. NÃO tocar no fluxo de checkout (S5) nem nos contexts.

---

## Fix 1 — Remover "Meu perfil" do menu da conta (`src/components/Header.tsx`)

O dropdown do e-mail tem **"Minha conta"** (`/minha-conta`) e **"Meu perfil"** (`/minha-conta?tab=perfil`).
São semanticamente o mesmo destino (a aba Perfil já é alcançável por dentro da página). Pior: navegar de
`/minha-conta` para `/minha-conta?tab=perfil` é client-side e **não remonta** o componente, então o
`useState(() => searchParams.get('tab'))` não reexecuta e a aba Pedidos continua ativa — link quebrado.

**Decisão do cliente: excluir "Meu perfil".**

- Remover o item "Meu perfil" do **dropdown desktop** (Header.tsx ~linha 150) e do **menu mobile** (~linha 239).
- Manter "Minha conta" (`/minha-conta`) e "Sair".
- NÃO alterar `minha-conta/page.tsx` — o `?tab=perfil` continua válido para a trava RN-06 vinda do catálogo
  (`router.push('/minha-conta?tab=perfil&returnTo=/catalogo')`), que monta a página do zero e funciona.
- Atualizar `src/components/__tests__/Header.test.tsx`: remover/ajustar as asserções de "Meu perfil"
  (linhas ~175, ~207-215, ~332, ~373-384, ~422). O contador de menuitems passa de `>= 3` para `>= 2`.

## Fix 2 — Plural quebrado na sacola (`src/app/(main)/sacola/page.tsx`)

Hoje: `{itemCount} item{itemCount !== 1 ? 'ns' : ''}` → renderiza **"2 itemns"**.
Trocar por pluralização correta: `{itemCount} {itemCount === 1 ? 'item' : 'itens'}`.
Ajustar o teste em `src/app/(main)/sacola/__tests__/page.test.tsx` se ele afirmar o texto antigo.

## Fix 3 — Seletor de quantidade no ProductCard (`src/components/catalogo/ProductCard.tsx`)

Hoje o card só adiciona **1 unidade** por clique. O usuário quer escolher a quantidade (ex.: 3 pacotes) e
**continuar comprando** (já é o comportamento: não navega).

- Adicionar um **stepper de quantidade** acima da CTA "Adicionar à sacola": botão `−`, número, botão `+`.
  - Estado local `const [quantity, setQuantity] = useState(1)`.
  - Guard: mínimo **1** (o `−` fica desabilitado em 1). Somente inteiros. Sem máximo.
  - a11y: `aria-label` nos botões ("Diminuir quantidade de {nome}", "Aumentar quantidade de {nome}") e o
    número num elemento com `aria-live="polite"` (ou `aria-label` descritivo). Reusar o visual do stepper da
    `/sacola` (pílula `bg-slate-100 rounded-full`, ícones `Minus`/`Plus` de lucide-react).
- "Adicionar à sacola" passa a montar o `CartItem` com `quantity` (o valor do stepper), **não** `1`.
  (O `cart.addItem` já faz merge somando quantidade por `productId+supplierId` — não mudar o contexto.)
- Após adicionar: **resetar o stepper para 1** e manter o toast atual ("Adicionado à sacola" + ação "Ver sacola").
  Continua **sem exigir login** e **sem navegar** (continuar comprando).
- "Comprar agora" e "Pedir oferta" ficam **inalterados** (Comprar agora segue `onBuy(product)`, que adiciona 1 e
  vai pro checkout — não mexer no flip do S5).
- Atualizar `src/components/catalogo/__tests__/ProductCard.test.tsx`:
  - o teste que espera `quantity: 1` continua válido (default);
  - novo teste: clicar `+` duas vezes → `addItem` recebe `quantity: 3`;
  - novo teste: `−` desabilitado quando quantidade é 1 (não desce abaixo de 1);
  - novo teste: após adicionar, o stepper volta a exibir 1.

---

## Restrições (governança)
- Projeto é "NOT the Next.js you know" — cheque `node_modules/next/dist/docs/` se precisar.
- Trabalho de UI: invoque `Skill(ui-system)` se existir.
- **NÃO usar `any`** (código nem teste). Mocks com `vi.mocked(...)`.
- NÃO tocar em: cart-context, orders-context, checkout, `src/lib`, `src/components/ui`, feature-flags.
- NÃO commitar.

## Critério de pronto (DoD) — provar com execução
No `front/` do worktree (`...\eloquent-montalcini-2dff41\front`):
1. `npm test` → todos verdes (191 anteriores ± ajustes). Colar saída real.
2. `npm run lint; echo "exit=$?"` (SEM pipe, no **Bash**) → exit 0 (só o warning pré-existente de supplier-mock.ts).
3. `npx tsc --noEmit` → sem erro.
4. `npm run build` → sucesso.
Loop de no máx. 3 tentativas; depois PARAR e reportar o bloqueio literal.

## Entregável
Arquivos alterados; saída literal dos 4 comandos (exit real do lint no Bash); `git status --short`;
decisões de borda; confirmação: "sem any", "Meu perfil removido (desktop+mobile)", "plural corrigido",
"stepper com guard >= 1 e reset apos adicionar", "checkout/flip intactos".
