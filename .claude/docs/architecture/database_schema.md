# Esquema de Banco de Dados — Fraldinha Livre

O projeto **Fraldinha Livre** utiliza uma arquitetura de banco de dados híbrida para conciliar alto desempenho na borda (edge computing), consistência transacional e gerenciamento seguro de sessões de usuário.

```mermaid
graph TD
    subgraph Firebase (Auth & Perfil)
        Firestore[(Firestore)]
        Auth[Firebase Auth]
        Firestore -.->|users/uid| Auth
    end

    subgraph Cloudflare D1 (Transacional / SQLite)
        D1[(SQLite DB)]
        products[(products)]
        orders[(orders)]
        order_items[(order_items)]
        reports[(reports)]
        
        orders -->|1:N| order_items
        orders -.->|uid| Firestore
        reports -->|order_id| orders
    end
```

---

## 1. Arquitetura Geral

1. **Firebase Firestore**: Armazena as contas, dados cadastrais e perfis dos usuários (`comprador` e `fornecedor`). As regras de acesso são fortemente restritas no lado do servidor/regras do Firestore, garantindo, por exemplo, a imutabilidade do papel (`role`) do usuário após a criação.
2. **Cloudflare D1 (SQLite + Drizzle ORM)**: Gerencia o catálogo de produtos, pedidos de compras, itens dos pedidos e relatórios de auditoria/suporte. Drizzle ORM é usado no backend (Cloudflare Workers) para migrações robustas e tipagem estática integrada com TypeScript.

---

## 2. Tabelas no Cloudflare D1 (SQLite via Drizzle)

