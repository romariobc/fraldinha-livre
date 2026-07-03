# Fraldinha Livre

## O Projeto

Fraldinha Livre é um marketplace de fraldas que implementa um modelo de **licitação reversa**. Fornecedores competem entre si para ganhar pedidos de compradores, oferecendo melhores preços e condições. A plataforma conecta dois perfis principais: **compradores** (hospitais, clínicas, creches) que buscam fraldas com melhor custo-benefício, e **fornecedores** que disponibilizam produtos e participam de leilões para conquistar contratos.

A operação é estruturada em duas fases: primeiro uma **loja marketplace** com catálogo e compras diretas, depois a implementação completa do **leilão reverso** com fila de pedidos, prazos e concorrência entre fornecedores.

## Estrutura de Pastas

- `front/` — aplicação web (Next.js, React, TypeScript)
- `back/` — backend (a implementar)
- `app/` — aplicativo mobile (futuro)
- `legacy/` — protótipo anterior (histórico, não mantido)
- `.claude/` — documentação, decisões e prompts de desenvolvimento

## Como Rodar

```bash
cd front
npm install
npm run dev
```

A aplicação estará disponível em http://localhost:3000.

## Stack

- **Frontend:** Next.js 16, React 19, TypeScript, Tailwind 3, shadcn/Base UI
- **Dados:** mock em `front/src/lib/` (backend pendente — backend será integrado na feature 006)

## Infraestrutura

Frontend e backend serão hospedados no **Google Cloud** (Cloud Run, Firestore, Cloud Storage, Firebase Auth/Identity Platform). Ver `.claude/docs/decisoes.md` seção **D-001** para detalhes completos.
