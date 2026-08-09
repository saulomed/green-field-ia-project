---
kind: task
name: task-openapi-spec
status: clean
issue_count: 0
sources_mtime:
  docs/tasks/task-openapi-spec/context.md: "2026-08-08T21:34:22Z"
  docs/decisions/technical-decisions-openapi-spec.md: "2026-08-08T21:32:44Z"
issues:
  - id: IC-1
    status: resolved
    summary: "4 TDs Cross-layer puramente backend cairiam em ### Frontend Runtime por inferência"
    resolved_by: marker_ui_contracts
  - id: ICC-1
    status: resolved
    summary: "Script do TD-04 sobe o app inteiro; DB host Compose e Joi restringem onde ele roda"
    resolved_by: openapi-spec/TD-04
  - id: AMB-1
    status: resolved
    summary: "Escopo não delimita se o codegen do TD-05 é implementado ou só decidido"
    resolved_by: deferred_capability
  - id: OQ-1
    status: resolved
    summary: "TD-01 pending — origem da verdade do contrato (code-first vs spec-first)"
    resolved_by: openapi-spec/TD-01
  - id: OQ-2
    status: resolved
    summary: "TD-02 pending — metadados dos DTOs (CLI plugin vs decorators)"
    resolved_by: openapi-spec/TD-02
  - id: OQ-3
    status: resolved
    summary: "TD-03 pending — exposição do Swagger UI e política por ambiente"
    resolved_by: openapi-spec/TD-03
  - id: OQ-4
    status: resolved
    summary: "TD-04 pending — emissão do openapi.json como artefato"
    resolved_by: openapi-spec/TD-04
  - id: OQ-5
    status: resolved
    summary: "TD-05 pending — estratégia de codegen do contrato no frontend"
    resolved_by: openapi-spec/TD-05
  - id: OQ-6
    status: resolved
    summary: "TD-06 pending — esquema de segurança na spec (cookie auth)"
    resolved_by: openapi-spec/TD-06
  - id: OQ-7
    status: resolved
    summary: "TD-07 pending — documentação das respostas de erro"
    resolved_by: openapi-spec/TD-07
---

# task-openapi-spec — Validation

## Findings

### Inconsistencies

_None._

_O IC-1 da rodada anterior foi fechado pelos marcadores `**Renders in:** ui-contracts` em TD-01/TD-04/TD-06/TD-07. Sob `ui_in_scope: logic-only` os quatro renderizam em `### API Contracts` pela regra Cross-layer e ficam fora do `### Frontend Runtime`; o TD-05, sem marcador, herda o default `frontend-runtime`, que é o correto. O check de órfão Scope-Subsection permanece inaplicável: nenhum TD tem `Scope: Frontend` estrito — sua precondição de disparo._

### Ambiguities

_None._

### Missing Decisions

_None._

### Dependency Gaps

_None._

_`DG-N` nunca dispara em task mode._

### Inherited Constraint Conflicts

_None._

_Com os 7 TDs decididos, o check foi reexecutado contra `## Inherited Conventions` e os 19 TDs de `## Inherited Decisions Detail`. O ICC-1 anterior foi fechado pela Revision de 2026-08-08 no TD-04 (geração sob demanda, dentro do container), que passa a honrar explicitamente as convenções de host Compose e de validação Joi no boot. Os demais convergem: TD-03 usa `registerAs` + namespace tipado; TD-06 declara `addCookieAuth` fiel a `auth/TD-03` e `auth/TD-15`; TD-02 apoia-se no `class-validator` de `auth/TD-11`; TD-07 documenta o `429` alinhado a `auth/TD-08`/`auth/TD-13`; TD-05 não colide com `auth/TD-09` (backend-only) porque sua adoção está registrada como `deferred`._

### Unresolved Open Questions

_None._

_Zero `_[pending]_` no decisions doc — os 7 TDs estão decididos. `## UI Inventory` em logic-only não contribui Open Questions de inventário._

### UI Coverage Gaps

_None._

_Pulado por construção: `## UI Inventory` tem o token-anchor `_Frontend-runtime only —` (logic-only), estado em que o `UIG-N` é semanticamente impossível._

## Resolved Issues

- **IC-1** _(resolved_by marker_ui_contracts)_ — TD-01, TD-04, TD-06 e TD-07 receberam `**Renders in:** ui-contracts` no decisions doc. Mantêm `Scope: Cross-layer` (os quatro expõem contrato que o frontend consome) e, sob `ui_in_scope: logic-only`, renderizam em `### API Contracts` pela regra Cross-layer sem cair em `### Frontend Runtime`. Só o TD-05 herda o default `frontend-runtime`, que é o correto — é o único genuinamente de runtime de frontend. Marcadores propagados para `## Decisions Detail` e para a coluna `Renders in` do `## Decisions Index` no context.md.
- **ICC-1** _(resolved_by openapi-spec/TD-04)_ — Revision anexada ao TD-04 (mesma Option B; mudou o parâmetro de *quando* o script roda): a geração do `openapi.json` é **sob demanda**, um script standalone invocado manualmente dentro do container, nunca um hook de `postbuild` nem etapa obrigatória do pipeline. Isso dissolve o conflito com as convenções herdadas — o custo de exigir Postgres, Mailpit e o schema Joi completo é pago só quando a spec precisa ser regerada, em vez de acoplar todo `nest build` à infraestrutura.
- **AMB-1** _(resolved_by deferred_capability)_ — O TD-05 fixa a **estratégia** de codegen (`openapi-typescript` + `openapi-fetch`), mas a **adoção** no `next-frontend/` fica diferida até as telas entrarem em escopo. Registrado como linha `deferred` em `## Non-UI / Deferred Capabilities` do context.md. Nenhuma SI desta task toca o subprojeto de frontend.
- **OQ-1** _(resolved_by openapi-spec/TD-01)_ — Option A: code-first com `@nestjs/swagger`; a spec é derivada do código via `SwaggerModule.createDocument()`.
- **OQ-2** _(resolved_by openapi-spec/TD-02)_ — Option C: CLI plugin `@nestjs/swagger/plugin` (com `classValidatorShim` e `introspectComments`) como base, `@ApiProperty()` apenas como override pontual.
- **OQ-3** _(resolved_by openapi-spec/TD-03)_ — Option B: Swagger UI habilitado por flag num namespace `swagger` (`enabled` + `path`) via `registerAs`, validado no Joi; desligado em produção por padrão.
- **OQ-4** _(resolved_by openapi-spec/TD-04)_ — Option B: script `openapi:generate` roda sobre o `nest build`, faz bootstrap sem `listen()` e escreve `nestjs-project/openapi.json`, versionado no repositório. _(Ver a Revision de 2026-08-08 registrada via ICC-1: execução sob demanda, não a cada build.)_
- **OQ-5** _(resolved_by openapi-spec/TD-05)_ — Option A: `openapi-typescript` (tipos) + `openapi-fetch` (client tipado). Estratégia fixada; adoção diferida (ver AMB-1).
- **OQ-6** _(resolved_by openapi-spec/TD-06)_ — Option A: `addCookieAuth` com o nome real do cookie de access token, endpoints marcados com `@ApiCookieAuth`, e UI com `swaggerOptions.withCredentials: true`.
- **OQ-7** _(resolved_by openapi-spec/TD-07)_ — Option B: decoradores compostos por perfil de erro (`@ApiAuthErrors`, `@ApiValidationErrors`, `@ApiThrottled`) via `applyDecorators`, sobre um `ErrorResponseDto` compartilhado.
