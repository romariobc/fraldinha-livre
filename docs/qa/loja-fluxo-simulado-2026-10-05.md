# Loja de ponta a ponta com pagamento simulado — 2026-10-05

## Escopo autorizado

O usuário confirmou: publicar a loja após validar compra e venda completas com pagamento simulado, sem dependência do agente de chat. Pagamento real fica para módulo/API posterior, com Appmax ou Pagar.me ainda em decisão. Isso confirma a prioridade já registrada em [D-037](../governance/decisoes.md), na feature 006 e na feature 011. A avaliação anterior de prontidão comercial não define os requisitos desta publicação beta.

## Correções

- Home consulta o catálogo real, reutiliza ProductCard e permite adicionar à sacola/comprar agora; links de catálogo deixam de apontar para a própria seção.
- Comunicação da home, login, cadastro e FAQ identifica a simulação e remove promessas de Mercado Pago, competição ativa e entrega garantida. Header avisa que não existe cobrança real.
- Conversão dos pedidos para o fornecedor preserva endereço completo, itens e estado do pagamento simulado. A tabela distingue o modelo da API do modelo de apresentação; deixou de substituir dados reais por endereço comercial e linha de exemplo.
- Checkout sem endereço cadastrado não usa o endereço fictício de MOCK_USER; exige endereço informado antes de avançar e antes de processar a simulação.
- Fixture da homologação corrigida para respeitar o contrato ProductAtributosSchema. Nenhum relaxamento do contrato do frontend foi feito.
- CI passa a compilar a imagem Docker de produção antes da publicação de homologação.

## Evidência de navegador e API

Frontend compilado localmente, contra Worker/D1 exclusivos de homologação. Login Firebase real com contas de teste existentes. Nenhuma chamada ao chat, nenhum cartão real, cobrança, contratação de frete ou criação de pedido em produção durante esta homologação.

1. Home carregou produtos reais da API. Adicionados Supersec Pants P (2 pacotes) e Confort Sec M (1 pacote).
2. Sacola exibiu 3 pacotes, duas linhas, total R$ 79,70.
3. Checkout revisou endereço fictício Rua QA Loja, 123, Apto QA 4, Centro, Fortaleza/CE, 60000000.
4. Recusa simulada não criou pedido para esse endereço e manteve a sacola.
5. Pix simulado aprovado criou um único pedido `ec6ac19d-6dd0-42f8-afe6-631ebdf8cb81`, preço 7970 centavos, duas linhas, três pacotes, transação `txn-sim-1791169212713-1`.
6. Comprador viu o pedido aguardando confirmação. Logout e login do fornecedor exibiram o mesmo pedido, endereço completo e todas as linhas.
7. Pelo painel: aguardando → confirmado → a-caminho → entregue. F5 preservou o estado entregue.
8. Logout do fornecedor e novo login do comprador: zero pedidos ativos; pedido no histórico como entregue, com linhas, endereço e pagamento simulado aprovado. API confirmou o mesmo estado no D1.

Capturas e respostas JSON foram salvas localmente em outputs/; não contêm credenciais. Compra/admin em produção não são presumidos a partir desta prova de homologação.

## Validações

- Frontend completo antes da correção adicional de endereço: 68 arquivos, 708 testes aprovados.
- Checkout final: 27 testes aprovados, incluindo ausência de endereço sem fallback.
- Build final (Next 16.2.11): aprovado; inclui TypeScript e geração de todas as rotas.
- Lint: exit 0, 11 avisos preexistentes, nenhum erro.
- CI final e publicação: consultar o run associado ao commit candidato; resultado de deploy será registrado após execução, sem presumir sucesso.

## Limites preservados

Feature 011 continua pendente. Não integrar nem selecionar gateway agora. Leilão permanece inativo. QA do administrador, iPhone/foto física e telemetria de neurons não são requisitos inventados para esta jornada de loja e não foram declarados aprovados.
