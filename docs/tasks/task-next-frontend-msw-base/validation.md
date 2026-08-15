---
kind: task
name: task-next-frontend-msw-base
status: clean
issue_count: 0
sources_mtime:
  docs/tasks/task-next-frontend-msw-base/context.md: "2026-08-15 16:21:06.344349050 -0300"
  docs/decisions/technical-decisions-next-frontend-msw-base.md: "2026-08-15 16:08:55.132346818 -0300"
issues:
  - id: IC-1
    status: resolved
    summary: "## Scope do context.md está defasado do scope_description pós-resolve"
    resolved_by: plan-context-regeneration
  - id: AMB-1
    status: resolved
    summary: "Escopo não diz se o contrato de teste diferido de lib/env.ts é entregue aqui"
    resolved_by: clarification
  - id: AMB-2
    status: resolved
    summary: "Escopo não diz se o primeiro route handler do BFF entra, sem ele a lane de integração fica vazia"
    resolved_by: clarification
  - id: OQ-1
    status: resolved
    summary: "TD-01 pendente — separação dos ambientes de execução do Vitest (node vs DOM)"
    resolved_by: next-frontend-msw-base/TD-01
  - id: OQ-2
    status: resolved
    summary: "TD-02 pendente — biblioteca de DOM da lane de browser (jsdom vs happy-dom)"
    resolved_by: next-frontend-msw-base/TD-02
  - id: OQ-3
    status: resolved
    summary: "TD-03 pendente — tipagem dos handlers MSW a partir do contrato OpenAPI"
    resolved_by: next-frontend-msw-base/TD-03
  - id: OQ-4
    status: resolved
    summary: "TD-04 pendente — superfície de fake da lane de browser (rotas relativas do BFF)"
    resolved_by: next-frontend-msw-base/TD-04
---

# task-next-frontend-msw-base — Validation

## Findings

### Inconsistencies

_None._

> O check de órfão `Scope-Subsection` foi avaliado e não dispara: TD-01, TD-02 e TD-04 têm `Scope: Frontend` e o `## UI Inventory` está no placeholder **logic-only**, combinação que normalmente acusaria órfão — mas os três declaram `**Renders in:** frontend-runtime` explicitamente, que é a subseção efetivamente emitida nesse estado.

### Ambiguities

_None._

> O `## Scope` agora nomeia as inclusões e as exclusões, e as quatro decisões fixam o ferramental. Os entregáveis são deriváveis sem consulta: `vitest.config.ts` com dois projetos, os `setupFiles` por lane, `mocks/handlers.ts` + `mocks/bff-handlers.ts` + `mocks/server.ts`, o script `test`, a linha de `loadEnvConfig`, a reexportação de `paths` em `lib/api/contracts.ts`, as dependências novas e os seis casos de teste de `lib/env.ts`.

### Missing Decisions

_None._

> O que resta em aberto é implementação resolvida a montante, não decisão estratégica: nomes de script e filosofia de cobertura vêm de `references/file-conventions.md`; as dependências de render (`@vitejs/plugin-react`, Testing Library, `jest-dom`, `vite-tsconfig-paths`) são as do guia oficial de Vitest do Next.js; e o carregamento de env no teste é a `next-frontend-env-config/TD-05`, herdada e já decidida.

### Dependency Gaps

_None — `DG-N` não se aplica em modo task (não há linhagem de fases)._

### Inherited Constraint Conflicts

_None._

> Os quatro TDs decididos foram confrontados com as convenções herdadas e com os TDs de `api-typing`, `env-config` e da Fase 02. O único ponto de atrito real — a TD-03 precisar de `paths`, que a `api-typing/TD-02` mantém confinado a `lib/api/` — foi eliminado dentro da própria decisão, ao fixar a reexportação por `lib/api/contracts.ts` em vez de um carve-out. A TD-01 também convive com a `env-config/TD-05`: `loadEnvConfig()` roda no topo do `vitest.config.ts` e os dois projetos herdam a raiz por `extends: true`.

### Unresolved Open Questions

_None._

### UI Coverage Gaps

_None — o `## UI Inventory` está em **logic-only**, estado em que `UIG-N` é semanticamente impossível (não há verbos a cobrir por construção)._

## Resolved Issues

- **IC-1** _(resolved_by plan-context-regeneration)_ — O `## Scope` do `context.md` estava com a prosa pré-resolve enquanto o `scope_description` já carregava as resoluções de AMB-1 e AMB-2. Corrigido regenerando o `context.md`; as duas prosas agora coincidem, e o `/plan-build` passa a enxergar tanto o contrato de teste de `lib/env.ts` quanto as duas exclusões.
- **AMB-1** _(resolved_by clarification)_ — O contrato de teste diferido de `lib/env.ts` **está no escopo desta task**: quatro casos de `lib/env.ts` mais dois do export `config`, conforme `docs/tasks/task-next-frontend-env-config/progress.md` (SI-3 e SI-4). É o primeiro teste que a lane de `node` recebe, e prova por execução as ACs que a env-config fechou sem runner.
- **AMB-2** _(resolved_by clarification)_ — O primeiro route handler do BFF **fica fora desta task**, que entrega ferramental puro, preservando o `CLAUDE.md` § Scope Limits. Consequência aceita: a lane de integração e o `mocks/bff-handlers.ts` nascem sem nenhum teste que os exercite. A task que criar o primeiro route handler é dona do primeiro teste de integração e do primeiro handler de BFF.
- **OQ-1** _(resolved_by next-frontend-msw-base/TD-01)_ — Option A: `test.projects` com dois projetos inline (`node` sobre `app/api/**` + `lib/**`; DOM sobre `components/**` + `hooks/**`), ambos com `extends: true` e `setupFiles` próprio.
- **OQ-2** _(resolved_by next-frontend-msw-base/TD-02)_ — Option A: `jsdom`. Traz a consequência de corrigir o template de `vitest.config.ts` da skill `testing-guide-next-frontend`, que hoje diz `happy-dom`.
- **OQ-3** _(resolved_by next-frontend-msw-base/TD-03)_ — Option A: `openapi-msw`, com `paths` reexportado por `lib/api/contracts.ts` (sem carve-out na regra de importação). Verificar na instalação a compatibilidade com `msw` 2.x e `openapi-typescript` 7.13.0.
- **OQ-4** _(resolved_by next-frontend-msw-base/TD-04)_ — Option B: `mocks/handlers.ts` (upstream, tipado) + `mocks/bff-handlers.ts` (rotas relativas), compostos por lane via os `setupFiles` da TD-01.
