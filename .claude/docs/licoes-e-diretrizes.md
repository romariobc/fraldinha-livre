# Licoes e Diretrizes — Fraldinha Livre

> Documento vivo, tematico. O historico cronologico esta em `chatsessions/`; as decisoes formais em
> `decisoes.md`; as regras de revisao em `review-checklist.md`. Aqui ficam o "porque" e o "como
> trabalhamos" — o que deu certo, o que deu errado, o que fazer e o que evitar. Atualizar sempre que
> uma sessao ensinar algo reutilizavel.
> Ultima atualizacao: 2026-07-02.

---

## 1. O que o projeto e (visao rapida)

Marketplace de fraldas com **duas fases** (D-007):
- **Fase 1 — Marketplace (loja):** catalogo, compra direta, contas, auth, pagamento. O leilao fica
  visivel porem inativo (flag `LEILAO_ATIVO`), para validar a loja antes.
- **Fase 2 — Mercado (leilao reverso):** fornecedores competem por pedidos; plugamos nos pontos ja
  marcados na Fase 1.

Stack: Next.js 16 + React 19 + TS + Tailwind (front/); backend futuro (back/) e app mobile (app/).
Infra: **Google Cloud / Firebase** (D-001, D-010). Frontend hoje sobre mocks; Firestore ja vivo para auth.

## 2. Como trabalhamos (o fluxo)

- **Sessao-mae (esta, Opus/Fable):** decide arquitetura, escreve specs e prompts, provisiona infra,
  revisa e aprova. **Nao codifica feature.**
- **Sessoes Haiku:** executam um prompt `H-NNN` por vez, testam (D-008) e relatam.
- **Ciclo:** spec aprovada → prompt H-NNN → Haiku executa → sessao-mae revisa pelo `review-checklist.md`
  (D-012) → aprovado/reenviado → estado atualizado (feature_list, progresso, chatsession) → commit.
- Documentar tudo, em pt-BR, porque a sessao-mae compacta com frequencia.

## 3. O que ja foi feito (2026-07-02)

- Analise + code-review do front (10 achados).
- Governanca criada: decisoes.md (D-001..D-012), specs/, plans/, chatsessions/, este doc.
- **H-001** (docs/infra Google Cloud) — aprovado.
- **H-002 / feature 013** (gating do leilao) — gating aprovado e validado; **remocao de codigo morto
  ficou pendente** (ver secao 5) → H-006.
- **H-005 / feature 005a** (login Google via Firebase + papel no Firestore) — aprovado e **validado
  pelo cliente no navegador**. Marco: primeiro auth real + primeiro backend vivo.
- Firebase provisionado (projeto fraldinha-livre, Firestore em SP, regra users/{uid}, Google Sign-In).

## 4. O que se pretende fazer (proximos passos)

Ordem D-011: **H-006** (limpeza p/ main) → **H-004 / 014** (compra direta multi-vendedor) →
**H-003** (bugs da loja: ?page, busca "todos", hydration) → **006** (backend da loja) →
**005b** (email/senha) → Fase 2 (008 leilao + os 4 bugs de negocio do review).

Decisoes ja tomadas que orientam: Modelo A multi-vendedor (D-009); precos em centavos; papel no
Firestore; endurecimento SSR do auth adiado para deploy/006.

## 5. O que deu certo / o que deu errado

### Deu certo
- **D-008 (loop de testes do Haiku) pegou um erro real:** o H-005 parou na Tarefa 0 quando o
  `.env.local` faltava no worktree — nenhum codigo errado foi escrito.
- **Trade-off antes de decidir stack de auth:** evitou construir em NextAuth e depois refazer; o
  cliente escolheu Firebase com os proprios criterios (D-001, app mobile, papel real).
- **Provisionar Firebase pelo conector (MCP)** em vez de setup manual — so o toggle final do Google
  ficou no console.
