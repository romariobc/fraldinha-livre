# H-006 — Remove codigo morto (fecha 013/RN-06) e conserta lint do MarketTable

**Executor:** sessao Haiku | **Autor:** sessao-mae (2026-07-02) | **Status:** PRONTO para disparo
**Spec:** `.claude/docs/design/specs/spec-plataforma-gating-leilao.md` (RN-06) — a parte de remocao de codigo morto ficou pendente no H-002.

## Objetivo

Deixar o branch VERDE (build + lint) e completar de fato a feature 013: (1) deletar o codigo morto
do design antigo que o H-002 nao removeu; (2) corrigir o erro de lint em MarketTable que faz
`npm run lint` sair com codigo 1.

## Contexto minimo

- Next.js 16 + React 19 + TS em `front/` (comandos no front do WORKTREE:
  `E:\Labdev\Projetos\fraldinha-livre\.claude\worktrees\eloquent-montalcini-2dff41\front`).
- AGENTS.md: leia `node_modules/next/dist/docs/` antes de codar Next; invoque risk-zone-protocol ao
  tocar src/lib/ e ui-system para UI.
- NAO regredir o gating (013) nem o auth (005a).

## Tarefas

1. **Deletar o codigo morto** (confirmar com grep que nao ha import vivo ANTES de cada delete):
   - `front/src/components/fornecedor/MinhasOfertasTab.tsx`
   - `front/src/components/fornecedor/HistoricoTab.tsx`
   - `front/src/components/fornecedor/PerfilTab.tsx`
   - `front/src/components/fornecedor/OfertaCard.tsx`
   - `front/src/lib/profile-mock.ts`
   - `front/src/app/(main)/perfil/` (pasta inteira — rota orfa)
   Observacao: MinhasOfertasTab importa OfertaCard; a rota /perfil importa profile-mock — sao um
   cluster morto entre si. Nenhuma pagina viva (painel usa PedidosDiretosTab/OfertasMercadoTab/
   LogisticaTab) os referencia. Se algum grep acusar import vivo inesperado, PARE e relate.
2. **Corrigir o lint de `front/src/components/mercado/MarketTable.tsx:34`** (`react-hooks/set-state-in-effect`).
   O useEffect atual reseta `visibleCount` e `expandedId` quando `scope` muda:
   ```
   useEffect(() => { setVisibleCount(INITIAL_COUNT); setExpandedId(null) }, [scope])
   ```
   Substitua o padrao "reset via setState em efeito" pela forma recomendada do React: **remontar o
   componente via `key`** quando o scope muda. Ou seja: no PAI (`front/src/app/(main)/mercado/page.tsx`),
   passe `key={JSON.stringify(scope)}` (ou uma string estavel derivada do scope) ao `<MarketTable ... />`,
   e remova o `useEffect` de reset do MarketTable (os `useState` passam a inicializar com INITIAL_COUNT/
   null a cada remontagem). Mantenha o resto do comportamento (infinite scroll, expandir linha) igual.
   Se preferir uma abordagem equivalente que tambem elimine o erro sem setState-in-effect, pode usar —
   mas NAO apenas silenciar o lint com disable-comment.
3. Commit unico (pt-BR): `refactor(plataforma): remove codigo morto do design antigo e corrige lint do MarketTable (feature 013)`

**Arquivos autorizados:** os 6 deletados + `front/src/components/mercado/MarketTable.tsx` +
`front/src/app/(main)/mercado/page.tsx` (para o key). Nada alem.

## Testes e verificacao (OBRIGATORIO — D-008)

No front do worktree:
1. `npm run build` — sucesso; a rota `/perfil` NAO deve mais aparecer na lista de rotas.
2. `npm run lint` — deve sair **sem erros** (os 2 warnings de `_orderId`/`_c` podem permanecer; o ERRO do MarketTable deve sumir). `npm run lint` precisa retornar exit 0.
3. Grep: 0 referencias aos 6 itens deletados.
4. Gating intacto: `/mercado` segue "Em breve" (com a flag off); auth (005a) intacto.

**Loop de encerramento:** falhou → corrigir e re-verificar, MAX 3 TENTATIVAS; apos a 3a, PARE e relate.

## Criterios de aceite

- [ ] 6 itens deletados; grep 0 referencias; /perfil fora das rotas do build
- [ ] `npm run lint` sai com exit 0 (sem o erro do MarketTable)
- [ ] `npm run build` passa; gating e auth intactos
- [ ] 1 commit pt-BR

## Restricoes

- So os arquivos autorizados; nada em legacy/back/app/docs; sem `--no-verify`; sem disable-comment de lint.
- Sem decisoes de arquitetura alem desta; duvida = parar e relatar.

## Relatorio esperado

Arquivos deletados/alterados; saida resumida de build e lint (com exit code do lint); confirmacao de
que /perfil sumiu das rotas; hash do commit; pendencias.
