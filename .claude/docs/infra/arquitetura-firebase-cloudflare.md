# Infraestrutura — Arquitetura (Firebase + Cloudflare) e Custos/Limites do Workers Paid

> Este arquivo é a fonte da verdade de infraestrutura do projeto: como os módulos se conectam,
> requisitos de segurança/rede/disponibilidade, e os limites de custo do plano pago da Cloudflare.
> Qualquer sessão que for mexer em auth, backend, deploy do front ou billing deve ler isto primeiro.
>
> Decisões de arquitetura completas (com o raciocínio de cada troca) vivem em `decisoes.md`
> (D-001, D-010, D-026, D-027, D-029, D-030) — este arquivo resume o estado **resultante**, não
> repete o histórico de como chegamos aqui.

## 1. Visão geral

**Duas nuvens, por domínio separado (D-027):** Firebase cuida só de **identidade** (autenticação +
o único dado que o client grava direto nele, o perfil do usuário). Cloudflare cuida de **dados de
negócio e hospedagem** (API, banco relacional, frontend). Não há sobreposição de responsabilidade
entre as duas.

```
                         ┌─────────────────────────┐
                         │   Google / Firebase      │
                         │  ─────────────────────   │
                         │  Firebase Auth            │  ← login Google (popup)
                         │  (Identity Toolkit)        │  ← emite Firebase ID Token (JWT)
                         │                            │
                         │  Firestore (users/{uid})   │  ← perfil (nome, CPF/CNPJ, endereço)
                         └────────────┬───────────────┘
                                      │ SDK client (browser), direto
                                      │ protegido por firestore.rules
                                      │
   ┌──────────────────────────────────┴───────────────────────────────────┐
   │                              Navegador                                 │
   │  Next.js (React) rodando dentro do Cloudflare Container do front       │
   └───────┬──────────────────────────────────────────────────┬────────────┘
           │ HTTPS (serve HTML/JS/assets)                       │ fetch() com
           │                                                     │ Authorization: Bearer <ID Token>
           ▼                                                     ▼
┌───────────────────────────┐                     ┌───────────────────────────────────┐
│  Cloudflare Worker (front)  │                     │   Cloudflare Worker (back)         │
│  fraldinha-livre-frontend    │                     │   fraldinha-livre-backend           │
│  ────────────────────────    │                     │   ──────────────────────────        │
│  container-worker.ts          │                     │   Hono + CORS restrito               │
│  roteia p/ Durable Object       │                     │   valida JWT via JWKS do Firebase      │
│  (Container, max_instances=1)     │                     │   (stateless, sem SDK admin)             │
│         │                          │                     │        │                                │
│         ▼                          │                     │        ▼                                │
│  Container Docker (Next.js          │                     │   D1 (SQL) — orders/order_items/         │
│  standalone, porta 8080)             │                     │   products, via Drizzle ORM               │
└───────────────────────────┘                     └───────────────────────────────────┘
```

## 2. Componentes e responsabilidades

| Componente | Onde mora | Responsabilidade | O que NÃO faz |
|---|---|---|---|
| **Firebase Auth** | Google Cloud (gerenciado) | Login Google, emite/renova o ID Token (JWT) | Não guarda dados de negócio |
| **Firestore** (`users/{uid}`) | Google Cloud (gerenciado), região `southamerica-east1` | Perfil do usuário (nome, CPF, CNPJ, razão social, endereço) | Não guarda pedidos/produtos/estoque — isso é D1 |
| **Worker `fraldinha-livre-frontend`** | Cloudflare edge | Serve o Next.js (SSR/estático) via Container | Não valida JWT, não fala com D1 diretamente |
| **Container do front** (Docker) | Cloudflare Containers (Durable Object `FrontendContainer`) | Roda o Next.js standalone (`node server.js`) | Sem estado persistente próprio — se cair, sobe do zero |
| **Worker `fraldinha-livre-backend`** | Cloudflare edge | API REST (Hono): `/health`, `/products`, `/orders/*` | Não serve HTML/frontend |
| **D1** (`fraldinha-livre-db`) | Cloudflare, região `ENAM` (Eastern North America) | Tabelas `orders`, `order_items`, `products` | Não é acessível fora do binding do Worker — sem endpoint público direto |

## 3. Conexões entre módulos (fluxos reais)

