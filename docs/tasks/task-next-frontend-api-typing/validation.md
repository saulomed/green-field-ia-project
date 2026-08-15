---
kind: task
name: task-next-frontend-api-typing
status: clean
issue_count: 0
sources_mtime:
  docs/tasks/task-next-frontend-api-typing/context.md: "2026-08-15T16:16:46Z"
  docs/decisions/technical-decisions-next-frontend-api-typing.md: "2026-08-15T16:15:37Z"
issues:
  - id: OQ-1
    status: resolved
    summary: "TD-01 pendente — pipeline de codegen (onde o .d.ts é gerado, por quem)"
    resolved_by: next-frontend-api-typing/TD-01
  - id: OQ-2
    status: resolved
    summary: "TD-02 pendente — contrato do BFF para os componentes"
    resolved_by: next-frontend-api-typing/TD-02
  - id: OQ-3
    status: resolved
    summary: "TD-03 pendente — validação de runtime na fronteira BFF↔NestJS"
    resolved_by: next-frontend-api-typing/TD-03
---

# task-next-frontend-api-typing — Validation

## Findings

### Inconsistencies

_None._

### Ambiguities

_None._

### Missing Decisions

_None._

### Inherited Constraint Conflicts

_None._

### Unresolved Open Questions

_None._

### UI Coverage Gaps

_None._ — `## UI Inventory` está no estado logic-only; TD-02 e TD-03 têm `Scope: Frontend` mas carregam `Renders in: frontend-runtime`, então o orphan-check da Check 1 não dispara e a Check 7 é inaplicável por construção (não há verbos a cobrir).

## Resolved Issues

- **OQ-1** _(resolved_by next-frontend-api-typing/TD-01)_ — pipeline de codegen decidido: **Option A** — script na raiz do repositório gera `next-frontend/lib/api/schema.d.ts`, versionado, com drift verificado no CI. Libraries: `openapi-typescript`.
- **OQ-2** _(resolved_by next-frontend-api-typing/TD-02)_ — contrato do BFF decidido: **Option B** — `lib/api/contracts.ts` deriva o contrato de cada rota `/api/...` dos tipos gerados via `Pick`/`Omit`/`Extract`. Sem dependência nova.
- **OQ-3** _(resolved_by next-frontend-api-typing/TD-03)_ — validação de runtime decidida: **Option A** — sem validação de runtime por ora; reavaliar quando existir codegen de schemas Zod a partir da spec.
