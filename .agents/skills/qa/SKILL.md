---
name: qa
description: >-
  Use esta skill para homologação, controle de qualidade (QA) e preparação de lançamento em produção do projeto Fraldinha Livre.
---

# Controle de Qualidade (QA) e Homologação para Produção

Esta skill define os procedimentos obrigatórios para testar, validar e preparar o monorepo Fraldinha Livre para deploy em produção. A aplicação de todos os passos deste guia previne regressões e garante a conformidade com padrões modernos de SEO, desempenho, segurança e acessibilidade.

---

## 🚀 Passo 1: Validação Automatizada de Código (Sanity Check)

Antes de homologar qualquer alteração visual ou de infraestrutura, a suíte de testes e tipagem do monorepo deve estar 100% íntegra.

### 1. Testes do Frontend
Navegue para o diretório `front/` e execute a suíte de testes unitários:
```bash
# Executado dentro de front/
npm run test
```
*Garante que componentes de UI, contexts (Auth, Cart, Orders, Market) e adapters não quebraram.*

### 2. Testes do Backend
Navegue para o diretório `back/` e execute os testes unitários da API:
```bash
# Executado dentro de back/
npm run test
```
*Valida rotas, middlewares, e a lógica de validação do banco SQLite/D1.*

### 3. Verificação de Tipos (TypeScript Compile Check)
Rode o typecheck em ambos os ambientes para garantir que não há erros silenciosos ou tipos `any` / `unknown` que quebrem o build:
```bash
# No diretório raiz ou front/
npx tsc --noEmit

# No diretório back/
npm run typecheck
```

---

## 📂 Passo 2: Arquivos de Raiz, Metadados e SEO Técnico (Next.js App Router)

Configure os arquivos estáticos e dinâmicos de metadados obrigatórios. No Next.js App Router, alguns arquivos de metadados devem ser servidos na pasta `front/public/` ou gerados na raiz do App Router em `front/src/app/`.