As definições estão localizadas em [src/schema/](file:///e:/Labdev/Projetos/fraldinha-livre/back/src/schema/).

### 2.1 Tabela: `products`
Armazena o catálogo de fraldas e produtos disponíveis para venda.

* **Arquivo de Origem**: [products.ts](file:///e:/Labdev/Projetos/fraldinha-livre/back/src/schema/products.ts)
* **Estrutura**:

| Coluna | Tipo SQLite | Drizzle/TS Type | Restrições / Padrão | Descrição |
| :--- | :--- | :--- | :--- | :--- |
| `id` | `TEXT` | `string` | `PRIMARY KEY` | Identificador único do produto (UUID). |
| `price_cents` | `INTEGER` | `number` | `NOT NULL` | Preço unitário do produto em centavos (BRL). |
| `supplier_id` | `TEXT` | `string` | `NOT NULL` | ID do fornecedor (referencia o `uid` do Firebase). |
| `name` | `TEXT` | `string` | `NOT NULL DEFAULT ''` | Nome do produto. |
| `brand` | `TEXT` | `string` | `NOT NULL DEFAULT ''` | Marca (ex: Pampers, Huggies). |
| `size` | `TEXT` | `string` | `NOT NULL DEFAULT ''` | Tamanho (ex: M, G, XG). |
| `quantity` | `INTEGER` | `number` | `NOT NULL DEFAULT 0` | Quantidade em estoque ou no pacote. |
| `slug` | `TEXT` | `string` | `NOT NULL DEFAULT ''` | Slug URL-friendly para indexação. |
| `categoria` | `TEXT` | `string` | `NOT NULL DEFAULT ''` | Categoria do produto (ex: Fralda, Lenço). |
| `descricao` | `TEXT` | `string` | `NOT NULL DEFAULT ''` | Descrição detalhada do produto. |
| `atributos` | `TEXT` | `ProductAtributos` (JSON) | `NOT NULL DEFAULT '{}'` | Metadados dinâmicos (peso, absorção, tecnologia, erpId). |
| `badge` | `TEXT` | `string` | `NULL` | Tag visual informativa (ex: "Mais vendido"). |
| `supplier_email`| `TEXT` | `string` | `NULL` | E-mail de contato do fornecedor. |
| `active` | `INTEGER` | `boolean` | `NOT NULL DEFAULT true` | Define se o produto está ativo/visível no catálogo. |
| `image_url` | `TEXT` | `string` | `NULL` | URL da imagem do produto. |

> [!NOTE]
> O campo `atributos` armazena um JSON contendo a estrutura validada pelo Zod `ProductAtributosSchema`:
> ```typescript
> {
>   faixaPeso: string;     // Ex: "7kg - 11kg"
>   genero: 'unissex';
>   absorcao: string;      // Ex: "Até 12 horas"
>   tecnologia: string;    // Ex: "Canais de ar"
>   erpId?: string;        // ID opcional do ERP do fornecedor
> }
> ```

---

### 2.2 Tabela: `orders`
Armazena o cabeçalho dos pedidos efetuados no sistema.

* **Arquivo de Origem**: [orders.ts](file:///e:/Labdev/Projetos/fraldinha-livre/back/src/schema/orders.ts)
* **Estrutura**:

| Coluna | Tipo SQLite | Drizzle/TS Type | Restrições / Padrão | Descrição |
| :--- | :--- | :--- | :--- | :--- |
| `id` | `TEXT` | `string` | `PRIMARY KEY` | Identificador único do pedido (UUID). |
| `uid` | `TEXT` | `string` | `NOT NULL` | ID do comprador (`uid` no Firebase). |
| `type` | `TEXT` | `string` | `NOT NULL` | Tipo do pedido (ex: `compra-direta`). |
| `status` | `TEXT` | `OrderStatus` | `NOT NULL` | Status atual do pedido (veja abaixo). |
| `product` | `TEXT` | `string` | `NOT NULL` | Nome do produto principal ou resumo do pedido. |
| `quantity` | `INTEGER` | `number` | `NOT NULL` | Quantidade total adquirida. |
| `unit` | `TEXT` | `'un' \| 'cx' \| 'kg'`| `NOT NULL` | Unidade de medida. |
| `price` | `INTEGER` | `number` | `NULL` | Valor total do pedido em centavos. |
| `supplier_id` | `TEXT` | `string` | `NULL` | ID do fornecedor executor. |
| `supplier_name` | `TEXT` | `string` | `NULL` | Nome de exibição do fornecedor. |
| `delivery_address`| `TEXT` | `string` (JSON) | `NOT NULL` | Endereço de entrega estruturado. |
| `created_at` | `TEXT` | `string` | `NOT NULL` | Carimbo de data/hora no formato ISO 8601. |

* **Índices**:
  * `idx_orders_uid` no campo `uid` para acelerar consultas de histórico de pedidos do comprador.

* **Status de Pedido (`OrderStatus`)**:
  * `'aguardando'`
  * `'ofertas-recebidas'`
  * `'aceito'`
  * `'confirmado'`
  * `'a-caminho'`
  * `'entregue'`
  * `'cancelado'`

---

### 2.3 Tabela: `order_items`
Contém as linhas de produtos individuais vinculadas a cada pedido.

* **Arquivo de Origem**: [orders.ts](file:///e:/Labdev/Projetos/fraldinha-livre/back/src/schema/orders.ts)
* **Estrutura**:

| Coluna | Tipo SQLite | Drizzle/TS Type | Restrições / Padrão | Descrição |
| :--- | :--- | :--- | :--- | :--- |
| `order_id` | `TEXT` | `string` | `NOT NULL` / `REFERENCES orders(id)` | Chave estrangeira que vincula ao pedido pai. |
| `product_id` | `TEXT` | `string` | `NOT NULL` | ID do produto comprado. |
| `product_name` | `TEXT` | `string` | `NOT NULL` | Nome do produto no momento da compra (snapshot). |
| `unit_price` | `INTEGER` | `number` | `NOT NULL` | Preço unitário em centavos no momento da compra. |
| `quantity` | `INTEGER` | `number` | `NOT NULL` | Quantidade comprada do item. |
| `unit` | `TEXT` | `'un' \| 'cx' \| 'kg'`| `NOT NULL` | Unidade de medida do item. |

---

### 2.4 Tabela: `reports`
Armazena notificações ou relatórios de irregularidades/problemas relacionados a pedidos.

* **Arquivo de Origem**: [reports.ts](file:///e:/Labdev/Projetos/fraldinha-livre/back/src/schema/reports.ts)
* **Estrutura**:

| Coluna | Tipo SQLite | Drizzle/TS Type | Restrições / Padrão | Descrição |
| :--- | :--- | :--- | :--- | :--- |
| `id` | `TEXT` | `string` | `PRIMARY KEY` | Identificador do relatório. |
| `order_id` | `TEXT` | `string` | `NOT NULL` / `REFERENCES orders(id)` | Pedido associado ao reporte. |
| `supplier_id` | `TEXT` | `string` | `NOT NULL` | ID do fornecedor sob reporte. |
| `client_id` | `TEXT` | `string` | `NOT NULL` | ID do cliente que abriu o reporte. |
| `message` | `TEXT` | `string` | `NOT NULL` | Conteúdo ou reclamação. |
| `read` | `INTEGER` | `boolean` | `NOT NULL DEFAULT false` | Status de leitura administrativa. |
| `created_at` | `TEXT` | `string` | `NOT NULL` | Data de criação (ISO 8601). |

* **Índices**:
  * `idx_reports_order_id` no campo `order_id`.
  * `idx_reports_client_id` no campo `client_id`.

---

## 3. Firebase Firestore: Coleção `users`

A estrutura de dados e acesso para cada documento em `users/{uid}`.

* **Regras de Acesso (Firestore Security Rules)**:
  * Localizadas em [firestore.rules](file:///e:/Labdev/Projetos/fraldinha-livre/firestore.rules).
  * A regra `RN-04 (D-013)` garante que a `role` do usuário só possa ser definida no onboarding (criação do documento) e permaneça **imutável** durante atualizações (`updateProfile` rejeita mudanças no campo `role`).
  * Remoção do usuário bloqueada (`allow delete: if false`).

### Estrutura do Documento `UserProfile`

* **Arquivo de Origem**: [auth-context.tsx](file:///e:/Labdev/Projetos/fraldinha-livre/front/src/contexts/auth-context.tsx#L39-L61)

```typescript
interface UserProfile {
  role: 'comprador' | 'fornecedor';
  name: string;
  email: string;
  phone?: string;
  cpf?: string;           // Exclusivo de 'comprador'
  cnpj?: string;          // Exclusivo de 'fornecedor'
  razaoSocial?: string;   // Exclusivo de 'fornecedor'
  nomeFantasia?: string;  // Exclusivo de 'fornecedor'
  createdAt?: string;     // ISO Date String
  updatedAt?: string;     // ISO Date String
  
  // Endereço principal do usuário
  address?: {
    logradouro: string;
    numero: string;
    complemento?: string;
    bairro: string;
    cidade: string;
    estado: string;       // Sigla de 2 caracteres (ex: "SP")
    cep: string;
  };

  // Lista de cartões de pagamento salvos (apenas compradores)
  savedCards?: Array<{
    id: string;
    brand: string;
    last4: string;
    holderName: string;
    expirationDate: string;
  }>;

  // Informações de histórico resumido para o assistente IA
  lastPurchase?: {
    productId: string;
    productName: string;
    quantity: number;
  };
}
```

---

## 4. Contratos de Validação Compartilhados (Zod)

As validações de integridade de dados e requisições HTTP ocorrem usando schemas Zod compartilhados em [packages/contracts/src/](file:///e:/Labdev/Projetos/fraldinha-livre/packages/contracts/src/).

* **`ProductSchema`**: Valida a integridade dos atributos de catálogo (peso, absorção, etc) e a representação de produtos antes do salvamento e retorno de APIs.
* **`OrderSchema`**: Define o formato completo do pedido, incluindo a validação de endereços de entrega (`AddressSchema`) e a coerência dos itens comprados (`OrderItemSchema`).
* **`ChatRequestSchema`**: Valida a payload recebida pelo assistente de IA, integrando mensagens contextuais, fotos anexadas em formato base64, o perfil do usuário atual e o histórico de última compra para alimentar dinamicamente os prompts da IA.
