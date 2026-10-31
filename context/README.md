# Contexto seletivo para desenvolvimento

1. Leia AGENTS.md e context/estado/progresso.md (estado atual curto).
2. Execute node scripts/context.mjs status ID para o item autorizado. Não ler o JSON inteiro por padrão.
3. Consulte a skill do domínio afetado. Leia docs/architecture/arquitetura-vigente.md se a mudança cruzar camadas.
4. Execute node scripts/context.mjs packet para escolher o pacote inicial. Os arquivos são opções de navegação, não leitura obrigatória integral.
5. Execute node scripts/context.mjs imports CAMINHO para dependências locais atuais; consulte testes e consumidores quando a mudança exigir.
6. Valide conforme .agents/skills/qa/SKILL.md e atualize somente o estado atual, preservando evidências históricas.

## Comandos (raiz do repositório)

| Necessidade | Comando |
|---|---|
| Item e dependências | node scripts/context.mjs status MP-04 |
| Pacotes disponíveis | node scripts/context.mjs packet |
| Etapas do checkout | node scripts/context.mjs packet checkout |
| Tabela e detalhes do fornecedor | node scripts/context.mjs packet supplier-orders |
| Importações de um arquivo | node scripts/context.mjs imports front/src/contexts/orders-context.tsx |
| Regerar mapa local | node scripts/context.mjs graph --write |
| Conferir limites e referências | node scripts/context.mjs check |

## Fontes e fronteiras

- Contratos HTTP: packages/contracts/src/.
- Modelos de apresentação: front/src/lib/domain/account.ts, domain/supplier.ts e products.ts. Derivam de contratos quando a representação coincide; diferenças legadas ficam explícitas nos adaptadores.
- Conversões: front/src/lib/order-adapters.ts e product-adapters.ts. priceCents é campo HTTP; priceInCents é a projeção do catálogo existente.
- Fixtures: account-mock.ts e supplier-mock.ts contêm apenas dados de demonstração; helpers em formatters.ts. Não confundir fixture com fonte dos pedidos reais.
- Implementações locais de tabela/gráficos: lib/compat/. Importá-las por caminho explícito; não há alias ocultando pacotes externos.
- Persistência/autorização: back/src/routes/, middleware/, schema/ e migrations/. A UI não concede privilégio.

## Orçamento de leitura

Leia contrato + implementação afetada + testes pertinentes antes de expandir. Evite anexar logs completos. O tamanho nominal da janela inclui também instruções, ferramentas, histórico da conversa e saída. A contagem de linhas do comando packet auxilia navegação; não mede tokens de todos os modelos.

O mapa graphify-out/graph.json é gerado por TypeScript, por módulo, incluindo imports de tipos; não infere chamadas, transações, runtime ou estado remoto. O snapshot anterior fica em graphify-out/graph-before-ctx-01.json. Consultas antigas do Graphify/HTML podem ter granularidade e data diferentes; o comando imports lê o código atual diretamente.

## Histórico e decisões

progresso-ate-*.md, progresso-historico.md, docs/archive/ e context/chatsessions/ ficam fora da entrada normal. Decisões antigas estão em docs/governance/decisoes.md; consultar a seção/emenda necessária, sem assumir que um rótulo VIGENTE antigo prevalece sobre emendas posteriores.
