# Diretrizes de Agentes de IA — Fraldinha Livre

Este repositório possui regras e diretrizes de desenvolvimento estruturadas para coordenar múltiplos agentes concorrentes.

---

## 1. Regras de Desenvolvimento Next.js
Consulte a regra em [.agents/rules/nextjs-rules.md](file:///.agents/rules/nextjs-rules.md).

---

## 2. Habilidades de Domínio (Custom Skills)

Sub-agentes que atuem em domínios ou diretórios específicos **devem invocar** a respectiva habilidade antes de tomar qualquer ação:

| Diretório / Escopo de Trabalho | Habilidade a Invocar | Caminho do Guia de Habilidade |
|---|---|---|
| `src/components/fornecedor/` ou `src/app/(main)/fornecedor/` | `Skill(domain-fornecedor)` | [.agents/skills/domain-fornecedor/SKILL.md](file:///.agents/skills/domain-fornecedor/SKILL.md) |
| `src/components/minha-conta/` ou `src/app/(main)/minha-conta/` | `Skill(domain-comprador)` | [.agents/skills/domain-comprador/SKILL.md](file:///.agents/skills/domain-comprador/SKILL.md) |
| `src/components/catalogo/` ou `src/app/(main)/catalogo/` | `Skill(domain-catalogo)` | [.agents/skills/domain-catalogo/SKILL.md](file:///.agents/skills/domain-catalogo/SKILL.md) |
| Criação ou modificação de componentes de UI | `Skill(ui-system)` | [.agents/skills/ui-system/SKILL.md](file:///.agents/skills/ui-system/SKILL.md) |
| Delegação ou disparo de sub-agentes concorrentes | `Skill(paralelize)` | [.agents/skills/paralelize/SKILL.md](file:///.agents/skills/paralelize/SKILL.md) |
| Migração de dados mockados para endpoints reais (REST) | `Skill(api-contract)` | [.agents/skills/api-contract/SKILL.md](file:///.agents/skills/api-contract/SKILL.md) |
| Modificar qualquer arquivo de Zona de Risco (`src/lib/`, `src/contexts/`, `src/components/ui/`, `tailwind.config.ts`, layout compartilhado) | `Skill(risk-zone-protocol)` | [.agents/skills/risk-zone-protocol/SKILL.md](file:///.agents/skills/risk-zone-protocol/SKILL.md) |
