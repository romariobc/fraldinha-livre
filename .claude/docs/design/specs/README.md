# Specs de Design — Fraldinha Livre

> Spec-driven development e obrigatorio neste projeto (ver `.claude/docs/decisoes.md` D-002).
> Nenhuma implementacao comeca sem spec correspondente aqui. Backup das specs e mantido
> no harness de referencia (`dev_flow_create_harness`).

## Convencao de nomes

`spec-<dominio>-<tema>.md` — ex.: `spec-mercado-oferta-inline.md`, `spec-comprador-aceite-oferta.md`.

Dominios: `catalogo`, `comprador` (minha-conta), `fornecedor` (painel), `mercado`, `auth`, `plataforma`.

## Template

```markdown
# Spec — <titulo>

**Dominio:** | **Feature relacionada:** (id do feature_list.json) | **Status:** rascunho / aprovada / implementada

## Contexto
Por que isso existe; qual problema resolve.

## Regras de negocio
Numeradas (RN-01, RN-02...) — cada uma testavel.

## Fluxos e estados
Passo a passo do usuario; estados e transicoes validas.

## Criterios de aceite
Checklist verificavel — so prova executavel conta.

## Fora de escopo
O que explicitamente NAO entra.

## Referencias
Arquivos de codigo, decisoes (D-NNN), outros specs.
```

## Indice

| Spec | Feature | Status |
|---|---|---|
| [spec-plataforma-gating-leilao.md](spec-plataforma-gating-leilao.md) | 013 — leilao visivel porem inativo (Fase 1) | APROVADA (2026-07-02) |
| [spec-auth-google.md](spec-auth-google.md) | 005a — login Google NextAuth v5 (Fase 1) | rascunho — aguardando aprovacao |
| [spec-catalogo-compra-direta.md](spec-catalogo-compra-direta.md) | 014 — compra direta multi-vendedor (Fase 1) | APROVADA (2026-07-02) |
