# chatsessions — registro de sessoes significativas

> Materializa a exigencia da **D-006**: "cada sessao significativa e documentada em `chatsessions/`".
> Complementa (nao substitui) o `../estado/progresso.md`: o `progresso.md` e o diario cronologico
> curto (estado + proximo passo); cada arquivo aqui e o **registro narrativo de UMA sessao** — o que
> se decidiu, por que, e o que ficou.

## Quando criar uma entrada

Uma sessao e "significativa" quando produz decisao (D-NNN/ADR), spec, plano, marco de feature, ou
mudanca de rumo. Sessoes triviais (um ajuste pequeno, uma duvida) nao precisam de entrada — basta o
commit e, se mudou o estado, o `progresso.md`.

## Convencao de nomes

`YYYY-MM-DD-sessao-<tema-curto>.md` — ex.: `2026-07-17-sessao-backend-decisao.md`.
Se houver mais de uma sessao no mesmo dia, sufixar: `-02`, `-03`.

## Estrutura de cada entrada

```markdown
# Sessao YYYY-MM-DD — <titulo>

**Tipo:** <reinicio / brainstorming / execucao / revisao / mista>
**Branch:** <branch> · **Commits:** <hashes principais>

## O que foi feito
Narrativa curta, em ordem.

## Decisoes
D-NNN / ADR criados ou alterados (com 1 linha de porque).

## Artefatos
Specs, planos, docs criados/alterados (caminhos).

## Proximo passo
O que a proxima sessao deve pegar (espelha o progresso.md).
```

## Indice

| Sessao | Tema | Commits principais |
|---|---|---|
| [2026-07-17](2026-07-17-sessao-backend-decisao.md) | Reinicio master + decisao e plano do backend (Cloudflare Workers + D1) | 46bb41e · 5d9fc86 · 149a2c8 · 1c26a00 |
