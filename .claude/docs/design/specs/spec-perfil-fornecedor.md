# Spec — Perfil do Fornecedor (identidade real, Firestore)

**Domínio:** frontend/auth (Firestore) · **Feature relacionada:** 006/007 (fatia de identidade do
fornecedor, recorte pequeno dentro do escopo maior "Catálogo do fornecedor" da feature 007) ·
**Status:** proposta (brainstorming concluído, aguardando aprovação do plano de implementação)

## Contexto

Hoje o fornecedor logado não tem NENHUM perfil real. O painel (`fornecedor/painel/page.tsx`) e o
`useMarket()` (`market-context.tsx`) leem dados 100% mock e globais (`MOCK_SUPPLIER`,
`MOCK_DIRECT_ORDERS`, `MOCK_OFFERS`, todos de `supplier-mock.ts`), sem nenhuma ligação com o `uid`
Firebase do usuário autenticado. O catálogo (visão do comprador) usa uma lista estática separada
(`STORE_SUPPLIERS`, 4 fornecedores fixos `sup-001..sup-004`) só para exibir "vendido por X".

O comprador já tem perfil real desde a feature 007a: `users/{uid}` no Firestore com
`role`/`name`/`email`/`cpf`/`phone`/`address`, editável via `PerfilTab.tsx`
(`components/minha-conta/`), consumido de verdade no checkout (endereço da compra) e usado para
travar a compra até o perfil estar completo (`isProfileComplete`).

Esta fatia dá ao fornecedor o mesmo tipo de perfil real — mas **intencionalmente não resolve** a
ligação `uid` do fornecedor ↔ `supplierId` usado em `products`/`orders` (D1, threads B/P) nem filtra
os pedidos do painel por essa identidade. Essa ligação é o núcleo da feature 007 (`todo`,
"Catálogo do fornecedor... depende de 006") e fica fora de escopo aqui, por decisão consciente
(ver "Decisão de escopo" abaixo) — não por omissão.

### Decisão de escopo (brainstorming com o cliente, 2026-07-23)

- **Só identidade (Firestore), sem ligação com `supplierId`.** O perfil gravado em `users/{uid}`
  (CNPJ, razão social, nome fantasia, telefone, endereço) **não tem consumidor** em nenhum outro
  lugar do app nesta fatia: não filtra `directOrders`/`offers` do painel (continuam vindo de
  `MOCK_DIRECT_ORDERS`/`MOCK_OFFERS`, globais), não aparece no catálogo do comprador (que continua
  usando `STORE_SUPPLIERS`), não substitui `MOCK_SUPPLIER` (usado só na geolocalização do
  mercado/leilão, feature 008, bloqueada por D-014). **Isso é proposital, não um bug** — a amarração
  `uid↔supplierId` e o filtro real do painel ficam para a fatia "sync do painel do fornecedor"
  (feature 007), que não foi escolhida nesta rodada.
- **Sem campos de geolocalização.** `MOCK_SUPPLIER` tem estados/cidades/CEPs/bairro usados só pelo
  `geoMatch` do leilão (feature 008, bloqueada). O perfil novo não inclui esses campos — evita
  construir dado para uma feature blocked. Só 1 endereço único (mesmo formato do comprador).
  UFs de cobertura ficam mock até a 008 ser desbloqueada.
- **Razão social + nome fantasia (2 campos), não 1.** Mais fiel a uma pessoa jurídica real.
- **Sem trava/gate.** Ao contrário do comprador (perfil incompleto bloqueia "Comprar"), o painel do
  fornecedor não tem nenhuma ação real dependente do perfil ainda (tudo mock) — não há o que travar.
  Aba nova é só visualizar/editar, sem banner de aviso.

## Arquitetura

```
front/src/contexts/auth-context.tsx
  UserProfile ganha campos opcionais: cnpj?, razaoSocial?, nomeFantasia?
  (phone/address já existem e são reaproveitados, mesmo formato do comprador)
  updateProfile() já bloqueia escrita de `role` (D-013) — nenhuma mudança de lógica necessária

front/src/lib/utils.ts
  + isValidCNPJ(cnpj: string): boolean   (checksum mod-11, mesmo estilo de isValidCPF)
  (sem isFornecedorProfileComplete — não há gate nesta fatia)

front/src/components/fornecedor/PerfilTab.tsx   (NOVO)
  View + edição, mesmo padrão visual/estrutural do PerfilTab do comprador:
  - Visualização: razão social, nome fantasia, CNPJ (mascarado), telefone, endereço completo
  - Edição: inputs com máscara (CNPJ 00.000.000/0000-00, telefone, CEP), validação inline por
    campo, sem salvar parcial (mesma filosofia do handleSave do comprador)
  - SEM banner de perfil incompleto/trava (decisão de escopo acima)
  - Usa useAuth().profile / useAuth().updateProfile() — nenhuma mudança em auth-context além do tipo

front/src/app/(main)/fornecedor/painel/page.tsx
  + 4ª TabsTrigger "Perfil" (sem contador/badge, não há pendência a contar)
  + TabsContent renderiza <PerfilTab />

INTOCADOS nesta fatia:
  - back/ (D1, Workers, packages/contracts) — nenhuma mudança, perfil vive só no Firestore
  - firestore.rules — regra atual (role imutável + owner-only) já cobre campos novos sem whitelist
    de nomes, conferido no arquivo (match /users/{uid}, sem lista explícita de campos)
  - market-context.tsx — directOrders/offers continuam 100% mock/globais (ver Decisão de escopo)
  - supplier-mock.ts (MOCK_SUPPLIER) e suppliers.ts (STORE_SUPPLIERS) — inalterados
```

