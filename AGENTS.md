<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

<!-- BEGIN:domain-skills -->
## Domain Skills

Sub-agents working on a specific domain MUST invoke the corresponding skill
before taking any action:

| Working in | Invoke |
|---|---|
| `src/components/fornecedor/` or `src/app/(main)/fornecedor/` | `Skill(domain-fornecedor)` |
| `src/components/minha-conta/` or `src/app/(main)/minha-conta/` | `Skill(domain-comprador)` |
| `src/components/catalogo/` or `src/app/(main)/catalogo/` | `Skill(domain-catalogo)` |
| Any UI component or layout work | `Skill(ui-system)` |
| Dispatching parallel sub-agents | `Skill(paralelize)` |
| Migrating mocks to real API calls | `Skill(api-contract)` |
| Modifying any file in `src/lib/`, `src/components/ui/`, `tailwind.config.ts`, or shared layout | `Skill(risk-zone-protocol)` |
<!-- END:domain-skills -->
