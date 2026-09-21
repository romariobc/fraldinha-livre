# Spec — Footer condicional + auditoria de links + páginas "Em construção"

**Dominio:** ui-system / layout | **Feature relacionada:** 015 | **Status:** aprovada (direcao do cliente 2026-07-03)

## Contexto

Feedback de UX do cliente (2026-07-03): (1) o Footer completo deve aparecer explicitamente **só na
página inicial**; nas demais áreas fica **recolhido com opção de expandir**. (2) Todos os links do
site devem ter rota e conteúdo; onde faltar, criar uma página genérica **"Em construção"** e
registrar como pendência. Filosofia: caminho feliz rápido, detalhes depois.

## Regras de negócio

- **RN-01 (Footer condicional)** `Footer` vira client component e usa `usePathname()`:
  - Em `/` (home): renderiza o footer completo (atual), sempre visível.
  - Nas demais rotas: renderiza **recolhido** — uma barra fina com o `© ...` + um botão/chevron
    "Rodapé" que **expande/recolhe** o grid completo inline (`useState`, começa recolhido). Sem
    duplicar o markup do grid (um único bloco condicionado por `expanded || isHome`).

- **RN-02 (correção dos links do Footer)** Ajustar os hrefs:
  - Navegação: Início `/` · Sobre Nós `/#sobre` · Produtos `/catalogo` · Depoimentos `/#depoimentos`.
  - Ajuda: FAQ `/#faq` · Contato `/contato` · Política de Privacidade `/privacidade` · Termos de Uso `/termos`.
  - Para fornecedores: Seja um parceiro `/cadastro` · Acesso ao painel `/login` · Como funciona `/como-funciona`.

- **RN-03 (componente "Em construção")** Criar `components/EmConstrucao.tsx` — recebe `titulo` e
  renderiza um placeholder amigável (ícone, "Página em construção", texto curto "Estamos preparando
  esta página", CTA "Voltar ao início" → `/`), no estilo visual do projeto (brand).

- **RN-04 (rotas "Em construção")** Criar as rotas que faltam, cada uma renderizando `EmConstrucao`
  com o título apropriado: `app/(main)/privacidade/page.tsx` ("Política de Privacidade"),
  `app/(main)/termos/page.tsx` ("Termos de Uso"), `app/(main)/como-funciona/page.tsx`
  ("Como funciona"). Ficam sob o layout `(main)` (herdam Header/Footer).

- **RN-05 (auditoria dos demais links)** Conferir os links do `Header` (NAV_LINKS) e quaisquer
  outros `href` no site. Os do Header (`/`, `/catalogo`, `/#sobre`, `/#depoimentos`, `/#faq`,
  `/contato`, `/login`, `/cadastro`) já resolvem — confirmar. Qualquer outro `href="#"` ou rota
  inexistente encontrado: apontar para a rota real, ou para uma página "Em construção", e listar no
  relatório.

## Critérios de aceite

- [ ] Home mostra o footer completo; demais páginas mostram footer recolhido com expandir/recolher funcional
- [ ] Nenhum link do Footer aponta para `/` errado nem para `#`; todos resolvem para rota real ou "Em construção"
- [ ] `/privacidade`, `/termos`, `/como-funciona` existem e renderizam o componente "Em construção"
- [ ] `npm run lint` EXIT 0; `npm run build` passa e lista as 3 novas rotas
- [ ] Gating (013), auth (005a) e perfil (007a) não regridem

## Fora de escopo

- Conteúdo real de Privacidade/Termos/Como funciona (fica como pendência documentada — ver
  `licoes-e-diretrizes.md`, seção pendências).
- Redesign do footer; só visibilidade condicional + correção de links.

## Referências

- Código: `components/Footer.tsx`, `components/Header.tsx`, `app/(main)/page.tsx` (âncoras sobre/depoimentos/faq)
- Pendências registradas em `licoes-e-diretrizes.md`
