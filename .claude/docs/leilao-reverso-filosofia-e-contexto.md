# Leilão Reverso — Filosofia e Contexto

> **Propósito deste documento.** Semente para o *discovery* do leilão reverso da Fraldinha Livre.
> Ele estabelece a **filosofia** (por que existe) e o **contexto** (onde se encaixa no projeto), e
> aponta as **dimensões a explorar** (práticas, segurança, arquitetura, fluxos, histórias de usuário).
> **Não é um projeto de implementação** — o design detalhado do microserviço acontece no seu discovery
> (chat, diagramas, histórias). Ver decisão **D-014**: o leilão é um **microserviço separado**; aqui
> (Claude Code, marketplace) tratamos apenas da **INTEGRAÇÃO** com ele. O foco desta base é o
> marketplace de ponta a ponta (UX, fluidez, responsividade).

---

## 1. A filosofia: o que é um leilão reverso

No leilão tradicional, **vários compradores** disputam **um item** e o preço **sobe**. O leilão
**reverso inverte** isso: **um comprador** publica uma **necessidade** (um pedido de cotação) e
**vários fornecedores competem para atendê-la**, o preço tende a **cair** e as condições (prazo,
entrega) melhoram. Quem "ganha" é quem oferece a melhor combinação de **preço + prazo + confiança**,
segundo o critério do comprador.

**A promessa de valor:**
- **Para o comprador** (clínicas, creches, revendedores, famílias): em vez de caçar preço fornecedor
  a fornecedor, ele publica uma vez e **recebe a concorrência trabalhando a seu favor** — mais
  economia, menos esforço, comparação lado a lado.
- **Para o fornecedor** (distribuidores): acesso a **demanda qualificada e recorrente** sem
  prospecção ativa; disputa por mérito (preço/prazo/reputação), não por quem liga primeiro.
- **Para a plataforma:** um mecanismo que gera **liquidez** (pedidos ↔ ofertas) e um dado valioso
  (curva de preços real do mercado de fraldas).

**Princípio-guia:** o leilão reverso existe para **transferir poder de barganha ao comprador** de
forma justa e transparente, mantendo o fornecedor com margem para competir. Um bom design equilibra
os dois lados — se sufocar o fornecedor, ele abandona; se favorecê-lo demais, o comprador não ganha.

---

## 2. Por que faz sentido para a Fraldinha Livre

Fralda é um item de **compra recorrente, alto volume e baixa diferenciação** — condições ideais para
concorrência por preço/prazo. O comprador institucional compra sempre; o fornecedor quer previsão de
demanda. O leilão reverso encaixa nessa recorrência: cada ciclo de compra vira uma disputa curta que
melhora o preço e fideliza pela experiência (ver *pedidos preferenciais*, feature 009).

---

## 3. Posição arquitetural (D-014)

O leilão **não** é um módulo interno do marketplace. É um **microserviço standalone**, com API
própria, projetado para ser **consumido pela Fraldinha Livre e por outros produtos** (é um ativo
reusável — o "motor de leilão reverso" como produto em si).

- **Gate (D-014):** só evoluímos para o leilão **depois** que o marketplace (front **e** back)
  estiver completo e **testado** (segurança, usabilidade, stress, e2e).
- **Fronteira:** o marketplace **consome** o leilão via contrato/API. Os pontos de contato já
  existem na UI, **visíveis porém inativos** (feature 013, flag `LEILAO_ATIVO`) — são exatamente os
  lugares onde o marketplace vai **plugar** o microserviço.
- **Reusabilidade:** o microserviço não deve saber que é "fralda". Ele lida com *pedidos de cotação*
  e *ofertas* genéricos; o marketplace traduz seu domínio para esse contrato.

---

## 4. Conceitos-chave (glossário de domínio)

Ancorados no que o mock do marketplace já expressa (`src/lib/supplier-mock.ts`, `market-utils.ts`) —
úteis como ponto de partida do discovery, **não** como contrato final:

- **Pedido de cotação (`MarketOrder`/`Order` tipo cotação):** a necessidade publicada pelo comprador
  (produto, quantidade, unidade, endereço/escopo, prazo desejado).
- **Oferta (`SupplierOffer`):** a resposta de um fornecedor (preço, modalidade de entrega, nota).
- **Janela / prazo:** o tempo em que o pedido fica aberto a ofertas. (Hoje inexistente — ponto de
  discovery: duração, extensão anti-sniping, expiração.)
- **Lote (`batch`):** rodadas de ofertas dentro de um pedido (o mock referencia "lote 1").
- **Escopo geográfico (`GeoScope`):** bairro / raio / cidade / nacional — quem é **elegível** a
  ofertar num pedido.
- **Modalidade de entrega (`DeliveryType`):** delivery local (horas) vs dias úteis vs a combinar.
- **Aceite:** o comprador escolhe uma oferta → pedido confirmado.
- **"Não concorro":** o fornecedor descarta um pedido da sua fila (hoje só local; deveria persistir).
- **Status:** aberto / ofertado / encerrado (pedido); enviada / aceita / recusada / expirada (oferta).

