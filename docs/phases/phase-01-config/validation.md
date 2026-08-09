---
kind: phase
name: phase-01-config
status: dirty
issue_count: 3
sources_mtime:
  docs/phases/phase-01-config/context.md: "2026-08-08T20:55:11Z"
  docs/decisions/technical-decisions-config.md: "2026-08-08T20:15:50Z"
issues:
  - id: MD-1
    status: open
    summary: "Capability 'Repositório com estrutura de monorepo' sem TD que a cubra"
  - id: MD-2
    status: open
    summary: "Capability 'Fundação de IA para coding.' sem TD que a cubra"
  - id: AMB-1
    status: open
    summary: "'Fundação de IA para coding.' não define artefatos nem critério de pronto"
---

# phase-01-config — Validation

## Findings

### Inconsistencies

_None._

### Ambiguities

- **AMB-1** — A capability `Fundação de IA para coding.` não descreve o que precisa existir para considerá-la entregue: não nomeia artefatos, formatos nem critério de pronto. Um implementador teria de perguntar "quais ativos de IA? documentados onde? verificados como?" antes de decompor em SIs. Explicit choice: detalhar o bullet em `docs/project-plan.md` enumerando os ativos esperados (skills, rules, MCP, `CLAUDE.md`) e o artefato de saída, e então rerodar `/plan-context 1`.

### Missing Decisions

- **MD-1** — A capability `Repositório com estrutura de monorepo (frontend e backend)` não é citada pelo campo `Capability:` de nenhum TD em `## Decisions Index`. A estrutura do monorepo envolve escolhas estratégicas reais e cross-component (workspace manager, localização do `compose.yaml`, config TS compartilhada, hooks de git, layout de `.env`) que a categoria **Repo-wide** do `/research` cobre. Explicit choice: rodar `/research config` para adicionar um TD com `Scope: Repo-wide` cobrindo a estrutura do monorepo; ou, se a estrutura for considerada consequência direta do stack sem alternativa real, documentar isso explicitamente e reduzir o bullet em `docs/project-plan.md`.

- **MD-2** — A capability `Fundação de IA para coding.` não é citada pelo campo `Capability:` de nenhum TD. Explicit choice: rodar `/research config` para adicionar um TD cobrindo a fundação de IA (que ativos são versionados, como skills externas são travadas, como o MCP é configurado); ou marcar a capability como não-estratégica em `docs/project-plan.md` se ela for puramente documental. Ver também AMB-1 — resolver a ambiguidade primeiro provavelmente torna esta decisão evidente.

### Dependency Gaps

_None._ _(Fase 01 é a primeira do projeto — não há linhagem anterior da qual depender.)_

### Inherited Constraint Conflicts

_None._ _(Nenhuma fase anterior; `## Inherited Conventions` vazio.)_

### Unresolved Open Questions

_None._ _(Todos os 4 TDs de `config` estão `decided`.)_

### UI Coverage Gaps

_None._ _(Sem escopo de UI — `## UI Inventory` ausente no context.md; UIG-N não é um conceito aplicável.)_

## Resolved Issues

_No issues resolved yet._