1. **Login:** navegador → popup do Google → Firebase Auth → devolve `AuthUser` + ID Token (JWT,
   renovado automaticamente pelo SDK client). Nenhum servidor nosso participa desse passo.
2. **Leitura/escrita de perfil:** navegador → Firestore direto (SDK client, `getDoc`/`updateDoc` em
   `front/src/contexts/auth-context.tsx`) — sem passar pelo Worker do backend. Protegido só por
   `firestore.rules` (ver seção 4).
3. **Chamada à API de negócio** (produtos, pedidos): navegador → `fetch()` para
   `fraldinha-livre-backend.romariobc.workers.dev`, com `Authorization: Bearer <ID Token>` (exceto
   `GET /products`, público, sem auth). Cross-origin de verdade — front e back são dois Workers com
   hostnames diferentes, então **CORS se aplica normalmente**, mesmo os dois estando na mesma conta
   Cloudflare (correção registrada em D-029 — "mesma nuvem" não elimina CORS, CORS é sobre origem).
4. **Validação do token no backend:** Worker back → busca o JWKS público do Firebase
   (`securetoken@system.gserviceaccount.com`, via `jose`/`createRemoteJWKSet`, cacheado no escopo do
   módulo) → verifica assinatura/issuer/audience → extrai `uid`. **Server-to-server, não passa pelo
   navegador; não usa Firebase Admin SDK nem service account.**
5. **Persistência de negócio:** Worker back → D1 via binding nativo (Drizzle ORM) — não é uma
   chamada de rede pública, é um binding interno da Cloudflare.
6. **Servir o frontend:** navegador → Worker front (`container-worker.ts`) → `getRandom` escolhe uma
   instância do Durable Object `FrontendContainer` → roteia pro container Docker rodando
   `node server.js` (Next.js standalone) na porta 8080.

## 4. Requisitos de segurança

- **Sem sessão/cookie — só Bearer token.** O backend nunca guarda estado de sessão; cada request
  carrega o próprio JWT. Isso é o que permite o Worker ser 100% stateless (ver seção 6).
- **Verificação de JWT sem SDK admin.** `back/src/middleware/auth.ts` usa `jose` contra o JWKS
  público do Firebase — não precisa de service account, não há chave privada pra vazar nesse
  caminho. **Se algum dia o backend precisar escrever no Firestore** (hoje não precisa — ver
  `estado-backend-proxima-frente` e a revisão do Gemini registrada em `progresso.md`
  2026-07-25), aí sim entraria uma service account, e ela **tem** que ser um Wrangler secret
  (`wrangler secret put`), nunca var em texto plano no `wrangler.jsonc` nem no repo.
- **Firestore rules (D-013):** só `users/{uid}` existe; só o dono do `uid` lê/escreve o próprio doc;
  `role` é imutável após criado (`request.resource.data.role == resource.data.role`); `delete`
  sempre bloqueado. Nenhuma outra coleção tem regra — logo nenhuma outra coleção é gravável pelo
  client (só por uma ferramenta com credencial admin, como o MCP do Firebase usado em sessões
  anteriores para testes pontuais).
- **CORS restrito por regex** no backend (`ALLOWED_ORIGIN` em `back/src/index.ts`) — aceita só
  `localhost` (dev) e `*.fraldinha-livre-frontend.romariobc.workers.dev` (produção + preview URLs do
  Workers Builds). Qualquer outra origem é rejeitada mesmo com token válido.
- **Config do Firebase no client é pública por design** (`apiKey`, `authDomain`, etc. em
  `front/src/lib/firebase.ts`, via `NEXT_PUBLIC_*`) — isso é esperado e documentado pelo próprio
  Firebase; a segurança real está nas Firestore Rules e nas regras do Identity Toolkit (domínios
  autorizados), não em esconder essas chaves.
- **Domínios autorizados do Firebase Auth** — pendência aberta: quando o front tiver o domínio de
  produção definitivo, ele precisa ser adicionado em Firebase Console → Authentication → Settings →
  Authorized domains, senão o login Google falha em produção (ver nota da revisão do Gemini,
  `progresso.md` 2026-07-25).
- **Nenhum secret no repo hoje.** `back/wrangler.jsonc` só tem `vars.FIREBASE_PROJECT_ID` (não é
  segredo, é público). Nenhum `wrangler secret` foi configurado ainda porque nenhum fluxo atual
  precisa — o dia que precisar (ex.: chave de pagamento real), documentar aqui o nome da secret e
  onde ela é usada, nunca o valor.

