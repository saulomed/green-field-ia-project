---
kind: phase
name: phase-02-auth
status: clean
issue_count: 0
sources_mtime:
  docs/phases/phase-02-auth/context.md: "2026-08-22T12:58:26Z"
  docs/decisions/technical-decisions-auth.md: "2026-08-22T12:55:20Z"
  docs/decisions/technical-decisions-http-error-contract.md: "2026-08-22T12:55:46Z"
  docs/project-plan.md: "2026-05-30T14:30:22Z"
  docs/decisions/technical-decisions-auth-frontend.md: "2026-08-18T22:04:39Z"
issues:
  - id: IC-1
    status: resolved
    summary: "project-plan.md ainda lista as telas como escopo da fase; auth/TD-09 as adiou"
    resolved_by: clarification
  - id: IC-2
    status: resolved
    summary: "auth/TD-09 declara Capability que a slice não reivindica em covers_capabilities"
    resolved_by: auth/TD-09
  - id: MD-1
    status: resolved
    summary: "Formato de resposta de erro HTTP definido no plano, sem TD que o decida"
    resolved_by: http-error-contract/TD-01
  - id: OQ-1
    status: resolved
    summary: "http-error-contract/TD-01 pending — shape do envelope de resposta de erro HTTP"
    resolved_by: http-error-contract/TD-01
  - id: OQ-2
    status: resolved
    summary: "http-error-contract/TD-02 pending — tipo do campo message (string vs array)"
    resolved_by: http-error-contract/TD-02
  - id: OQ-3
    status: resolved
    summary: "http-error-contract/TD-03 pending — consumo do catálogo de códigos de domínio"
    resolved_by: http-error-contract/TD-03
advisories: []
---

# phase-02-auth — Validation

## Findings

### Inconsistencies

_None._ _(As três TDs de `http-error-contract`, agora decididas, foram reavaliadas contra os 19 TDs decididos de `auth`: a TD-02 (`message` sempre `string`) e a TD-01 (`details` opcional) são aditivas sobre o envelope já implementado e não contradizem nenhuma escolha de runtime existente. O resíduo estrutural que gerou IC-2 — `auth/TD-09` apontando `Capability:` para fora do escopo declarado — foi fechado com o campo trocado para `Transversal — covers:`.)_

### Ambiguities

_None._ _(Os sete bullets reivindicados descrevem fluxos concretos com bordas identificáveis; as políticas que poderiam ser vagas — senha, TTLs, rate limit, colisão de nickname — estão fixadas em `auth/TD-10` a `auth/TD-13`.)_

### Missing Decisions

