# Homologação integrada de pedidos e assistente

Branch: `qa/integrated-orders-assistant`. Integra os commits revisados `faecd2e` (#19) e `23013b4` (#20), mantendo `main` e os recursos de produção intactos.

## Recursos separados

- Worker: `fraldinha-livre-backend-homologacao`.
- D1: `fraldinha-livre-qa-integrated`, criado/reutilizado por nome exato. O script recusa o UUID do D1 de produção antes de executar migrations ou fixtures.
- Entrada: `back/src/qa-entry.ts`. A configuração de produção continua usando `back/src/index.ts`.
- Autenticação: tokens Firebase reais do projeto existente; nenhum privilégio ou senha é alterado. Notificações permanecem desligadas.
- Catálogo: somente duas ofertas de fixture ativas e um produto de fixture inativo. As migrations e os dados ficam no D1 separado.

O workflow só publica depois que testes, tipos e lint do commit integrado passam. O artifact `homologation-deployment` registra commit, versões, banco e URL. Publicação não comprova QA.

## Rotas para QA

`POST /chat/message` exercita o fluxo normal com o modelo real e o catálogo separado.

`POST /qa/chat/recovery` existe somente no entry point de homologação e também exige autenticação Firebase real. Cada chamada ao provedor usa Workers AI real. Na primeira seleção feita pelo modelo, o instrumento corrompe somente o ID para `qa-id-inexistente`; o harness deve rejeitá-lo e entregar o erro à inferência seguinte. A resposta inclui a resposta normal da API e um trace mínimo com chamadas, nomes de tools, injeção da falha e presença do erro no histórico enviado ao provedor.

Essa rota comprova recuperação com inferência real sob falha injetada, não que o modelo tenha inventado espontaneamente um ID. Uma rodada sem seleção ou sem action corrigida não deve ser aprovada como recuperação.

## Pendências de aceite

- Registrar resultados autenticados com requestId, commit e versão.
- Medir neurons oficialmente; requisições HTTP e chamadas de inferência são contagens diferentes.
- QA visual do administrador exige sessão autorizada e frontend configurado para esse backend. Esta etapa publica somente o backend.
- Teste iPhone/Safari exige aparelho físico; `accept` não garante conversão HEIC.
- Após o QA, decidir a remoção dos recursos exclusivos de homologação. Nenhuma limpeza de recursos remotos é automática.