## 5. Rede

- **Tudo HTTPS, sem VPC/rede privada.** Não há peering entre Cloudflare e Google — as duas nuvens só
  se enxergam via chamadas HTTPS públicas (o Worker back busca o JWKS do Firebase publicamente; o
  browser fala com Firestore/Auth publicamente).
- **D1 não tem endpoint de rede público** — só é alcançável via binding do Worker back. Não existe
  "connection string" exposta em lugar nenhum.
- **Perímetro de segurança (WAF/DDoS/TLS) é automático da Cloudflare** para os dois Workers (front e
  back) — foi justamente um dos motivos da escolha da Cloudflare sobre Cloud Run em D-026/D-027 (dá
  de graça o que custaria esforço de configurar numa VM/Cloud Run).
- **Dois hostnames `*.workers.dev` distintos hoje** (front e back) — sem domínio customizado
  configurado ainda em nenhum `wrangler.jsonc`. Se um domínio próprio (ex. `fraldinhalivre.com`) for
  configurado no futuro, atualizar: (a) o regex `ALLOWED_ORIGIN` do back, (b) os Authorized domains
  do Firebase Auth, (c) esta seção.
- **Preview URLs do Workers Builds** (prefixo dinâmico de branch/commit antes do nome do Worker) já
  são aceitas pelo CORS do backend por design — cobertas por teste (`back/test/cors.test.ts`).

## 6. Disponibilidade

- **Backend (Worker back + D1): sem ponto único de falha conhecido.** Workers são stateless e
  rodam distribuídos na edge da Cloudflare; D1 é gerenciado pela Cloudflare (replicação própria da
  plataforma, fora do nosso controle direto).
- **Frontend (Container): ponto único de falha hoje, por decisão de custo/estágio do projeto.**
  `max_instances: 1` em `front/wrangler.jsonc` — só existe UMA instância do container possível.
  Além disso `sleepAfter: "10m"` significa que, sem tráfego por 10 minutos, o container dorme e a
  próxima request paga um cold start (build da imagem já feito, mas precisa subir o container de
  novo). Aceitável para o estágio atual (pré-lançamento, sem SLA formal), mas é a primeira coisa a
  revisar se o tráfego crescer ou se surgir um requisito de disponibilidade mais sério.
- **Firebase Auth/Firestore:** infraestrutura gerenciada pelo Google, fora do nosso controle
  operacional — tratamos como "sempre disponível" pelos propósitos deste projeto.
- **Sem multi-região ativo em nenhuma camada.** D1 está fixado em `ENAM`; Firestore em
  `southamerica-east1`; os Workers rodam na edge (isso já é "multi-região" por natureza do produto,
  não é uma escolha nossa).

## 7. Decisões associadas (ver `decisoes.md` para o raciocínio completo)

- **D-010:** auth via Firebase (não NextAuth).
- **D-026 / D-027:** duas nuvens por domínio — Firebase só auth, Cloudflare Workers+D1 pra dados/API.
- **D-013:** regras de segurança do Firestore (role imutável, delete bloqueado).
- **D-029 → D-030:** frontend também migra pra Cloudflare; tentativa de adapter OpenNext abandonada
  (bug `EvalError` do Firestore/protobufjs no sandbox V8) em favor de Cloudflare Containers (Node.js
  completo, sem esse sandbox).

---

# 8. Custos e limites — Cloudflare Workers Paid

> Fonte: capturas de tela do dashboard Cloudflare (billing), coladas pelo Romario em 2026-07-25.
> Confirmado nesta mesma sessão que o **Plano Pago do Workers está ativo** na conta
> `Romariobc@gmail.com's Account` (verificado via `wrangler containers list` — resposta limpa,
> sem erro de paywall; ver nota em `progresso.md`).
>
> **Regra de uso desta seção:** antes de qualquer tarefa que aumente escala/uso de recursos
> Cloudflare (subir `max_instances`, adicionar KV/Queues, seed em massa no D1, aumentar tráfego
> esperado, ligar Logpush, etc.), checar os limites incluídos abaixo. Se a ação tem chance real de
> ultrapassar o incluso e gerar cobrança de excedente, **avisar o Romario antes de executar**, não
> só documentar depois.

## 8.1 Custo base

**US$ 5,00/mês** — plano Workers Paid.

## 8.2 O que já está incluído no plano (mensal)

