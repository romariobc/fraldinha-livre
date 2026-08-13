# Fraldinha Livre

O **Fraldinha Livre** é um marketplace de fraldas e itens relacionados que implementa um modelo inovador de **licitação/leilão reverso**. O projeto conecta compradores corporativos e recorrentes (como hospitais, clínicas, creches e famílias) com fornecedores parceiros que competem para oferecer os melhores preços e prazos de entrega.

O projeto é executado em duas fases principais:
1. **Fase 1 (Loja Marketplace & Compra Direta):** Catálogo de produtos ativos, autenticação real de usuários compradores e fornecedores, e checkout de compra direta com transações atômicas de pedidos.
2. **Fase 2 (Leilão Reverso - Em Planejamento):** Mecanismo de solicitações de ofertas, onde fornecedores competem enviando lances em tempo real para pedidos específicos na plataforma.

---

## 📂 Estrutura de Pastas e Monorepo

O repositório é configurado como um monorepo que compartilha esquemas de validação e tipos entre o cliente e o servidor:

* **[`front/`](file:///e:/Labdev/Projetos/fraldinha-livre/front)**: Aplicação web em Next.js 16 (React 19, TypeScript, TailwindCSS 3, Base UI / Shadcn). Controla o fluxo de navegação, painéis de fornecedores e painel do comprador. Integrado com Firebase Auth e Firestore para persistência de perfis.
* **[`back/`](file:///e:/Labdev/Projetos/fraldinha-livre/back)**: API Backend e agentes executados como Cloudflare Worker usando o framework Hono. Integrado com banco de dados SQLite Cloudflare D1, Workers AI (para chat inteligente multimodal) e API Resend (para e-mails de notificação).
* **[`packages/contracts/`](file:///e:/Labdev/Projetos/fraldinha-livre/packages/contracts)**: Contratos TypeScript e esquemas Zod compartilhados. Garante validação estrita de dados nos dois lados (frontend e backend).
* **[`.claude/`](file:///e:/Labdev/Projetos/fraldinha-livre/.claude)**: Documentação histórica, decisões arquiteturais (ADRs), logs de sessões e prompts.
  * **[`.claude/docs/security/`](file:///e:/Labdev/Projetos/fraldinha-livre/.claude/docs/security)**: Contém o protocolo de varredura periódica de segurança e os relatórios de análise de vulnerabilidades.
* **[`legacy/`](file:///e:/Labdev/Projetos/fraldinha-livre/legacy)**: Código do protótipo histórico anterior (apenas para referência, desativado).

---

## 🛠️ Stack Tecnológica

* **Frontend:** Next.js 16, React 19, TypeScript, TailwindCSS, Firebase SDK.
* **Backend:** Hono, Drizzle ORM, Cloudflare Workers Runtime.
* **Banco de Dados:** Cloudflare D1 (Banco de dados relacional baseado em SQLite) + Firebase Firestore (dados de autenticação/perfis).
* **Inteligência Artificial:** Cloudflare Workers AI (`meta/llama-4-scout-17b-16e-instruct`) com suporte a Tool Calling nativo para consulta de catálogo.
* **Segurança:** Firebase Auth (tokens ID JWT validados por chaves públicas no backend) + CORS dinâmico regulado + Validação Zod.

---

## 🚀 Como Rodar Localmente

Certifique-se de que possui o **Node.js (>= 22.0.0)** instalado.

### 1. Backend (API & Worker)
Navegue para a pasta `back`, instale as dependências e inicie o ambiente de desenvolvimento local usando o Wrangler:
```bash
cd back
npm install
npm run dev
```
O backend local estará rodando na porta simulada do Wrangler (geralmente `http://localhost:8787`).

### 2. Frontend (Next.js)
Navegue para a pasta `front`, instale as dependências e inicie o servidor Next.js:
```bash
cd front
npm install
npm run dev
```
A aplicação estará disponível em `http://localhost:3000`.

---

## 🧪 Testes Automatizados

Ambos os projetos possuem suítes de testes automatizados configurados via **Vitest**:

* **Rodar testes do Frontend:**
  ```bash
  cd front
  npm run test
  ```
* **Rodar testes do Backend (incluindo emulação D1 e Workers):**
  ```bash
  cd back
  npm run test
  ```

---

## 🛡️ Segurança e Auditoria

O projeto segue um protocolo estrito de segurança manual e periódica documentado em:
* 📜 **[Protocolo de Varredura de Segurança](file:///e:/Labdev/Projetos/fraldinha-livre/.claude/docs/security/README.md)**

A auditoria manual foca nas seguintes travas de segurança:
1. **Banco de Dados**: Prevenção de condições de corrida (TOCTOU) e validação de trancas/transações de estado em pedidos e controle de estoque.
2. **Inputs**: Proteção contra injeções de código HTML/XSS (especialmente em envios de e-mail e templates) e validação estrita via Zod.
3. **CORS e Headers**: Configuração robusta de permissão do navegador para localhost e domínios de homologação/produção.
4. **IDOR**: Validação de posse do proprietário (`supplierId` / `order.uid`) para todas as rotas que acessam ou modificam dados por IDs de recursos.
5. **Secrets**: Proteção de credenciais de APIs por meio de variáveis de ambiente secretas injetadas via `wrangler secret`.

> [!NOTE]
> O processo de varredura manual de segurança é complementar e **não substitui** os testes automatizados contidos nas pastas `front/test` e `back/test`.
