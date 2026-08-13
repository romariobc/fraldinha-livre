# Protocolo de Varredura de Segurança do Backend

Este documento estabelece o protocolo de auditoria e revisão de segurança estática para o ecossistema do backend do projeto **Fraldinha Livre**.

---

## 🛡️ Escopo do Protocolo de Varredura

A análise manual e estática deve ser executada buscando identificar padrões de vulnerabilidades e erros comuns de segurança, divididos em cinco categorias fundamentais:

1. **Banco sem Tranca (Concorrência e Inconsistências)**:
   * Identificar operações de leitura e escrita subsequentes realizadas fora de transações atômicas (`Time-of-Check to Time-of-Use` - TOCTOU).
   * Verificar se as alterações de status de pedidos ou atualizações críticas de inventário de estoque ocorrem de maneira segura e isolada.

2. **Input sem Tratamento (Sanitização e Validação)**:
   * Garantir que as validações de dados via Zod cubram de forma estrita as propriedades sensíveis (impedindo injeção de parâmetros ou mass-assignment).
   * Auditar a concatenação de strings em saídas ricas como HTML de e-mails, logs ou respostas do chat de IA, evitando injeções de HTML/XSS (Cross-Site Scripting).
   * Validar o uso de APIs externas (como envio de imagens para o Workers AI) contra SSRF (Server-Side Request Forgery).

3. **Permissão do Navegador (CORS e Security Headers)**:
   * Revisar as expressões regulares do middleware de CORS, limitando a permissão em produção a domínios e portas conhecidas.
   * Assegurar a presença de cabeçalhos mínimos de segurança HTTP (como `X-Content-Type-Options: nosniff`).

4. **Rota que Entrega Dado pelo ID (Prevenção de IDOR)**:
   * Verificar se rotas mutáveis (`PUT`, `DELETE`, `PATCH`) ou de visualização direta baseadas em identificadores de registros (`id`) validam se o solicitante autenticado (`uid`) é o legítimo proprietário do recurso.

5. **Chaves Expostas e Segredos no Código**:
   * Auditar arquivos de configuração (`wrangler.jsonc`, `drizzle.config.ts`, etc.) em busca de dados sensíveis hardcoded (como chaves de API, senhas ou UIDs estáticos de administração) que possam ser expostos no controle de versão Git.

---

## ⏰ Obrigatoriedade de Revisões Periódicas

A execução desta varredura de segurança é de **caráter obrigatório** e deve ocorrer nos seguintes períodos:

* **A cada alteração maior de arquitetura**: Sempre que novos endpoints ou integrações externas forem criados.
* **A cada ciclo de homologação/release de Milestone**: Antes do deploy de novas versões do backend em produção.
* **Intervalo Máximo**: Semestralmente, mesmo sem alterações substanciais no código, para monitoramento preventivo.

---

## 🧪 Complementaridade e Coexistência com Testes Automatizados

> [!IMPORTANT]
> **Relação com os Testes Automatizados (Vitest / CI):**
> Este protocolo de varredura manual de segurança **não deve, sob nenhuma hipótese, se sobrepor, anular ou substituir** a bateria de testes automatizados já implementada no projeto. 
> 
> * **Testes Automatizados (Vitest)**: Destinam-se ao fluxo de desenvolvimento ativo, cobrindo regras de negócio, testes unitários, testes de regressão de API e integridade de build.
> * **Auditoria de Segurança Manual**: Funciona como um crivo complementar de qualidade e arquitetura defensiva, focado em falhas conceituais de isolamento, vazamentos de informação e comportamentos concorrentes não detectáveis por testes de caso feliz.
