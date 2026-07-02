# Spec — Gating do leilao reverso (visivel porem inativo)

**Dominio:** plataforma | **Feature relacionada:** 013 | **Status:** APROVADA (cliente, 2026-07-02)

## Contexto

Decisao D-007: a Fase 1 valida o MARKETPLACE (loja) antes do leilao. Todos os pontos de
contato do leilao reverso permanecem visiveis na UI — para o usuario enxergar o produto
completo e para o time ja saber exatamente o que plugar na Fase 2 — porem inativos.
Aproveita-se a mesma entrega para remover o codigo morto do design antigo do painel (D-003).

## Regras de negocio

- **RN-01** Existe uma flag central unica em `front/src/lib/feature-flags.ts`: `export const LEILAO_ATIVO = false`. Nenhum componente hardcoda o estado do leilao por conta propria (licao do bug Header/IS_LOGGED_IN).
- **RN-02** Todo CTA de leilao com `LEILAO_ATIVO=false`: permanece renderizado, ganha badge "Em breve", fica `disabled` (sem handler executando acao) e com `aria-disabled` + tooltip/descricao curta ("O leilao reverso chega em breve").
- **RN-03** A pagina `/mercado` continua roteavel (nao 404): exibe um estado "Em breve" com explicacao do leilao reverso e CTA de volta ao catalogo. A tabela/fluxo real so renderiza com a flag ligada.
- **RN-04** Informacoes de leitura relacionadas a leilao (ex.: pedidos tipo cotacao ja existentes nos mocks, ofertas recebidas) continuam VISIVEIS, mas toda acao sobre elas (aceitar oferta, criar cotacao, enviar oferta, "nao concorro") e desativada conforme RN-02.
- **RN-05** Ligar `LEILAO_ATIVO = true` restaura 100% do comportamento atual sem nenhuma outra mudanca de codigo (criterio central da Fase 2).
- **RN-06** Codigo morto do design antigo e removido nesta mesma entrega: `front/src/components/fornecedor/MinhasOfertasTab.tsx`, `front/src/components/fornecedor/HistoricoTab.tsx`, `front/src/components/fornecedor/PerfilTab.tsx`, `front/src/components/fornecedor/OfertaCard.tsx`, rota `front/src/app/(main)/perfil/` e `front/src/lib/profile-mock.ts` (verificar antes que nenhum import vivo os referencia).

## Inventario dos pontos de contato do leilao (mapeado no review de 2026-07-02)

| # | Local | Elemento | Acao na Fase 1 |
|---|---|---|---|
| 1 | Catalogo — `ProductCard.tsx:60-66` | Botao "Pedir oferta →" | Badge "Em breve" + disabled (RN-02) |
| 2 | Catalogo — `OfferModal.tsx` | Modal de pedido de oferta | Nunca abre com flag off (CTA #1 desativado) |
| 3 | Minha-conta — `PedidosTab.tsx:19-24` | Botao "＋ Novo Pedido de Cotacao" | Badge "Em breve" + disabled |
| 4 | Minha-conta — `page.tsx` | Tab "Ofertas" + badge contador + card "Ofertas" do hero | Tab visivel; conteudo em modo leitura; botoes "Aceitar" desativados (RN-04) |
| 5 | Minha-conta — `OrderCard.tsx` (mode pedidos) | CTA "Ver ofertas" de pedidos cotacao | Mantem navegacao para a tab (leitura), sem acoes |
| 6 | Painel fornecedor — `painel/page.tsx:54-84` | Contador "Ofertas", tab "Ofertas de Mercado", link "Ver Mercado" | Visiveis; tab em modo leitura; link leva ao /mercado "Em breve" |
| 7 | Pagina `/mercado` inteira | GeoScopeSelector, MarketTable, InlineOfferForm | Pagina "Em breve" (RN-03) |
| 8 | `NovoPedidoModal.tsx` | Criacao de cotacao | Nunca abre com flag off (CTA #3 desativado) |

## Criterios de aceite

- [ ] `front/src/lib/feature-flags.ts` existe com `LEILAO_ATIVO = false` e e a UNICA fonte do estado
- [ ] Com a flag off: nenhum clique em qualquer item do inventario dispara acao de leilao (modal, criacao, aceite, envio, recusa)
- [ ] Todos os 8 pontos do inventario continuam visiveis com o tratamento definido
- [ ] `/mercado` renderiza a pagina "Em breve" sem erro e sem 404
- [ ] Com `LEILAO_ATIVO = true` (teste manual): comportamento atual integralmente restaurado
- [ ] Arquivos da RN-06 deletados; `npm run build` e `npm run lint` passam
- [ ] Nenhuma alteracao fora do escopo (nada de logica nova de loja, nada de correcao de bugs do leilao — ficam para a Fase 2)

## Fora de escopo

- Logica do leilao reverso (feature 008, Fase 2)
- Compra direta no catalogo (feature 014 — bloqueada pela D-009)
- Correcao dos 4 bugs de negocio do leilao apontados no review (entram na Fase 2 com a 008)

## Referencias

- Decisoes: D-003, D-006, D-007, D-008 (`.claude/docs/decisoes.md`)
- Review 2026-07-02 (`chatsessions/2026-07-02-sessao-01-analise-review-decisoes.md`)
- Codigo: `front/src/lib/auth-mock.ts` (padrao de flag a NAO repetir — ver bug Header.tsx:21)
