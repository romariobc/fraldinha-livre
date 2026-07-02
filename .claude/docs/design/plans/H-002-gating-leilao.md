# H-002 — Gating do leilao reverso (feature 013) + remocao de codigo morto

**Executor:** sessao Haiku | **Autor:** sessao-mae (2026-07-02) | **Status:** aguardando execucao
**Spec:** `.claude/docs/design/specs/spec-plataforma-gating-leilao.md` (APROVADA 2026-07-02) — LEIA A SPEC INTEIRA ANTES DE COMECAR. Em caso de conflito entre este prompt e a spec, a spec vence; pare e relate.

## Objetivo

Implementar a feature 013: todos os pontos de contato do leilao reverso ficam visiveis porem
inativos ("Em breve"), controlados por UMA flag central, e o codigo morto do design antigo do
painel do fornecedor e removido. Ver decisoes D-003, D-007 em `.claude/docs/decisoes.md`.

## Contexto minimo

- App Next.js 16 App Router + React 19 + TypeScript + Tailwind em `front/` (rodar comandos dentro de `front/`).
- AGENTS.md do repo exige: leia os guias em `node_modules/next/dist/docs/` antes de escrever codigo Next e invoque os skills de dominio ao mexer em cada area (`domain-catalogo`, `domain-comprador`, `domain-fornecedor`, `ui-system`, `risk-zone-protocol` para `src/lib/`).
- NAO corrigir bugs do leilao (parsePriceToCents etc.) — ficam para a Fase 2. NAO adicionar logica de loja.

## Tarefas (nesta ordem)

1. Criar `front/src/lib/feature-flags.ts`:
   ```ts
   // Flag central da Fase 1 (D-007): leilao reverso visivel porem inativo.
   // Fase 2 (feature 008) liga esta flag e reativa todos os pontos gateados.
   export const LEILAO_ATIVO = false
   ```
2. Catalogo — `front/src/components/catalogo/ProductCard.tsx`: com `!LEILAO_ATIVO`, o botao "Pedir oferta →" fica `disabled` + `aria-disabled`, ganha badge "Em breve" e o handler nao executa nada (nem redirect de login). Visual mantido (opacidade reduzida ok).
3. Minha-conta — `front/src/components/minha-conta/PedidosTab.tsx`: botao "＋ Novo Pedido de Cotacao" idem (disabled + "Em breve").
4. Minha-conta — `front/src/components/minha-conta/OfertasTab.tsx`: botoes "✓ Aceitar" desativados com `!LEILAO_ATIVO` (tab e conteudo continuam visiveis, modo leitura — RN-04).
5. Painel — `front/src/app/(main)/fornecedor/painel/page.tsx` e `front/src/components/fornecedor/OfertasMercadoTab.tsx`: tab "Ofertas de Mercado" continua visivel em modo leitura; qualquer botao de acao de leilao dentro dela e desativado. Link "Ver Mercado" permanece ativo (leva a pagina "Em breve"). NAO tocar em PedidosDiretosTab nem LogisticaTab (sao loja/logistica — continuam 100% ativos).
6. Mercado — `front/src/app/(main)/mercado/page.tsx`: com `!LEILAO_ATIVO`, renderizar estado "Em breve" no lugar da tabela (titulo, 1-2 frases explicando o leilao reverso, CTA "Voltar ao catalogo" → `/catalogo`). Nao deletar os componentes do mercado; apenas condicionar a renderizacao (RN-03/RN-05).
7. Codigo morto (RN-06) — antes de deletar, rode grep confirmando que nenhum arquivo vivo importa; entao delete:
   - `front/src/components/fornecedor/MinhasOfertasTab.tsx`
   - `front/src/components/fornecedor/HistoricoTab.tsx`
   - `front/src/components/fornecedor/PerfilTab.tsx`
   - `front/src/components/fornecedor/OfertaCard.tsx`
   - `front/src/app/(main)/perfil/` (pasta inteira)
   - `front/src/lib/profile-mock.ts`
8. Commit unico (pt-BR):
   `feat(plataforma): gating do leilao reverso (visivel porem inativo) e remove codigo morto (feature 013)`

## Testes e verificacao (OBRIGATORIO — D-008)

Executar ANTES do relatorio, dentro de `front/`:

1. `npm run lint` — zero erros.
2. `npm run build` — build completo sem erro.
3. Grep: nenhuma referencia viva aos 6 itens deletados (imports quebrados = build falha, mas confirme por grep tambem).
4. Grep: `LEILAO_ATIVO` importado de `@/lib/feature-flags` em todos os pontos gateados; nenhuma outra flag local criada.
5. Teste manual rapido com `npm run dev`: /catalogo (botao "Em breve" inerte), /minha-conta (novo pedido e aceitar inertes, tabs visiveis), /fornecedor/painel (3 tabs ok, diretos e logistica funcionando), /mercado ("Em breve" + CTA volta ao catalogo), /perfil retorna 404.
6. Teste de reversibilidade (RN-05): mude `LEILAO_ATIVO = true`, confirme que /mercado volta a mostrar a tabela e os CTAs voltam a funcionar; retorne para `false` antes do commit.

**Loop de encerramento:** se algo falhar, corrija e re-verifique — MAXIMO 3 TENTATIVAS.
Apos a 3a falha: PARE. Nao improvise nem mude a abordagem. Relate o que falhou, o que tentou
em cada tentativa e o estado atual dos arquivos.

## Criterios de aceite

Use o checklist "Criterios de aceite" da spec (secao homonima) — todos os itens devem passar.

## Restricoes

- So os arquivos listados nas tarefas podem mudar (+ os deletados). Nada em `legacy/`, `back/`, `app/`, docs.
- Nenhuma decisao de arquitetura por conta propria; duvida = parar e relatar.
- Commits em pt-BR, Conventional Commits. Nao usar --no-verify.

## Relatorio esperado

Arquivos alterados/deletados; resultado de cada verificacao (1-6) com evidencia (saida resumida);
qualquer desvio da spec com justificativa; pendencias.
