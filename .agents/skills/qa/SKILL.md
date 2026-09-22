---
name: qa
description: Validação proporcional ao escopo e homologação com evidência real.
---

# Qualidade e homologação

1. Leia os critérios da tarefa e selecione verificações em docs/governance/ciclo-de-sessao.md. Não execute scripts inexistentes nem presuma tsconfig na raiz.
2. Para UI, confira os fluxos afetados, loading/erro, teclado/foco e tamanhos de tela pertinentes. Para API, confira contratos, autorização e efeitos persistidos. Não considere mocks como prova de integração real.
3. Para documentação, verifique caminhos, referências, JSON e integridade de conteúdo preservado.
4. Registre resultados e limitações. Metadados, SEO, performance e segurança são avaliados quando pertencem ao escopo; não crie recursos ou contatos de segurança fictícios durante uma validação.
5. Migrações remotas, publicação e alteração de segredos dependem de autorização específica e plano operacional. QA local não executa essas operações automaticamente.

6. Use a matriz por critério de docs/qa/README.md e o checklist de docs/governance/review-checklist.md. Registre resultados finais dos comandos, lacunas e cenários negativos relevantes. Revisão concluída não significa produto aprovado; fatos remotos herdados devem ser identificados como não revalidados.
