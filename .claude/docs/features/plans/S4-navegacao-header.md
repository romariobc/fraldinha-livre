# S4 — Reestruturar navegação (Header)

**Thread:** S · **Depende de:** S1 ✅ (`useCart`)
**Papel:** subagente SA-Nav (Haiku). Coordenador revisa pelo D-012.
**Origem:** feedback 2026-07-09 — "não está claro o acesso à sacola/perfil; só chego ao perfil clicando na
sacola. Quero: acesso ao perfil/edição/configurações ao clicar no email; sacola = sacola."

## Objetivo

Separar as duas funções que hoje estão coladas no ícone de sacola do `Header`:
- **Ícone de sacola → `/sacola`** (o carrinho), badge = **itens do carrinho** (`useCart.itemCount`).
- **Email (do auth) → menu da conta** (Perfil / Minha conta / Sair).

`Header` é componente COMPARTILHADO (todas as páginas via layout) — mudança de alto alcance. **Preservar tudo
o resto** (logo, NAV_LINKS, menu mobile, botões Entrar/Criar conta quando deslogado). Sem `any`.

## Estado atual (para referência, ver o arquivo)
`src/components/Header.tsx`: usa `useOrders` só para `activeOrdersCount` (badge da sacola aponta para
pedidos — ERRADO); `handleCartClick` empurra para `/minha-conta`; email é `<span>` não-clicável; há um
botão `LogOut` separado. Desktop e mobile têm o ícone de sacola.

## Escopo — MODIFICAR `src/components/Header.tsx`

1. **Sacola → /sacola, badge = carrinho:**
   - Trocar `useOrders`/`activeOrdersCount` por `useCart` → usar `itemCount`.
     (Se `useOrders` não for mais usado no arquivo, remover o import — sem código morto.)
   - O ícone de sacola (desktop E mobile) vira navegação para **`/sacola`** (pode ser `<Link href="/sacola">`
     estilizado como o botão atual, ou botão com `router.push('/sacola')`). NÃO forçar login (o carrinho é
     local; login só no checkout). O badge mostra `itemCount` quando `itemCount > 0` (não depende de `user`).
   - `aria-label` do ícone: "Sacola".

2. **Email → menu da conta (dropdown leve, só quando logado):**
   - Substituir o `<span>{user.email}</span>` + botão LogOut por um **botão-gatilho** que mostra o email
     (ou `displayName` se houver) + um chevron (`ChevronDown` do lucide). Ao clicar, abre um **dropdown**.
   - Dropdown implementado inline (NÃO existe primitivo): `useState(open)`, fecha ao clicar fora
     (listener de `mousedown` no document via `useEffect`, com `ref` no container) e ao pressionar `Escape`.
     Acessibilidade: gatilho com `aria-haspopup="menu"` + `aria-expanded={open}`; o painel com `role="menu"`;
     itens com `role="menuitem"`.
   - Itens do menu:
     - **"Minha conta"** → `/minha-conta` (aba Pedidos).
     - **"Meu perfil"** → `/minha-conta?tab=perfil` (onde ficam dados/edição/configurações do perfil).
     - **"Sair"** → chama `signOutUser()` (mesmo fluxo do `handleLogout` atual: signOut → `router.push('/')`
       → toast de sucesso). Mover o logout para cá; remover o botão `LogOut` separado do desktop.
   - Deslogado: manter os botões **Entrar** / **Criar conta grátis** exatamente como estão.

3. **Menu mobile:** manter o ícone de sacola (→ `/sacola`, badge de itens). Na seção logada do menu mobile,
   além de "Sair", adicionar links **"Minha conta"** (`/minha-conta`) e **"Meu perfil"** (`/minha-conta?tab=perfil`),
   fechando o menu ao navegar. Deslogado: manter Entrar/Criar conta.

- Reuse: `useCart` de `@/contexts/cart-context`; `useAuth` de `@/contexts/auth-context`; ícones lucide;
  `toast` de sonner (já usado). NÃO criar novo componente em `ui/` (sem tocar em `src/components/ui`).

## CRIAR teste `src/components/__tests__/Header.test.tsx`
Como o Header usa `useAuth` (Firebase) e `useRouter`, **mocke com `vi.mock`**:
- `vi.mock('@/contexts/auth-context', () => ({ useAuth: () => ({ user: {...}|null, displayName, signOutUser: vi.fn(), ... }) }))`
- `vi.mock('@/contexts/cart-context', () => ({ useCart: () => ({ itemCount: N, ... }) }))`
- `vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }))`
- `vi.mock('sonner', ...)` se necessário.
Cobrir:
- Logado: o ícone/link da sacola aponta para `/sacola`; badge mostra o `itemCount` mockado.
- Logado: o gatilho do email está presente; clicar abre o menu; menu tem "Meu perfil" (href
  `/minha-conta?tab=perfil`) e "Sair"; clicar "Sair" chama `signOutUser`.
- Deslogado: aparecem "Entrar" e "Criar conta"; NÃO aparece o menu de conta.
(Use `@testing-library/react` + `user-event`; envolva interações conforme necessário.)

## Restrições (governança)
- Trabalho de UI — se `Skill(ui-system)` existir, invoque; senão siga as convenções do projeto e a11y.
- NÃO usar `any`. NÃO tocar em `cart-context.tsx`, `auth-context.tsx`, nas páginas, nem em `src/lib` /
  `src/components/ui`. Só `Header.tsx` + o teste novo.
- Preservar 100% do comportamento deslogado e dos NAV_LINKS/logo.

## Critério de pronto (DoD) — provar com execução
No `front/` do worktree (`E:\Labdev\Projetos\fraldinha-livre\.claude\worktrees\eloquent-montalcini-2dff41\front`):
1. `npm test` → todos verdes (131 anteriores + os novos do Header). Colar saída real.
2. `npm run lint; echo "exit=$?"` (SEM pipe) → exit 0 (só o warning pré-existente de supplier-mock.ts).
3. `npx tsc --noEmit` → sem erro.
4. `npm run build` → sucesso.

Loop de no máx. 3 tentativas. Se falhar depois, PARAR e reportar o bloqueio literal. NÃO commitar.

## Entregável
- `Header.tsx` (modificado) + teste (criado).
- Saída literal dos 4 comandos do DoD (com exit real do lint).
- `git status --short`.
- Decisões de borda.
