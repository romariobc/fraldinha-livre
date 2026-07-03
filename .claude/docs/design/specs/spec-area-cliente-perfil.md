# Spec — Área do cliente real (perfil persistido no Firestore)

**Dominio:** comprador (minha-conta) + auth | **Feature relacionada:** 007a | **Status:** rascunho (aguardando review do cliente)

## Contexto

A validação humana da compra (2026-07-02) revelou uma incoerência de fundo: o auth (005a) entregou
**identidade** real (nome/e-mail do Google + `role` no Firestore), mas o **perfil** (CPF, telefone,
endereço) ainda é o `MOCK_USER` (Ana Lima, Av. Paulista) hardcoded. Consequências: a aba Perfil
mostra dados fake enquanto a saudação mostra o usuário real; e a compra usa o endereço mock como
"endereço de cadastro" — dados falsos. Esta feature torna o perfil do comprador **real, persistido e
editável**, e o usa na compra. Puxa parte da feature 007 para a Fase 1.

Decisões do cliente (2026-07-03):
- **Coleta do perfil:** bloquear a compra até o perfil estar completo (não coletar no onboarding).
- **Campos obrigatórios:** endereço completo + CPF + telefone.
- **UX:** trava de compra leva à aba Perfil (banner + formulário), não a página dedicada.
- **Sacola:** contador de pedidos ativos.

Incorpora as duas findings do security-review de 2026-07-03 (ver D-013).

## Regras de negócio

- **RN-01 (modelo de dados)** O doc `users/{uid}` no Firestore passa a ser:
  `{ role, name, email, cpf, phone, address: { logradouro, numero, complemento?, bairro, cidade,
  estado, cep }, createdAt, updatedAt }`. `name` vem do Google (editável); `email` do Google
  (readonly); `role` definido no onboarding (imutável depois — RN-08).

- **RN-02 (fonte de verdade)** O `AuthContext` (`useAuth()`) passa a carregar e expor `profile`
  (o doc completo) e `updateProfile(patch)`. Um helper puro `isProfileComplete(profile)` retorna
  true só se `cpf`, `phone` e todos os campos obrigatórios de `address` (logradouro, numero, bairro,
  cidade, estado, cep) estiverem preenchidos (trim != ''). O `MOCK_USER` sai do fluxo do comprador.

- **RN-03 (updateProfile — SEGURANÇA, Vuln 1)** `updateProfile` grava **exclusivamente** campos de
  perfil (`name`, `cpf`, `phone`, `address`, `updatedAt`). **NUNCA** grava `role`. Nada no cliente
  deve permitir o usuário alterar o próprio `role` via este caminho.

- **RN-04 (regra do Firestore — SEGURANÇA, Vuln 1)** Endurecer `firestore.rules` para blindar o
  `role` contra auto-escalonamento:
  ```
  match /users/{uid} {
    allow read:   if request.auth != null && request.auth.uid == uid;
    allow create: if request.auth != null && request.auth.uid == uid;   // onboarding define role 1x
    allow update: if request.auth != null && request.auth.uid == uid
                  && request.resource.data.role == resource.data.role;  // role imutavel apos definido
    allow delete: if false;
  }
  ```
  Deploy via `firebase deploy --only firestore:rules`.

- **RN-05 (aba Perfil real e editável)** `PerfilTab` deixa de receber `MOCK_USER`; lê do `profile`
  do `useAuth()`. Modo visualização + botão "Editar perfil" abre formulário (nome, CPF, telefone,
  endereço) com máscaras básicas (CPF `000.000.000-00`, CEP `00000-000`, telefone `(00) 00000-0000`).
  **CPF validado por dígito verificador** (não só máscara): util puro `isValidCPF(cpf): boolean` em
  `lib/utils.ts` (algoritmo dos 2 dígitos verificadores; rejeita sequências repetidas como
  `111.111.111-11`). Salvar bloqueado com mensagem se o CPF for inválido. **Nome editável** (vem do
  Google como valor inicial; o usuário decide se muda). Salvar → `updateProfile` (persiste no
  Firestore) → toast. Enquanto vazio, exibe estado "Complete seu perfil". E-mail readonly.

