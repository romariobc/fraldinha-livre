# H-009 — Corrige mascaras/limites de CPF e telefone no perfil (feature 007a, fix)

**Executor:** sessao Haiku | **Autor:** sessao-mae (2026-07-03) | **Status:** PRONTO para disparo
**Spec:** `.claude/docs/design/specs/spec-area-cliente-perfil.md` (RN-05 + criterio de inputs) — em conflito, a spec vence; pare e relate.

## Objetivo

Corrigir um bug de usabilidade na aba Perfil (H-007): os campos CPF e Telefone NAO limitam a
digitacao — da para digitar caracteres alem do padrao (ex.: CPF `008.911.703-4000000...`, telefone
`85999999999999...`). Os inputs devem aceitar so digitos, limitar ao tamanho padrao e aplicar a
mascara AO VIVO.

## Contexto minimo

- Arquivo: `front/src/components/minha-conta/PerfilTab.tsx` (front do WORKTREE). Rode npm ali.
- Bug atual:
  - CPF (linha ~271): `const formatted = formatCPF(e.target.value)` — `formatCPF` devolve o valor cru
    quando != 11 digitos e nao limita → aceita digitacao infinita.
  - Telefone (linha ~290): `setEditData({...editData, phone: e.target.value})` — sem mascara e sem limite.
- AGENTS.md: leia `node_modules/next/dist/docs/`; ui-system.
- NAO mexer em mais nada; nao regredir 007a/013/005a.

## Tarefas

1. **Helpers de mascara ao vivo** (em PerfilTab, ou em lib/utils se preferir reuso):
   - `maskCPF(value): string` — `digits = value.replace(/\D/g,'').slice(0,11)`; formata
     progressivamente: `000.000.000-00` (aplica ponto apos 3, 6 e hifen apos 9, conforme o tamanho).
     Retorna a string mascarada (nunca mais que 11 digitos).
   - `maskPhoneBR(value): string` — `digits = value.replace(/\D/g,'').slice(0,11)`; formata BR:
     `(00) 0000-0000` para 10 digitos e `(00) 00000-0000` para 11 (progressivo enquanto digita).
     DDI 55 assumido (padrao atual) — nao precisa incluir o +55 no valor armazenado.
2. **Inputs**:
   - CPF onChange → `setEditData({...editData, cpf: maskCPF(e.target.value)})`. `inputMode="numeric"`,
     `maxLength={14}` (com mascara). Continua limpando o erro ao digitar.
   - Telefone onChange → `setEditData({...editData, phone: maskPhoneBR(e.target.value)})`.
     `inputMode="numeric"`, `maxLength={15}`.
3. **Validacao de quantidade** (na funcao de validacao ~linha 119-126), alem do que ja existe:
   - CPF: alem de `isValidCPF`, garantir 11 digitos (isValidCPF ja exige 11, mas a msg deve ser clara:
     "CPF deve ter 11 digitos" se o tamanho estiver errado; "CPF invalido" se digito verificador falhar).
   - Telefone: exigir 10 ou 11 digitos (`phone.replace(/\D/g,'').length` in [10,11]); senao
     "Telefone deve ter DDD + numero (10 ou 11 digitos)". Manter obrigatorio.
4. Garantir que `isProfileComplete` (lib/utils) continua coerente — ela ja valida CPF via isValidCPF
   e phone preenchido; se necessario, alinhar para tambem exigir 10-11 digitos no phone (opcional,
   mas coerente). Se alterar lib/utils, so o helper de phone.
5. Commit unico (pt-BR): `fix(comprador): limita e mascara ao vivo os campos CPF e telefone (feature 007a)`

**Arquivos autorizados:** `front/src/components/minha-conta/PerfilTab.tsx` e, se optar por reuso,
`front/src/lib/utils.ts` (so helpers de mascara/validacao de phone). Nada alem.

## Testes e verificacao (OBRIGATORIO — D-008)

No front do worktree:
1. `npm run lint` — RODE e LEIA o exit real (`npm run lint; echo "EXIT: $?"`); precisa ser EXIT 0
   (sem `any`, sem erro novo).
2. `npm run build` — passa.
3. Estatico: confirme que os onChange usam os helpers com `.slice(0,11)` (cap) e que nao ha mais
   `e.target.value` cru no CPF/telefone.
   Validacao end-to-end (digitar e ver o cap/mascara) fica para o humano no npm run dev — relate.

**Loop de encerramento:** falhou → corrigir e re-verificar, MAX 3 TENTATIVAS; apos a 3a, PARE e relate.

## Criterios de aceite

- [ ] CPF: so digitos, cap 11, mascara ao vivo `000.000.000-00`; impossivel ultrapassar
- [ ] Telefone: so digitos, cap 11, mascara BR ao vivo; impossivel ultrapassar
- [ ] Validacao de quantidade (CPF 11; telefone 10-11) com mensagens claras; CPF invalido bloqueia
- [ ] `npm run lint` EXIT 0 (lido, nao presumido); `npm run build` passa; nada mais tocado

## Restricoes

- So os arquivos autorizados; commits pt-BR; sem `--no-verify`. NAO presuma resultados — rode e leia.

## Relatorio esperado

`git show --stat <hash>`; o que mudou nos handlers/validacao; saida REAL de lint (exit lido) e build;
o que fica para validacao humana; hash; pendencias.
