# Progresso — fraldinha-livre

## Ultima sessao

**Data:** 2026-07-02
**O que foi feito:** Sessao de analise + code-review completo do front/src (sem alteracao de codigo).
- Review de recall alto: 10 achados confirmados (4 de dinheiro/logica de negocio, 5 de correcao geral, 1 de codigo morto) — relatorio entregue no chat
- Top-3: parsePriceToCents quebra com separador de milhar pt-BR (market-utils.ts:4); selo "Melhor preco" por indice e nao por preco (OfertasTab.tsx:52); endereco alternativo sem validacao de cidade/UF (NovoPedidoModal.tsx:83)
- Divergencias de governanca detectadas: .claude/docs/design/specs/ e plans/ NAO existem (spec-driven exige); feature 004 marcada done mas painel tem 3 tabs (criterio pede 5); historico git com ~15 commits identicos "refactor: remove public/ raiz"

**Estado atual:** Frontend avancado, sem backend. Branch de trabalho identico ao main (diff vazio).

**Decisoes registradas (mesma sessao):** D-001 infra Google Cloud definitiva (excluir mencoes a alternativas); D-002 specs em .claude/docs/design/specs/ com backup no harness; D-004 historico git mantido; D-005 caminho canonico E:\Labdev\Projetos\fraldinha-livre (front/ back/ app/); D-006 papeis (sessao-mae documenta/revisa, Haiku codifica via prompts em plans/). Ver .claude/docs/decisoes.md. Criados: decisoes.md, design/specs/README.md (template), design/plans/H-001-limpeza-docs-infra.md, chatsessions/2026-07-02-sessao-01.

**Atualizacao (mesma data):** Estrategia em DUAS FASES definida (D-007): Fase 1 = MARKETPLACE (loja validada; leilao visivel porem inativo via flag central), Fase 2 = MERCADO (leilao reverso plugando os pontos gateados). D-008: prompts Haiku com testes obrigatorios + loop de 3 tentativas antes do relatorio. D-003 superada por D-007. feature_list.json reorganizado com campo 'fase' + features 013 (gating) e 014 (compra direta, BLOQUEADA por D-009). Spec do gating escrita (specs/spec-plataforma-gating-leilao.md, rascunho). Descoberta: catalogo nao tem fluxo de compra direta — so 'Pedir oferta' (leilao).

**Progresso de execucao (2026-07-02):** H-001 APROVADO (027edaf). H-002/feature 013 (gating do leilao + codigo morto) executado no Haiku (commit 61396e0), REVISADO e APROVADO pela sessao-mae — feature 013 = done. Specs 013, 005a e 014 todas aprovadas.

**Proximo passo:** Auth = **Firebase Authentication** (D-010 revisada). Firebase PROVISIONADO em 2026-07-02 (conta romariobc@gmail.com, projeto fraldinha-livre): app web + config em front/.env.local; Firestore em southamerica-east1 com regra users/{uid} ativa; Google Sign-In configurado; infra commitada (4bd4dba). Falta so o cliente confirmar o toggle do provedor Google no console (Firebase Auth > Sign-in method) e entao disparar o H-005. Fila D-011: 013 done → 005a (Firebase) → 014 → H-003 → 006.

**Divida tecnica registrada:** lint preexistente MarketTable.tsx:34 (setState em efeito) — na fila da feature 008 (Fase 2, arquivo de leilao ja gateado).

**Decisoes pendentes de ADR:** nenhuma. Costura de role da 005a e stub ate o 006 (D-011).

**Decisoes registradas (2026-07-02 apos H-001):** D-009 DECIDIDA: Modelo A (multi-vendedor, cada produto vinculado a fornecedor com preco proprio). Spec do gating (feature 013) APROVADA.

**Decisoes pendentes de ADR:** nenhuma no momento (apos H-001 e D-009).

---

## Sessoes anteriores

**Data:** 2026-06-22
**O que foi feito:** Bootstrap cirurgico do harness dev_flow_create_harness.
- context/estado/feature_list.json criado — features 001-004 marcadas como done, 005-012 como todo
- context/estado/progresso.md criado (este arquivo)
- CLAUDE.md atualizado com referencia ao ciclo de sessao do harness

**Estado atual:** Frontend avancado, sem backend. Todas as paginas principais implementadas com dados mock.

**Proximo passo:** Definir se a feature 005 (auth) ou 006 (backend) entra primeiro — auth e pre-requisito para backend seguro, mas backend pode comecar com rotas publicas.

**Decisoes pendentes de ADR:** nenhuma (infra decidida em D-001: Google Cloud).

---

_Formato: Data | O que foi feito | Proximo passo | Decisoes pendentes_
_A LLM preenche esta secao ao encerrar cada sessao antes de commitar._