---

## 5. A fronteira de integração (o foco DAQUI)

O que o **marketplace** precisa fazer para consumir o leilão — os **pontos de contato já mapeados**
(gated na feature 013). Este é o material que evoluímos nesta base; o resto é discovery.

**O marketplace ENVIA ao leilão (comandos):**
- Criar pedido de cotação (a partir de "Novo Pedido de Cotação" / catálogo).
- Fornecedor enviar oferta; fornecedor recusar ("Não concorro").
- Comprador aceitar uma oferta.

**O marketplace RECEBE do leilão (consultas/eventos):**
- Pedidos elegíveis para um fornecedor (por escopo geográfico).
- Ofertas de um pedido (para o comprador comparar).
- Notificações/eventos: nova oferta, oferta aceita, pedido expirado.

**Pontos de UI que serão reativados** (inventário da spec de gating): botão "Pedir oferta"
(catálogo), "Novo Pedido de Cotação" e aba/aceite de Ofertas (minha-conta), aba "Ofertas de Mercado"
e página `/mercado` (fornecedor). A flag `LEILAO_ATIVO` passa a significar "microserviço plugado".

> **Contrato é conceitual aqui.** A forma real (REST/gRPC/eventos, payloads, auth entre serviços)
> sai do seu discovery — mas o marketplace deve tratá-lo como **dependência externa**, com timeouts,
> retries e degradação graciosa (se o leilão cair, a loja continua vendendo por compra direta).

---

## 6. Dimensões para o discovery (o que estudar no chat)

Um roteiro aberto para o seu aprofundamento — cada item vira spec/diagrama/decisão no seu processo:

**a) Práticas de desenho de leilão (auction design)**
- Ofertas **abertas** (todos veem os lances) vs **seladas** (cada fornecedor só vê o próprio)? Misto?
- **Anti-sniping:** estender o prazo se chega oferta nos últimos segundos?
- Critério de vitória: só preço, ou score (preço + prazo + reputação)? Quem decide, comprador ou regra?
- Empates, lances mínimos, número de rodadas, revisão de oferta.

**b) Segurança e integridade** (crítico — é dinheiro e concorrência)
- **Concorrência:** locks/idempotência ao aceitar/ofertar (evitar aceite duplo, corrida de ofertas).
- **Autenticidade/integridade** das ofertas (não adulterável; trilha de auditoria).
- **Anti-fraude/conluio:** shill bidding, fornecedores combinados, comprador fantasma.
- **Autorização entre serviços** (o marketplace prova identidade ao leilão; papéis).
- Rate limiting, replay, e privacidade (quem vê o quê — dados do comprador/fornecedor).

**c) Arquitetura**
- Síncrono vs **assíncrono** (fila/eventos) — o mock já sugere filas "pedidos"/"ofertas".
- **Tempo real** para o comprador/fornecedor (websocket/SSE/push) vs polling.
- Consistência, idempotência, reprocessamento, dead-letter; observabilidade (métricas do leilão).
- Multi-tenant (para ser reusável por outros produtos): isolamento por cliente/produto.

**d) Fluxos e ciclo de vida**
- Máquina de estados do **pedido** e da **oferta** (com timeouts, expiração, cancelamento).
- O que acontece sem ofertas? Com uma? Com muitas? Reabertura?

**e) Histórias de usuário** (seed)
- *Comprador:* "Como comprador, publico um pedido e recebo ofertas comparáveis em X tempo para
  escolher a melhor."
- *Fornecedor:* "Como fornecedor elegível, vejo pedidos na minha região e envio ofertas competindo
  em tempo real."
- *Plataforma:* "Como operador, monitoro/modero leilões e intervenho em disputas."

**f) Integração & reusabilidade**
- Como um **segundo produto** consumiria o mesmo motor? Que abstrações (produto/categoria genéricos)?
- Contrato de integração versionado; degradação graciosa; SLAs.

---

## 7. Fora de escopo desta base (Claude Code / marketplace)

- **Não** implementamos a lógica do leilão aqui (fila, concorrência, tempo real) — é o microserviço.
- **Não** decidimos auction design, protocolo de rede, ou modelo de dados do leilão aqui.
- **Sim** cuidamos: dos pontos de integração no marketplace (gated), da experiência da loja, e — quando
  o microserviço existir — do cliente/adaptador que o consome com resiliência.

## 8. Referências

- Decisões: **D-007** (duas fases), **D-011** (sequência), **D-013** (segurança de auth), **D-014**
  (leilão como microserviço + gate), **D-015** (Spec Kit para pilotar no leilão) — `decisoes.md`.
- Spec do gating: `design/specs/spec-plataforma-gating-leilao.md` (inventário dos pontos de contato).
- Código-referência de domínio (mock): `front/src/lib/supplier-mock.ts`, `market-utils.ts`,
  `contexts/market-context.tsx`, `app/(main)/mercado/`, `components/mercado/`.
- Os 4 bugs de negócio do leilão (review 2026-07-02) — a corrigir **no microserviço**, não aqui.
