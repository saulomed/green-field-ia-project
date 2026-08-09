---
kind: phase
name: phase-02-auth
status: dirty
issue_count: 2
sources_mtime:
  docs/phases/phase-02-auth/context.md: "2026-08-08T20:56:25Z"
  docs/decisions/technical-decisions-auth.md: "2026-08-08T20:43:00Z"
issues:
  - id: IC-1
    status: open
    summary: "project-plan.md ainda lista as telas como escopo da fase; auth/TD-09 as adiou"
  - id: MD-1
    status: open
    summary: "Formato de resposta de erro HTTP definido no plano, sem TD que o decida"
---

# phase-02-auth — Validation

## Findings

### Inconsistencies

- **IC-1** — O escopo lista a capability `Telas de cadastro, login, confirmação de conta e recuperação de senha`, enquanto `auth/TD-09` decidiu **backend-only** ("telas adiadas"). A contradição está registrada em `## Non-UI / Deferred Capabilities` com `Status: deferred`, então não é um conflito silencioso — mas `docs/project-plan.md` continua declarando as telas como entregável da Fase 02, o que fará qualquer releitura futura do plano divergir do que foi entregue. Explicit choice: (a) mover o bullet das telas para a fase de frontend em `docs/project-plan.md` e rerodar `/plan-context 2`; (b) manter o bullet e aceitar que a Fase 02 o cobre apenas por adiamento documentado em `auth/TD-09`.

### Ambiguities

_None._ _(As 8 capabilities descrevem fluxos concretos com bordas identificáveis; as políticas de limite que poderiam ser vagas — senha, TTLs, rate limit, colisão de nickname — foram fixadas em `auth/TD-10` a `auth/TD-13`.)_

### Missing Decisions

- **MD-1** — Esta é a primeira fase a expor endpoints HTTP no `nestjs-project`, e o formato de resposta de erro (`{ statusCode, error, message }`, com `error` carregando o código de domínio) está definido apenas na prosa do plano (`## Technical Specifications → ### Error Catalog` e SI-02.1) — nenhum TD, atual ou herdado, o decide. É um contrato transversal que todas as fases seguintes herdam e que o frontend futuro vai consumir, exatamente o tipo de escolha cross-component que a regra "(a) contrato cross-component" do `/research` manda manter como TD. Explicit choice: rodar `/research auth` para adicionar um TD com `Scope: Cross-layer` que fixe o envelope de erro e a semântica do campo `error`, registrando o formato já implementado como a opção escolhida.

### Dependency Gaps

_None._ _(As pré-condições vindas da Fase 01 — config namespaced tipada, validação Joi, fundação TypeORM com migrations — estão cobertas por `config/TD-01` a `config/TD-04` em `## Inherited Decisions Detail`, e o namespace `mail` já existia para o serviço de e-mail desta fase.)_

### Inherited Constraint Conflicts

_None._ _(Os TDs desta fase estendem as convenções herdadas em vez de contrariá-las: `auth/TD-04` e `auth/TD-19` operam sobre o TypeORM com `synchronize: false` da Fase 01, e a configuração de auth/mail segue o namespacing de `config/TD-02`.)_

### Unresolved Open Questions

_None._ _(Os 19 TDs de `auth` estão `decided`; não há inventário de telas do qual ingerir open questions.)_

### UI Coverage Gaps

_None._ _(`## UI Inventory` carrega o placeholder de deferred — o usuário optou explicitamente por adiar o sync UI↔API, então UIG-N não dispara. A capability das telas já está registrada em `## Non-UI / Deferred Capabilities`.)_

## Resolved Issues

_No issues resolved yet._
