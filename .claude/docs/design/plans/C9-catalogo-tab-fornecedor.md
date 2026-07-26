# C9 — front/: `CatalogoTab.tsx` no painel do fornecedor

**Executor:** sessão Haiku | **Autor:** sessão-mãe/frontend (2026-07-26) | **Status:** aguardando execução
**Spec:** `.claude/docs/design/specs/spec-catalogo-fornecedor-produtos.md` (APROVADA) — tarefa C9 de
`.claude/docs/design/plans/C-catalogo-fornecedor-breakdown.md` (dependência: C7, commit `1543b08`,
APROVADO 2026-07-26 via D-012).

**Nota de coordenação:** a tarefa C8 (migração de `/catalogo`/`/produto/[slug]`) também depende de C7
e pode estar rodando ao mesmo tempo — **não conflita** com esta tarefa (arquivos completamente
diferentes: C8 toca `app/(main)/catalogo/`, `app/(main)/produto/`, `products.ts`, `ProductCard.tsx`,
`layout.tsx`; esta tarefa toca só `components/fornecedor/` e `fornecedor/painel/page.tsx`). Pode
prosseguir sem esperar C8, mas confirmar `git log --oneline -3` antes do commit final por segurança
(mesmo cuidado geral do worktree).

## Skills obrigatórias (AGENTS.md deste repo)

Antes de tocar em qualquer arquivo, invocar `Skill(domain-fornecedor)` (esta tarefa toca
`src/components/fornecedor/` e `src/app/(main)/fornecedor/`) e `Skill(ui-system)` (é trabalho de
UI/componente). Se as skills não existirem/não carregarem no seu ambiente, registrar isso no
relatório e seguir pelo prompt normalmente — não é motivo de bloqueio.

## Objetivo

Dar ao fornecedor autenticado uma aba no próprio painel pra gerenciar o catálogo: listar os próprios
produtos (ativos e despublicados), criar, editar, despublicar/republicar, e excluir de verdade
(com confirmação, mesmo padrão de cancelamento de pedido, D-025).

## Contexto mínimo

- **Ler antes de escrever:** `front/src/components/fornecedor/PerfilTab.tsx` (estrutura geral de aba
  do painel — visualização vs formulário de edição, `useState` local, `toast` de sucesso/erro) e
  `front/src/components/minha-conta/OrderCard.tsx` (padrão exato do `Dialog` de confirmação
  destrutiva, D-025 — `Dialog`/`DialogContent`/`DialogHeader`/`DialogTitle`/`DialogDescription`/
  `DialogFooter`/`DialogClose`/`Button` de `@/components/ui/*`).
- **`ProductRepository`/`useProducts` não servem aqui.** `useProducts` (C8, se já existir; se não,
  não depender dela) é pro catálogo PÚBLICO (`list()`, sem auth). Esta tarefa precisa de
  `listForSupplier()`/`create()`/`update()`/`remove()` — que exigem o `uid` do fornecedor logado. Sem
  um provider pronto pra isso ainda (não existe `SupplierProductsProvider`), a solução mais simples e
  isolada: instanciar o repositório **direto no componente**, com o `uid` de `useAuth()`:
  ```ts
  const { user } = useAuth()
  const useBackend = process.env.NEXT_PUBLIC_USE_BACKEND === 'true'
  const repo: ProductRepository = useMemo(() => {
    if (useBackend) return new HttpProductRepository()
    return new MockProductRepository({
      supplierId: user?.uid ?? '',
      idFactory: () => crypto.randomUUID(),
    })
  }, [useBackend, user?.uid])
  ```
  Isso é uma decisão de escopo mínimo pra esta tarefa — se no futuro (fora desta thread) fizer sentido
  um provider dedicado, isso é refactor posterior, não redecidir agora.
- Contrato: `CreateProductRequest`/`UpdateProductRequest`/`Product` de `@contracts` (C1). Campos do
  formulário: nome, marca, tamanho, quantidade, preço (em REAIS na UI, convertido pra centavos antes
  de enviar — `priceCents = Math.round(precoReais * 100)`, nunca float direto), categoria, descrição,
  atributos (faixaPeso/genero/absorcao/tecnologia), badge (opcional), slug (**obrigatório no body** —
  gerar automaticamente a partir do nome nesta tela, mesmo padrão comum de slugify: minúsculas, sem
  acento, espaços→hífen; não expor campo de slug editável no formulário — decisão desta tarefa, já
  que o backend (C4) não gera slug e o usuário não deveria digitar um manualmente).
- Autorização por dono já é garantida pelo backend (C4) — esta tela só lista os produtos que
  `listForSupplier()` retorna (já filtrados pelo uid do token), não precisa reimplementar checagem.

## Passo 0 — OBRIGATÓRIO antes de qualquer arquivo

```
git rev-parse --show-toplevel
```
Confirmar worktree correto. Depois `git log --oneline -3` confirmando que `1543b08` (C7) está no
histórico.

## Tarefas (nesta ordem)

### 1. Criar `front/src/components/fornecedor/CatalogoTab.tsx`
Estrutura (mesmo espírito de `PerfilTab.tsx` — visualização por padrão, formulário quando
criando/editando):
- **Estado:** lista de produtos do fornecedor (`listForSupplier()`, carregado no mount via
  `useEffect`, com `loading`/`error` explícitos — nunca falha silenciosamente), produto em edição
  (`null` = nenhum, ou o objeto sendo editado), modo "criando novo" (formulário vazio).