| Recurso | Incluído |
|---|---|
| Pages Functions | 10 milhões de solicitações + 30 milhões de ms de CPU |
| Observability (logs do Workers) | 20 milhões de eventos/mês, retenção de 7 dias |
| D1 — armazenamento | 5 GB |
| D1 — linhas lidas | 25 bilhões |
| D1 — linhas gravadas | 50 milhões |
| KV — armazenamento | 1 GB |
| KV — operações de leitura | 10 milhões |
| KV — operações de gravação/exclusão/lista | 1 milhão |
| Durable Objects — solicitações | 1 milhão |
| Durable Objects — duração | 400.000 GB/segundo |
| Durable Objects — dados armazenados | 1 GB |
| Durable Objects — unidades de leitura | 1 milhão |
| Durable Objects — unidades de gravação | 1 milhão |
| Durable Objects — operações de exclusão | 1 milhão |
| Workers Trace Events (logs) | 10 milhões |
| Queues — operações padrão | 1 milhão |
| AI Gateway — logs armazenados | 200.000 |

## 8.3 Preço de excedente (por unidade além do incluído)

### Durable Objects
| Item | Preço |
|---|---|
| Solicitações adicionais | US$ 0,15 / 1 milhão |
| Duração adicional | US$ 12,50 / 1 milhão de GB-segundo |
| Armazenamento adicional | US$ 0,20 / GB |
| Linhas lidas adicionais | US$ 0,00 / 1 milhão (grátis) |
| Linhas gravadas adicionais | US$ 1,00 / 1 milhão |

### KV (armazenamento)
| Item | Preço |
|---|---|
| Armazenamento adicional | US$ 0,50 / GB |
| Operações de leitura adicionais | US$ 0,50 / 1 milhão |
| Operações de gravação/exclusão/lista adicionais | US$ 5,00 / 1 milhão |

### Logpush
| Item | Preço |
|---|---|
| Logs adicionais do Workers Trace Events | US$ 0,05 / 1 milhão |

### Queues
| Item | Preço |
|---|---|
| Operações padrão adicionais | US$ 0,40 / 1 milhão |

### Pages Functions
| Item | Preço |
|---|---|
| Solicitações faturáveis adicionais | US$ 0,30 / milhão |
| Milissegundos de CPU adicionais | US$ 0,02 / milhão |

### D1
| Item | Preço |
|---|---|
| Armazenamento adicional | US$ 0,75 / GB |
| Linhas lidas adicionais | US$ 0,001 / 1 milhão |
| Linhas gravadas adicionais | US$ 1,00 / 1 milhão |

> Captura original cortada na seção D1 — se mais linhas de excedente (ex.: Vectorize, Images,
> Stream, Browser Rendering) forem coladas depois, adicionar aqui em vez de criar arquivo novo.

## 8.4 O que este projeto usa hoje (2026-07-25)

Ligado ao estado real do `back/wrangler.jsonc` e `front/wrangler.jsonc`:

- **D1** (`back`): 1 database (`fraldinha-livre-db`) — 24 produtos + pedidos reais, uso hoje
  irrisório perto dos 5 GB / 25 bilhões de leituras incluídos.
- **Durable Objects** (`front`): usado indiretamente via Cloudflare Containers
  (`FRONTEND_CONTAINER`, classe `FrontendContainer`, `max_instances: 1`) — 1 instância só, uso
  esperado bem abaixo do 1 milhão de solicitações incluído.
- **Observability/logs** (`front` + `back`): `invocation_logs` habilitado nos dois — contam contra
  os 20 milhões de eventos incluídos.
- **KV, Queues, Logpush, AI Gateway**: **não usados** neste projeto até o momento — qualquer PR que
  introduza um desses é a primeira vez que os limites acima passam a valer de verdade (hoje é
  puramente informativo pra eles).

## 8.5 Sinais de alerta a observar (avisar antes de agir se aparecer)

- Subir `max_instances` do Container do front acima de poucas unidades sem estimar tráfego —
  Durable Objects tem cobrança por duração (GB-segundo), não só por request.
- Qualquer seed/migração D1 que grave dezenas de milhões de linhas de uma vez (hoje o maior seed é
  24 produtos).
- Ligar Logpush de verdade (hoje só Workers Trace Events nativo, sem destino externo configurado).
- Adicionar KV ou Queues ao projeto — ainda não existe nenhum binding desse tipo em nenhum dos dois
  `wrangler.jsonc`.
