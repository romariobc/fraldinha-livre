# Checklist de revisao pre-aprovacao (pre-flight) — entregas Haiku

> Obrigatorio (D-012) antes de a sessao-mae declarar "aprovado" qualquer entrega de sessao Haiku.
> Motivo de existir: em 2026-07-02 o H-002 foi aprovado com base no relatorio do executor, que
> afirmava ter removido 6 arquivos (RN-06) — mas o commit nao tinha nenhuma delecao. So foi pego
> na verificacao pre-main. Este checklist fecha esse buraco.

## Principio 0 — O relatorio do Haiku NAO e prova

O relatorio e ponto de partida, nao evidencia. TODA afirmacao relevante (arquivos deletados, lint
passando, testes ok) tem que ser confirmada por comando proprio da sessao-mae. Se voce so leu o
relatorio, voce ainda NAO revisou.

## 1. Escopo real do commit (o miss do H-002 mora aqui)

- [ ] `git show --stat <hash>` — ver EXATAMENTE o que foi **Added / Modified / DELETED**. Se a spec
      pedia delecoes, elas TEM que aparecer como `delete mode ...`. Se o relatorio diz "deletei X"
      mas nao ha `delete mode X`, a delecao NAO aconteceu.
- [ ] Confirmar que so os arquivos autorizados pelo prompt mudaram (nada inesperado em
      legacy/back/app/docs/settings).
- [ ] `git status --short` — working tree limpo, sem pendencias fora do commit.
- [ ] Se houve 2+ commits, revisar o conjunto (`git show --stat` de cada, ou `git diff <base>..HEAD --stat`).

## 2. Prova executavel — RODAR, nao ler

- [ ] `npm run build` no front do WORKTREE — passa. **Conferir a lista de rotas**: uma rota que
      deveria ter sumido (ex.: /perfil) NAO pode aparecer.
- [ ] `npm run lint` — **exit 0**. Warnings preexistentes: toleraveis com decisao explicita. ERRO
      (novo ou preexistente que quebra o exit): bloqueia ou vira caveat documentado, nunca ignorado.
- [ ] Testes automatizados, quando existirem.

## 3. Criterios de aceite — um a um, com evidencia

- [ ] Cada item do "Criterios de aceite" da spec conferido individualmente.
- [ ] Delecoes: grep 0 referencias **E** arquivo fora do disco (`ls`/`test -e`) **E** `delete mode`
      no commit (os tres, nao so o grep).
- [ ] Flags / comportamento reversivel testados quando aplicavel (ex.: LEILAO_ATIVO=true restaura).

## 4. Leitura do diff (qualidade e regressao)

- [ ] Ler o diff dos arquivos-nucleo (nao so o `--stat`): Rules of Hooks; guards esperam `loading`;
      sem `setState`/`router.push` no render; sem segredo hardcoded; sem `product.price` em reais
      quando o padrao e centavos; sem `as Address`/cast sem validacao.
- [ ] Regressao: features ja aprovadas (gating 013, auth 005a) continuam intactas.

## 5. Seguranca e convencoes

- [ ] `git ls-files | grep -i env` vazio (nenhum .env versionado); `.env.local` ignorado.
- [ ] Commit em pt-BR, Conventional Commits, trailer `Co-Authored-By: Claude Fable 5 ...`.

## Veredito

- **APROVADO** somente se 1-5 passam. Registrar o veredito no chatsession COM a evidencia (saidas de
  `git show --stat`, build, lint) — nao "aprovado" solto.
- **REPROVADO/ajustes**: reenviar ao Haiku via SendMessage com o ponto especifico; re-revisar do zero
  apos o fix (o checklist inteiro, nao so o ponto corrigido).

## Historico de misses (aprende-se com eles)

| Data | Miss | Como foi pego | Correcao |
|---|---|---|---|
| 2026-07-02 | H-002 nao deletou os 6 arquivos de codigo morto (RN-06); aprovado pelo relatorio | `npm run build` pre-main listou /perfil; `git show --stat` confirmou 0 delecoes | H-006 + este checklist (D-012) |