### 1. robots.ts (Gerenciador de Crawlers)
Crie o arquivo [front/src/app/robots.ts](file:///e:/Labdev/Projetos/fraldinha-livre/front/src/app/robots.ts) para controlar o rastreamento dos motores de busca, protegendo painéis restritos (admin, fornecedor, conta):

```typescript
import { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: [
        '/admin/',
        '/painel-fornecedor/',
        '/minha-conta/',
        '/sacola/',
        '/checkout/',
        '/onboarding/'
      ],
    },
    sitemap: 'https://fraldinhalivre.com.br/sitemap.xml',
  };
}
```

### 2. sitemap.ts (Mapa de Indexação do Site)
Crie o gerador de Sitemap em [front/src/app/sitemap.ts](file:///e:/Labdev/Projetos/fraldinha-livre/front/src/app/sitemap.ts):

```typescript
import { MetadataRoute } from 'next';

export default async function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = 'https://fraldinhalivre.com.br';
  
  // Rotas estáticas do Marketplace
  const staticRoutes = [
    '',
    '/catalogo',
    '/login',
    '/cadastro',
    '/como-funciona',
    '/termos',
    '/privacidade',
  ].map((route) => ({
    url: `${baseUrl}${route}`,
    lastModified: new Date(),
    changeFrequency: 'daily' as const,
    priority: route === '' ? 1.0 : 0.8,
  }));

  // TODO: No futuro, consultar dinamicamente a API de produtos para adicionar slugs ativos:
  // Exemplo: `/produto/${product.slug}`

  return [...staticRoutes];
}
```

### 3. llms.txt (Instruções para Modelos e Agentes de IA)
Crie o arquivo [front/public/llms.txt](file:///e:/Labdev/Projetos/fraldinha-livre/front/public/llms.txt) para auxiliar a leitura semântica por LLMs, contendo a síntese arquitetural do projeto:

```markdown
# Fraldinha Livre

Plataforma de Marketplace B2B2C voltada para compra coletiva, cotação e compra direta de fraldas descartáveis em larga escala. 

## Detalhes Tecnológicos
- **Frontend**: Next.js App Router (TailwindCSS + shadcn/ui) hospedado na Cloudflare.
- **Backend**: Hono API + Drizzle ORM + Cloudflare D1 + Workers AI.
- **Autenticação**: Firebase Client Auth (ID Token injetado em Headers de requisições).

## Rotas de Destaque
- `/catalogo`: Vitrine de fraldas do mercado.
- `/catalogo/fornecedor/[fornecedorId]`: Loja exclusiva B2C do fornecedor.
- `/painel-fornecedor`: Painel B2B para o fornecedor gerenciar vendas e catálogo.
- `/minha-conta`: Espaço do comprador para rastrear pedidos.
- `/assistente`: PWA assistente de compras inteligente com IA (Vision + Chat).
```

### 4. .well-known/security.txt (Divulgação de Vulnerabilidades)
Crie o diretório `front/public/.well-known/` caso não exista, e salve o arquivo [security.txt](file:///e:/Labdev/Projetos/fraldinha-livre/front/public/.well-known/security.txt):

```text
Contact: mailto:seguranca@fraldinhalivre.com.br
Expires: 2027-08-28T12:00:00.000Z
Preferred-Languages: pt, en
Canonical: https://fraldinhalivre.com.br/.well-known/security.txt
Policy: https://fraldinhalivre.com.br/privacidade
```

### 5. site.webmanifest (Metadados PWA)
O Next.js mapeia o ícone principal automaticamente caso existam os arquivos `icon.png` e `apple-icon.png` em `src/app/`. Crie o manifesto PWA em [front/public/site.webmanifest](file:///e:/Labdev/Projetos/fraldinha-livre/front/public/site.webmanifest) para habilitar instalação mobile de forma nativa:

```json
{
  "name": "Fraldinha Livre",
  "short_name": "Fraldinha",
  "description": "Marketplace Inteligente de Fraldas Descartáveis",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#ffffff",
  "theme_color": "#0ea5e9",
  "icons": [
    {
      "src": "/icon.png",
      "sizes": "512x512",
      "type": "image/png"
    }
  ]
}
```

---

## 🎨 Passo 3: Responsividade, Layout e Acessibilidade (QA de Interface)

Ao modificar ou criar novos componentes de UI no diretório `front/src/components/`, certifique-se de testar:

1. **Quebras de Breakpoints (Responsividade)**:
   - **Mobile (360px a 428px)**: Menus colapsados em hambúrguer, tabelas convertidas em cards de lista responsiva (ex: `MarketTable` e `OrdersDataTable` devem quebrar em blocos de leitura limpa em celulares).
   - **Tablet (768px a 1024px)**: Ajuste de colunas de grid (geralmente mudando de `grid-cols-1` para `grid-cols-2` ou `grid-cols-3`).
   - **Desktop (1280px+)**: Sidebar do painel do fornecedor visível por padrão e container principal limitado para leitura confortável.
2. **Prevenção de Hydration Mismatches**:
   - Evite injetar no HTML inicial gerado pelo servidor (`SSR`) variáveis dependentes do client-side, como `window.innerWidth`, `localStorage` ou datas formatadas baseadas no fuso horário do navegador. Se necessário, proteja o componente com verificação de montagem:
     ```typescript
     const [mounted, setMounted] = React.useState(false);
     React.useEffect(() => setMounted(true), []);
     if (!mounted) return <Skeleton />;
     ```
3. **Navegação por Teclado e Foco (a11y)**:
   - Todos os botões, links e inputs devem exibir contorno visível de foco (`ring`) ao navegar via tecla `Tab`.
   - Modais (`BuyModal`, `AddProductDialog`) devem reter o foco e fechar com a tecla `Esc`.

---

## ⚡ Passo 4: Desempenho e Core Web Vitals

1. **Otimização de Imagens**:
   - Use o componente `<Image />` do `next/image` para imagens estáticas locais para permitir redimensionamento automático e formato `.webp`.
   - Para imagens externas vindas de scrapers (como Pague Menos), adicione o wildcard no `next.config.ts` (remotePatterns) e adicione `loading="lazy"` e fallbacks visuais caso a URL original falhe ou demore para carregar.
2. **Debounce em Entradas de Busca**:
   - Campos de filtro e texto de busca que alteram a rota (ex: `CatalogFilters.tsx`) **devem operar com debounce mínimo de 300ms a 400ms** para evitar requisições concorrentes e lag de digitação no teclado do usuário.

---

## 🛡️ Passo 5: Segurança e Infraestrutura de Produção (Cloudflare/D1/Firebase)

1. **Execução de Migrações de Produção**:
   - Nunca confie no seed dinâmico em produção. Sempre execute as migrations acumuladas no D1 remoto via terminal:
     ```bash
     # Rodar de dentro da pasta 'back'
     npx wrangler d1 migrations apply fraldinha-livre-db --remote
     ```
2. **Blindagem de Segredos**:
   - **Variáveis Públicas**: Devem possuir o prefixo `NEXT_PUBLIC_` (ex: `NEXT_PUBLIC_FIREBASE_API_KEY`, `NEXT_PUBLIC_USE_BACKEND`).
   - **Secrets de Backend**: As chaves como `RESEND_API_KEY` ou credenciais do Firebase Admin **nunca** devem ser commitadas nem injetadas no bundle do frontend. Elas devem ser adicionadas como segredos no worker de backend através do CLI da Cloudflare:
     ```bash
     npx wrangler secret put RESEND_API_KEY
     ```
3. **Headers de Segurança (HTTP)**:
   - Garanta que a Cloudflare ou o Next.js configurem cabeçalhos restritivos para evitar XSS e clickjacking:
     - `X-Frame-Options: DENY`
     - `X-Content-Type-Options: nosniff`
     - `Referrer-Policy: strict-origin-when-cross-origin`

---

## 📝 Lista de Verificação Rápida de Lançamento (Checklist)

- [ ] Todos os testes locais passam (`npm test` front e back).
- [ ] O `tsc --noEmit` de frontend e backend chega com `Exit Code 0`.
- [ ] Os arquivos de metadados (`robots.ts`, `sitemap.ts`, `llms.txt`, `security.txt`, `site.webmanifest`) foram gerados nos caminhos corretos.
- [ ] Rota `front/src/app/not-found.tsx` personalizada e funcional.
- [ ] As credenciais e variáveis sensíveis foram separadas em segredos no console do Cloudflare Wrangler (`wrangler secret put`).
- [ ] A migration de banco de dados remota do Cloudflare D1 foi executada com sucesso.
- [ ] Realizada validação visual no navegador (cross-browser e breakpoints mobile).