## Modelo de dados (Firestore, `users/{uid}`)

Extensão do documento existente (mesma coleção do comprador, discriminado por `role`):

```typescript
export interface UserProfile {
  role: UserRole; // 'comprador' | 'fornecedor' — imutável (D-013)
  name: string;
  email: string;
  cpf?: string;              // comprador
  cnpj?: string;              // NOVO — fornecedor
  razaoSocial?: string;       // NOVO — fornecedor
  nomeFantasia?: string;      // NOVO — fornecedor
  phone?: string;             // compartilhado (telefone pessoal OU comercial)
  address?: { ... };          // compartilhado (mesmo formato, endereço pessoal OU da empresa)
  createdAt?: string;
  updatedAt?: string;
}
```

Sem união discriminada por ora (YAGNI) — os campos novos são simplesmente opcionais, mesmo padrão
já usado para `cpf`/`address` no comprador. `role` já decide qual conjunto de campos a UI mostra.

## Validação

- `isValidCNPJ`: 14 dígitos, rejeita sequências repetidas (`00000000000000` etc.), 2 dígitos
  verificadores via checksum mod-11 (mesmo algoritmo padrão de CNPJ, análogo ao `isValidCPF` já
  existente).
- `handleSave` da aba nova exige: CNPJ válido, razão social preenchida, nome fantasia preenchido,
  telefone preenchido, endereço completo (logradouro/número/bairro/cidade/estado/cep) — erros
  inline por campo, sem salvar parcial. Mesma filosofia do comprador.

## Testes

- `front/src/components/fornecedor/__tests__/PerfilTab.test.tsx` (NOVO): visualização (campos
  mascarados/formatados), edição (máscaras de CNPJ/telefone/CEP), validação (CNPJ inválido bloqueia
  save, campos obrigatórios), salvar sucesso (toast + `updateProfile` chamado com patch correto,
  sem `role`), salvar erro (toast de erro, `console.error`).
- `front/src/lib/__tests__/utils.test.ts` (se existir) ou novo arquivo: `isValidCNPJ` (válido,
  inválido, sequência repetida, tamanho errado).
- Nenhum teste de `painel/page.tsx` existe hoje (confirmado — pasta sem `__tests__`); não há teste
  a ajustar, só o novo cobre a 4ª aba indiretamente via `PerfilTab.test.tsx`.

## Critérios de aceite

- [ ] `UserProfile` (`auth-context.tsx`) com `cnpj?`/`razaoSocial?`/`nomeFantasia?` opcionais.
- [ ] `isValidCNPJ` em `utils.ts`, testado.
- [ ] `PerfilTab.tsx` novo em `components/fornecedor/`, testado (view + edição + validação + save).
- [ ] Aba "Perfil" no painel do fornecedor (4ª aba, sem contador).
- [ ] `back/`, `packages/contracts`, `firestore.rules`, `market-context.tsx`, `supplier-mock.ts`,
      `suppliers.ts` **inalterados**.
- [ ] Suíte do `front/` verde (testes existentes + novos), `tsc`/`lint` exit 0.
- [ ] Nota de escopo registrada em `progresso.md`/`feature_list.json`: perfil gravado não tem
      consumidor ainda nesta fatia — amarração `uid↔supplierId` fica para a feature 007.
- [ ] Validação humana no navegador: logar como fornecedor, preencher/editar perfil, salvar,
      recarregar (F5) e confirmar que persiste — SEM esperar que apareça em nenhuma outra aba.

## Fora de escopo (registrado, não é esquecimento)

- **Ligação `uid↔supplierId`** e filtro real de `directOrders`/`offers` por fornecedor — feature 007.
- **Campos de geolocalização** (estados/cidades/CEPs de atendimento) — só fazem sentido quando a
  feature 008 (leilão/mercado, microserviço) for desbloqueada.
- **Substituir `STORE_SUPPLIERS`** no catálogo do comprador (nome do fornecedor que aparece em
  "vendido por X") — depende da mesma amarração acima, feature 007.
- **Migração de `MOCK_SUPPLIER`** — continua alimentando o `geoMatch` do mercado (feature 008,
  bloqueada); não é substituído por este perfil novo.

## Riscos

| Risco | Mitigação |
|---|---|
| Cliente testa no navegador, salva o perfil, e estranha por não ver reflexo em nenhum outro lugar | Mitigado por documentação explícita (este spec + progresso.md) e por avisar durante a validação humana que isso é esperado nesta fatia |
| `PerfilTab.tsx` do fornecedor divergir visualmente do padrão do comprador (inconsistência de UX) | Reusar a mesma estrutura/classes do `PerfilTab.tsx` do comprador como referência direta |

## Referências

- Padrão a seguir: `front/src/components/minha-conta/PerfilTab.tsx`, `front/src/lib/utils.ts`
  (`isValidCPF`, `isProfileComplete`).
- Schema atual: `front/src/contexts/auth-context.tsx` (`UserProfile`).
- Regra de segurança: `firestore.rules` (D-013, role imutável).
- Dados hoje 100% mock: `front/src/lib/supplier-mock.ts` (`MOCK_SUPPLIER`, `MOCK_DIRECT_ORDERS`,
  `MOCK_OFFERS`), `front/src/lib/suppliers.ts` (`STORE_SUPPLIERS`), `front/src/contexts/market-context.tsx`.
- Feature relacionada (fora de escopo): `.claude/context/estado/feature_list.json` (feature 007).