- **RN-06 (trava de compra — decisão C)** No catálogo, `handleBuy`: se logado mas
  `!isProfileComplete(profile)` → `router.push('/minha-conta?tab=perfil&returnTo=/catalogo')`. A
  `/minha-conta` lê `tab=perfil` (abre a aba Perfil) e, havendo `returnTo`, mostra banner "Complete
  seu perfil (endereço, CPF e telefone) para finalizar a compra" com o formulário já em edição. Ao
  salvar com o perfil completo e `returnTo` presente, redireciona para `safeRedirect(returnTo)`. Se
  o perfil já estiver completo, o `BuyModal` abre normalmente, **usando `profile.address`** como
  "endereço do cadastro" (mantendo a opção "outro endereço").

- **RN-07 (sanitização de redirect — SEGURANÇA, Vuln 2)** Criar util único
  `safeRedirect(param): string` em `lib/utils.ts` (ou `lib/nav.ts`): retorna `param` apenas se
  começar com `/` e **não** com `//` e não contiver `:`; senão retorna `/minha-conta`. Usar em
  **ambos**: o roteamento pós-login (`login/page.tsx`) e o `returnTo` da trava de compra.

- **RN-08 (role imutável no cliente)** Onboarding continua definindo `role` uma única vez (create).
  Nenhuma tela permite trocar `role` depois (troca seria ação de suporte/admin, fora de escopo).

- **RN-09 (sacola do Header — OBS 1)** O ícone da sacola ganha um badge com o número de **pedidos
  ativos** (status != 'entregue' e != 'cancelado'), lido do `orders-context` (o Header está no
  layout `(main)`). Sem itens, sem badge. Atualiza ao comprar. Deslogado, mantém o comportamento
  atual (leva ao login).

## Componentes e fluxo de dados

- `AuthContext`: + `profile`, `updateProfile`, `isProfileComplete` (helper exportado).
- `PerfilTab`: consome `profile`; formulário → `updateProfile`.
- `/minha-conta` (page): lê `searchParams` (`tab`, `returnTo`) para abrir a aba Perfil + banner
  (precisa de boundary `Suspense` por causa do `useSearchParams`, como no login).
- `catalogo/page` `handleBuy`: checa `isProfileComplete`; usa `safeRedirect`.
- `BuyModal`: default de endereço passa a ser `profile.address` (não `MOCK_USER.address`).
- `Header`: badge de pedidos ativos via `useOrders()`.
- `firestore.rules`: regra endurecida (RN-04).
- `lib/utils.ts`: `safeRedirect`, `isProfileComplete` (ou co-localizado no auth-context).

## Critérios de aceite

- [ ] `users/{uid}` persiste cpf/phone/address; a aba Perfil mostra os dados reais do usuário logado (não Ana Lima)
- [ ] Editar perfil salva no Firestore e reflete após reload (persistência real)
- [ ] CPF inválido (dígito verificador, ou sequência repetida) bloqueia salvar; CPF válido passa
- [ ] "Comprar" com perfil incompleto → aba Perfil + banner; completar → volta ao catálogo; comprar usa o endereço real
- [ ] `updateProfile` não grava `role`; regra do Firestore rejeita alteração de `role` (testável no console: tentar mudar role via update falha)
- [ ] `redirect`/`returnTo` externos (`https://...`, `//host`) são ignorados (caem no default) — login e trava de compra
- [ ] Sacola do Header mostra contador de pedidos ativos, atualiza ao comprar
- [ ] `npm run lint` exit 0, `npm run build` passa; gating (013) e login (005a) não regridem

## Fora de escopo

- Pedidos permanecem em memória (orders-context) até o backend 006 — só o **perfil** vira persistido.
- Login por e-mail/senha (005b); endurecimento SSR dos guards (deploy/006); troca de `role`
  (suporte/admin); catálogo do fornecedor / cadastro de produtos (resto da 007).

## Referências

- Decisões: D-006, D-010, D-011, D-013 (`.claude/docs/decisoes.md`)
- Security-review 2026-07-03 (Vuln 1 role auto-gravável; Vuln 2 open redirect)
- Código: `auth-context.tsx`, `PerfilTab.tsx`, `account-mock.ts` (MOCK_USER a remover do fluxo),
  `BuyModal.tsx`, `catalogo/page.tsx`, `Header.tsx`, `firestore.rules`, `onboarding/page.tsx`