_None._ _(O sub-tipo "uncovered bullet" não dispara: os sete bullets de `covers_capabilities` têm cobertura por TD decidida em `## Decisions Index`. O sub-tipo "formato de resposta de erro HTTP no primeiro subprojeto que expõe endpoints" — que fechou como `MD-1` — está coberto pelas três TDs decididas de `http-error-contract`. O sub-tipo de contract-sync (Decisão #29) continua não disparando: `## UI Inventory` está no placeholder de deferred, que é caso de never-fires.)_

### Dependency Gaps

_None._ _(As pré-condições vindas da Fase 01 — config namespaced tipada, validação Joi, fundação TypeORM com migrations — estão cobertas por `config/TD-01` a `config/TD-04` em `## Inherited Decisions Detail`, e o namespace `mail` já existia para o serviço de e-mail desta fase.)_

### Inherited Constraint Conflicts

_None._ _(Reavaliado agora que as três TDs de `http-error-contract` estão decididas. A `TD-03` (frontend deriva os códigos de domínio de `lib/api/schema.d.ts`, sem mirror escrito à mão) reforça `next-frontend-api-typing/TD-02` e `TD-03` e o princípio de comunicação dirigida por contrato do `CLAUDE.md`, em vez de contrariá-los; nenhum TD herdado define envelope de erro, então `TD-01` e `TD-02` não têm com o que colidir. Os TDs de backend da slice seguem estendendo as convenções da Fase 01 — `auth/TD-04` e `auth/TD-19` operam sobre o TypeORM com `synchronize: false`, e a configuração de auth/mail segue o namespacing de `config/TD-02`.)_

### Unresolved Open Questions

_None._ _(Nenhum TD em escopo está `pending`: 19 decididos em `technical-decisions-auth.md` e 3 em `technical-decisions-http-error-contract.md`. O Check 6 de inventário não roda — `## UI Inventory` está no placeholder de deferred, sem `### Open Questions from Inventory`.)_

### UI Coverage Gaps

_None._ _(Check 7 não roda: `## UI Inventory` carrega o placeholder de deferred, escolha explícita do usuário. A capability das telas está registrada em `## Non-UI / Deferred Capabilities`.)_

### Capability Consistency (slicing, phase mode only)

_None._ _(Check 8.a rodou sobre as duas slices da Fase 02 — conjunto `S_phase ∩ S_2` = {`auth`, `auth-frontend`}. As sete entradas de `covers_capabilities` de `auth` e a única de `auth-frontend` casam verbatim com os oito bullets da `### Fase 02` em `docs/project-plan.md`, sem sobreposição.)_

## Cross-slice Advisories

_None._ _(Check 8.b: a união de `covers_capabilities` das slices `auth` e `auth-frontend` cobre os 8 bullets da Fase 02 — `expected \ covered` é vazio.)_

## Resolved Issues

- **IC-1** _(resolved_by clarification)_ — "project-plan.md ainda lista as telas como escopo da fase; auth/TD-09 as adiou". Resolvida pela adoção do modelo de slicing: o bullet das telas continua em `docs/project-plan.md` como escopo da Fase 02, e agora **é** entregue pela fase — pela slice irmã `auth-frontend`, que o reivindica em `covers_capabilities` e tem inventário e TDs próprios. A contradição que a issue descrevia (plano promete telas, fase entrega backend-only) deixou de existir sem que nada precisasse ser editado no plano. O resíduo estrutural — `auth/TD-09` ainda apontar seu campo `Capability:` para esse bullet — foi reaberto como IC-2, que é uma questão diferente.
- **MD-1** _(resolved_by http-error-contract/TD-01)_ — "Formato de resposta de erro HTTP definido no plano, sem TD que o decida". Resolvida por `/research auth`, que criou `docs/decisions/technical-decisions-http-error-contract.md` (`scope_type: ad-hoc`, `related_phases: [2]`) com três TDs `Cross-layer`. A pesquisa mostrou que o problema não era uma decisão só: além do shape do envelope (TD-01), estavam abertos o tipo do campo `message` (TD-02 — o `ValidationPipe` do NestJS 11 devolve array onde as `DomainException` devolvem string) e o modo de consumo dos códigos de domínio pelo frontend (TD-03). A doc é ad-hoc e não uma TD dentro de `technical-decisions-auth.md` porque o envelope é contrato herdado por toda fase seguinte, não propriedade da slice de backend da Fase 02.
- **IC-2** _(resolved_by auth/TD-09)_ — "auth/TD-09 declara Capability que a slice não reivindica em covers_capabilities". Resolvida trocando o `**Capability:**` da TD-09 de "Telas de cadastro, login, confirmação de conta e recuperação de senha" para `Transversal — covers:` com os sete bullets que a slice reivindica. A decisão (Option A — backend-only) **não** mudou — é drift de campo estrutural, não de escolha —, então a resolução foi classificada como `Append revision`, e uma terceira entrada foi acrescentada ao bloco `**Revisions:**` da TD-09 registrando a troca e o motivo. O adiamento das telas segue descrito na prosa da TD e registrado em `## Non-UI / Deferred Capabilities`.
- **OQ-1** _(resolved_by http-error-contract/TD-01)_ — Envelope de erro decidido: **Option B**, `{ statusCode, error, message, details }`, com `details` opcional no formato `[{ field, message }]` apenas para erro com granularidade por campo. Mudança aditiva sobre o que já está implementado; as 8 suítes e2e existentes seguem válidas sem edição. Implica alterar `nestjs-project/src/common/filters/http-exception.filter.ts` para popular `details`.
- **OQ-2** _(resolved_by http-error-contract/TD-02)_ — Tipo de `message` decidido: **Option A**, sempre `string`. O filtro normaliza a saída do `ValidationPipe` — as violações por campo migram para `details` e `message` recebe uma frase única de nível de formulário. Elimina a união `string | string[]` que hoje existe entre `DomainException` e `ValidationPipe`, e o tipo gerado da spec passa a ser `message: string` sem narrowing no consumidor.
- **OQ-3** _(resolved_by http-error-contract/TD-03)_ — Consumo dos códigos de domínio decidido: **Option A**, enum no backend emitido na spec OpenAPI pelos decoradores de `openapi-spec/TD-07`, com o frontend derivando de `lib/api/schema.d.ts`. Nenhum mirror escrito à mão, coerente com o princípio de comunicação dirigida por contrato do `CLAUDE.md`. Bibliotecas registradas: `@nestjs/swagger`, `openapi-typescript`.

## Nota de cobertura desta revisão

Dois resíduos cosméticos em `context.md`, ambos fora do escopo de escrita do `/plan-resolve` e ambos sem efeito sobre as checagens desta revisão:

1. A oitava linha de `## Capability Coverage` ("Telas de cadastro…") aparece com `—` na coluna `Covered by`. O gate de cobertura **não** foi disparado sobre ela: sob o modelo de slicing, o gate desta slice se aplica aos sete bullets que ela declara em `covers_capabilities`, e os sete estão cobertos. A oitava linha consta apenas para dar a visão da fase completa e é propriedade de `auth-frontend`.
2. As células de `## Capability Coverage` ainda anotam as três TDs de `http-error-contract` como `_(pending)_`, e a nota de rodapé da seção repete isso. O `## Decisions Index` — que é a fonte que o Check 3 e o Check 6 leem — já as registra como `decided`. A anotação defasada é reescrita no próximo `/plan-context auth`.