- **Lista:** cada produto mostra nome, marca, tamanho, preço formatado, badge visual de
  "Ativo"/"Despublicado" (indicação visual clara do estado, cor diferente), botão "Editar" (abre
  formulário preenchido), botão "Despublicar"/"Republicar" (chama `update(id, { active: !atual })`,
  `toast` de sucesso/erro), botão "Excluir" (abre o `Dialog` de confirmação, mesmo padrão de
  `OrderCard.tsx`).
- **Formulário (criar/editar):** campos nome/marca/tamanho/quantidade/preço(reais)/categoria/
  descrição/atributos(4 campos)/badge(opcional). Validação client-side simples (campos obrigatórios
  vazios bloqueiam o submit, mesmo espírito de `PerfilTab.handleSave`) — a validação de verdade é do
  Zod no backend (C1/C4), esta é só UX, não precisa duplicar toda a lógica do schema.
  - Criar: `create()` com slug gerado do nome; após sucesso, volta pra lista, produto novo aparece.
  - Editar: `update(id, req)` só com os campos do formulário (não reenviar `active`, que é só
    manipulado pelos botões despublicar/republicar/lista, não pelo formulário de edição).
- **Excluir:** `Dialog` de confirmação explicitando que é definitivo (texto: algo como "Esta ação
  não pode ser desfeita" — mesmo tom de `OrderCard.tsx`), só chama `remove(id)` na confirmação.

### 2. Modificar `front/src/app/(main)/fornecedor/painel/page.tsx`
Adicionar a aba nova, mesmo padrão de wiring das abas existentes (`Pedidos Diretos`/`Ofertas de
Mercado`/`Logística`/`Perfil`):
- `type TabKey` ganha `'catalogo'`.
- Import de `CatalogoTab`.
- Novo `TabsTrigger value="catalogo"` (escolher um emoji/label consistente com o estilo dos outros,
  ex. `📦 Catálogo` — critério estético, decidir e documentar).
- Novo `TabsContent value="catalogo"` renderizando `<CatalogoTab />`.
- **Não mudar mais nada** nesta página (guard de auth, contadores do hero, outras abas continuam
  exatamente como estão).

### 3. Criar `front/src/components/fornecedor/__tests__/CatalogoTab.test.tsx`
Mesmo padrão de mocks de outros testes de componentes do painel (`useAuth`, e o repositório —
mockar `@/lib/adapters/mock-product-repository` e/ou `@/lib/adapters/http-product-repository`
conforme a implementação real do componente, ou mockar o módulo inteiro se mais simples). Casos:
- Lista carrega e mostra os produtos do fornecedor (mock com 2-3 produtos, incluindo 1 despublicado
  com indicação visual diferente).
- Criar produto: preencher formulário, submeter, produto aparece na lista.
- Despublicar: clicar no botão, produto muda de estado visual (ativo→despublicado).
- Excluir: clicar, confirmar no dialog, produto desaparece da lista.
- Formulário rejeita submit com campos obrigatórios vazios (não chama `create()`).

## Testes e verificação (OBRIGATÓRIO — D-008)

Executar ANTES do relatório, nesta ordem:
1. `cd front && npm test` — suíte inteira verde (≥325 preexistentes + os novos).
2. `cd front && npx tsc --noEmit` — exit 0.
3. `cd front && npm run lint` — exit 0 (warning preexistente tolerável).
4. Confirmar que nenhuma outra aba do painel (`PedidosDiretosTab`, `OfertasMercadoTab`,
   `LogisticaTab`, `PerfilTab`) foi modificada.

**Loop de encerramento:** se algo falhar, corrigir e re-verificar. MÁXIMO 3 TENTATIVAS. Após a 3ª
falha: PARE. Não improvise. Relate o que falhou, o que tentou e o estado atual.

## Critérios de aceite

- [ ] `CatalogoTab.tsx` lista produtos do fornecedor (ativos e despublicados, indicação visual
      clara), com criar/editar/despublicar-republicar/excluir funcionando.
- [ ] Slug gerado automaticamente do nome, nunca exposto como campo editável.
- [ ] Preço convertido de reais (UI) pra centavos (`priceCents`) antes de enviar, sem float.
- [ ] Exclusão passa por `Dialog` de confirmação (mesmo padrão D-025 de `OrderCard.tsx`).
- [ ] Aba nova wireada no painel, mesmo padrão das existentes.
- [ ] `npm test`/`tsc`/`lint` em `front/` — exit 0.
- [ ] Nenhuma outra aba do painel modificada.

## Restrições

- **Não** criar um provider novo tipo `SupplierProductsProvider` — instanciar o repositório direto
  no componente, como especificado no contexto (decisão de escopo mínimo desta tarefa).
- **Não** tocar em `PedidosDiretosTab.tsx`, `OfertasMercadoTab.tsx`, `LogisticaTab.tsx` — só
  `PerfilTab.tsx` é lido como referência, não modificado.
- **Não** usar `any`. **Não** importar `zod` direto.
- **Não** decidir arquitetura além do especificado — se algo parecer exigir decisão nova, PARE e
  relate.
- Commits em português, Conventional Commits.
- Ao final, criar **um único commit** com:
  `feat(front): CatalogoTab no painel do fornecedor (CRUD de produtos, thread C)`

## Relatório esperado

- Lista de arquivos criados/modificados.
- Saída literal dos 4 itens de verificação.
- Hash do commit criado.
- Decisões de detalhe tomadas dentro do permitido (ex.: emoji/label da aba, algoritmo exato de
  slugify), e qualquer bloqueio.