- **Reenvio ao Haiku via SendMessage** para o fix do onboarding: barato e manteve o contexto.

### Deu errado (e como pegamos)
- **H-002 nao removeu o codigo morto, mas o relatorio afirmou que sim.** A sessao-mae aprovou pelo
  relatorio. Pego so na verificacao pre-main (`npm run build` listou /perfil). → Origem do D-012 e
  do `review-checklist.md`.
- **`.env.local` escrito no front errado** (repo principal vs worktree). Worktrees nao compartilham
  arquivos gitignored. → memoria `worktree-env-local-gotcha`.
- **Criterios de aceite mal redigidos pela sessao-mae** ("lint passa" sem saber de erro preexistente;
  "0 mencoes em .claude/docs" conflitando com o proprio decisoes.md). → redigir criterios conferindo
  o estado real antes.

## 6. Fazer / Nao fazer (do/don't)

**FAZER**
- Revisar SEMPRE pelo `review-checklist.md`: `git show --stat`, rodar build+lint, conferir delecoes
  no commit (nao no relatorio), ler o diff dos arquivos-nucleo.
- Escrever `.env.local` e rodar `npm run dev`/`build` no `front/` do **worktree** ativo.
- Todo prompt Haiku com secao de testes + loop de 3 tentativas (D-008) e lista explicita de arquivos
  autorizados.
- Manter uma decisao por bloco em `decisoes.md`; quando algo muda, marcar a antiga como superada.
- Commits pequenos, descritivos, em pt-BR, com trailer Co-Authored-By.

**NAO FAZER**
- Nao aprovar entrega Haiku so pelo relatorio.
- Nao confiar que "deletei X" aconteceu sem `delete mode X` no commit.
- Nao deixar a sessao-mae codificar feature (so infra/config/governanca e revisao).
- Nao silenciar erro de lint com disable-comment; corrigir a causa.
- Nao introduzir dependencia proprietaria fora do Google Cloud/Firebase (D-001).
- Nao apresentar solucao stub como definitiva sem marcar a divida tecnica.

## 7. Dividas tecnicas conhecidas (rastrear ate fechar)

- **Codigo morto do design antigo do painel** (6 itens + rota /perfil) — fecha no H-006.
- **`MarketTable.tsx:34` setState-in-effect** (lint error) — fecha no H-006.
- **4 bugs de negocio do leilao** (parsePriceToCents milhar pt-BR; "Melhor preco" por indice;
  entrega por escopo de visualizacao; aceite sem fornecedor) — Fase 2 / feature 008.
- **Bugs da loja** (catalogo ?page nao sanitizado; busca "todos" ignorada; hydration dos mocks) — H-003.
- **Endurecimento SSR do auth** (session cookie via Admin SDK) — deploy/006.
- **formatPrice triplicado** → unico em lib/utils.ts — H-004 (feito).
- **Paginas "Em construcao" a finalizar (conteudo real):** `/privacidade` (Politica de Privacidade),
  `/termos` (Termos de Uso), `/como-funciona` (fluxo do fornecedor). Criadas no H-008 como placeholder
  para nao deixar link quebrado; conteudo real fica para depois do caminho feliz (decisao do cliente
  2026-07-03: "criar rapido o caminho feliz, detalhes depois"). Nao sao criticas ao sistema.
- **Landing "destaques" com precos hardcoded em reais** (`app/(main)/page.tsx` ~l.363, `product.price`
  em dados locais) — inconsistente com o catalogo em centavos; cosmetico, alinhar quando revisar a landing.
- **Link "Esqueci minha senha"** (`login/page.tsx`) aponta para `/como-funciona` (H-008 tirou o
  `href="#"`) — semanticamente errado; corrigir quando o reset de senha existir (005b email/senha).
- **`EmConstrucao.tsx` com cores genericas** (blue-600/gray) em vez dos tokens de marca
  (primary/brand-text/brand-muted) — alinhar ao design system numa passada de UI.
