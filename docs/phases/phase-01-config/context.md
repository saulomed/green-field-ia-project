---
kind: phase
name: phase-01-config
sources_mtime:
  docs/project-plan.md: "2026-05-30T14:30:22Z"
  docs/decisions/technical-decisions-config.md: "2026-08-08T20:15:50Z"
  .claude/skills/testing-guide-nestjs-project/SKILL.md: "2026-08-08T20:01:09Z"
---

# phase-01-config — Context

## Scope

**Phase name:** Configuração Base do Projeto

**Capabilities** (literal, `docs/project-plan.md`):

- Repositório com estrutura de monorepo (frontend e backend)
- Projeto Next.js (frontend) (será criado depois, não agora) e Nest.js (backend) inicializados
- Ambiente de desenvolvimento local com todos os serviços via Docker Compose
- Estrutura inicial do banco de dados PostgreSQL (schema, migrations e seeds) (sem tabelas ainda)
- Fundação de IA para coding.

**Out of scope:** não declarado em `docs/project-plan.md` para esta fase.

**Deliverables:** ambiente de desenvolvimento funcional, banco de dados configurado.

**Affected subprojects:** `nestjs-project/`

**Deferred subprojects:** `next-frontend/` — a própria capability declara que o Next.js "será criado depois, não agora".

**Sequencing notes:** primeira fase do projeto; não depende de nenhuma anterior.

**Neighbors (for boundary detection only):**

- **Phase 00:** — _(não existe; esta é a primeira fase)_
- **Phase 02:** Cadastro, Login e Gerenciamento de Conta — depende desta fase; consome a config namespaced e a fundação de TypeORM aqui estabelecidas.

## Decisions Index

| Ref | Source | Scope | Topic | Status | Decision | Libraries |
|-----|--------|-------|-------|--------|----------|-----------|
| config/TD-01 | phase | Backend | Estratégia de acesso tipado à configuração | decided | B | @nestjs/config |
| config/TD-02 | phase | Backend | Organização das variáveis (namespacing por domínio) | decided | B | @nestjs/config |
| config/TD-03 | phase | Backend | Biblioteca/abordagem de validação do schema | decided | A | joi |
| config/TD-04 | phase | Backend | Configuração em contextos fora do container DI (CLI TypeORM e seeds) | decided | B | typeorm |

_Source files:_

- config — `docs/decisions/technical-decisions-config.md` (scope_type: phase, related_phases: [1])

## Capability Coverage

| Capability (from project-plan.md) | Covered by |
|-----------------------------------|------------|
| Repositório com estrutura de monorepo (frontend e backend) | — _(no TD yet — plan-validate will flag as MD)_ |
| Projeto Next.js (frontend) (será criado depois, não agora) e Nest.js (backend) inicializados | config/TD-01, config/TD-02 |
| Ambiente de desenvolvimento local com todos os serviços via Docker Compose | config/TD-01, config/TD-02, config/TD-03 |
| Estrutura inicial do banco de dados PostgreSQL (schema, migrations e seeds) (sem tabelas ainda) | config/TD-04 |
| Fundação de IA para coding. | — _(no TD yet — plan-validate will flag as MD)_ |

## Decisions Detail

### config/TD-01

**Recommendation:** `registerAs` + `ConfigType` é o padrão oficial do NestJS 11, dá tipagem forte sem manutenção manual de getters e já resolve a organização por domínio (TD-02).
**Libraries:** @nestjs/config

### config/TD-02

**Recommendation:** agrupar por domínio (`app` com `PORT`/`NODE_ENV`, `database`, `mail`) prepara o terreno para as próximas fases sem refatorar depois; é o complemento natural da TD-01 B. _(Depende de TD-01.)_
**Libraries:** @nestjs/config

### config/TD-03

**Recommendation:** já está instalado, validando o boot e cobrindo defaults/coerção; trocar agora adiciona dependência e retrabalho sem ganho proporcional. A tipagem forte vem da TD-01 (B), não da lib de validação.
**Libraries:** joi

### config/TD-04

**Recommendation:** uma função pura compartilhada elimina a duplicação atual de `DB_*` entre `database.module.ts`, `data-source.ts` e `seed.ts`, mantendo CLI e app sempre alinhados.
**Libraries:** typeorm

## Inherited Decisions Detail

_No inherited TD details._

## Inherited Conventions

_(nenhuma fase anterior — esta é a Fase 01)_

## Inherited Deferred Capabilities

_No inherited deferred capabilities._

## Non-UI / Deferred Capabilities

| Capability | Status | Rationale | TD refs |
|-----------|--------|-----------|---------|

_None._

## Testing Requirements

### nestjs-project

| Artifact type | Required layers |
|---------------|-----------------|
| Entities (`*.entity.ts`) | Integration (real DB) |
| Services (`*.service.ts`) | Unit and/or Integration |
| Modules (`*.module.ts`) | Unit (compilation) |
| Controllers (`*.controller.ts`) | E2E only |
| DTOs (`*.dto.ts`) | E2E (validation wiring) |
| Guards (`*.guard.ts`) | E2E or Unit+E2E |
| Strategies (`*.strategy.ts`) | E2E (via guard) |
| Pipes (`*.pipe.ts`) | Unit |
| Interceptors (`*.interceptor.ts`) | Unit and/or E2E |
| Filters (`*.filter.ts`) | Unit + E2E |
| Middleware (`*.middleware.ts`) | E2E |

### next-frontend

_Deferred subproject — fora do escopo desta fase (o Next.js só é inicializado depois). A skill `testing-guide-next-frontend` já existe e será consumida pela fase que trouxer o frontend para o escopo._
