---
kind: phase
name: phase-02-auth-frontend
status: clean
issue_count: 0
sources_mtime:
  docs/phases/phase-02-auth-frontend/context.md: "2026-08-22T14:44:05Z"
  docs/decisions/technical-decisions-auth-frontend.md: "2026-08-18T22:04:39Z"
  docs/decisions/technical-decisions-http-error-contract.md: "2026-08-22T14:35:43Z"
  docs/project-plan.md: "2026-05-30T14:30:22Z"
  docs/decisions/technical-decisions-auth.md: "2026-08-22T12:55:20Z"
issues:
  - id: IC-6
    status: resolved
    summary: "3 TDs de http-error-contract citam Capability fora do escopo desta slice"
    resolved_by: http-error-contract/TD-01|TD-02|TD-03
  - id: IC-7
    status: resolved
    summary: "`details` da TD-01 não tem consumidor: auth-frontend/TD-11 manda 400 pro root"
    resolved_by: http-error-contract/TD-01
  - id: DG-2
    status: resolved
    summary: "Mudança no http-exception.filter.ts decidida mas sem dono em nenhum artefato"
    resolved_by: clarification
  - id: IC-5
    status: resolved
    summary: "Recommendation da TD-07 contradiz sua Decision (Adiada) no bloco que o build lê"
    resolved_by: auth-frontend/TD-07
  - id: OQ-24
    status: resolved
    summary: "Inventário: estado de sucesso do cadastro não existe no Figma"
    resolved_by: clarification
  - id: OQ-25
    status: resolved
    summary: "Inventário: superfície de erro em nível de formulário exigida pela TD-11 não modelada"
    resolved_by: clarification
  - id: IC-4
    status: resolved
    summary: "Inventário não tem o extension run que auth-frontend/TD-09 exige"
    resolved_by: screen_inventory_extension_run
  - id: IC-3
    status: resolved
    summary: "Non-UI / Deferred Capabilities vazia, mas TD-07 declara registro ali"
    resolved_by: deferred_capability
  - id: OQ-23
    status: resolved
    summary: "auth-frontend/TD-11 pendente — formato do corpo de erro do BFF"
    resolved_by: auth-frontend/TD-11
  - id: MD-2
    status: resolved
    summary: "Nenhuma TD define o formato de erro dos route handlers do BFF"
    resolved_by: auth-frontend/TD-11
  - id: MD-1
    status: resolved
    summary: "Destino pós-cadastro bem-sucedido não é decidido por nenhuma TD"
    resolved_by: auth-frontend/TD-09
  - id: DG-1
    status: resolved
    summary: "E2E full-stack (TD-08) exige reset de banco entre runs; ninguém provê"
    resolved_by: auth-frontend/TD-10
  - id: IC-1
    status: resolved
    summary: "auth/TD-09 manda confirmação direto para a API, mas a capability exige tela"
    resolved_by: deferred_capability
  - id: IC-2
    status: resolved
    summary: "auth/TD-09 aponta link de reset para /reset-password, página não planejada"
    resolved_by: deferred_capability
  - id: OQ-1
    status: resolved
    summary: "auth-frontend/TD-01 pendente — mecanismo de submissão dos formulários"
    resolved_by: auth-frontend/TD-01
  - id: OQ-2
    status: resolved
    summary: "auth-frontend/TD-02 pendente — adoção do openapi-fetch no BFF"
    resolved_by: auth-frontend/TD-02
  - id: OQ-3
    status: resolved
    summary: "auth-frontend/TD-03 pendente — propagação dos cookies de sessão"
    resolved_by: auth-frontend/TD-03
  - id: OQ-4
    status: resolved
    summary: "auth-frontend/TD-04 pendente — renovação do access token"
    resolved_by: auth-frontend/TD-04
  - id: OQ-5
    status: resolved
    summary: "auth-frontend/TD-05 pendente — fronteira de guarda de sessão"
    resolved_by: auth-frontend/TD-05
  - id: OQ-6
    status: resolved
    summary: "auth-frontend/TD-06 pendente — biblioteca de formulário e schema"
    resolved_by: auth-frontend/TD-06
  - id: OQ-7
    status: resolved
    summary: "auth-frontend/TD-07 pendente — destino do link de confirmação"
    resolved_by: auth-frontend/TD-07
  - id: OQ-8
    status: resolved
    summary: "auth-frontend/TD-08 pendente — provisionamento do stack E2E"
    resolved_by: auth-frontend/TD-08
  - id: OQ-9
    status: resolved
    summary: "auth-frontend/TD-09 pendente — destino do usuário após o cadastro"
    resolved_by: auth-frontend/TD-09
  - id: OQ-10
    status: resolved
    summary: "auth-frontend/TD-10 pendente — ciclo de vida do banco entre runs E2E"
    resolved_by: auth-frontend/TD-10
  - id: OQ-11
    status: resolved
    summary: "Inventário: tela de confirmação de conta fora do escopo por decisão"
    resolved_by: deferred_capability
  - id: OQ-12
    status: resolved
    summary: "Inventário: tela /reset-password não existe no Figma"
    resolved_by: deferred_capability
  - id: OQ-13
    status: resolved
    summary: "Inventário: placeholder do campo de senha do login diz 'Enter your email'"
    resolved_by: clarification
  - id: OQ-14
    status: resolved
    summary: "Inventário: rodapé 'Remember your password?' linka 'Sign up'"
    resolved_by: clarification
  - id: OQ-15
    status: resolved
    summary: "Inventário: card do cadastro nomeado 'Login' no Figma"
    resolved_by: clarification
  - id: OQ-16
    status: resolved
    summary: "Inventário: toggle de senha no cadastro, ausente no login"
    resolved_by: clarification
  - id: OQ-17
    status: resolved
    summary: "Inventário: BackLink sem destino definido em cadastro e reset"
    resolved_by: clarification
  - id: OQ-18
    status: resolved
    summary: "Inventário: nenhuma tela declara variante de loading/disabled no submit"
    resolved_by: clarification
  - id: OQ-19
    status: resolved
    summary: "Inventário: nenhuma tela declara erro de validação inline no TextField"
    resolved_by: clarification
  - id: OQ-20
    status: resolved
    summary: "Inventário: tela de reset não declara mensagem de sucesso pós-envio"
    resolved_by: clarification
  - id: OQ-21
    status: resolved
    summary: "Inventário: links Terms of Service e Privacy Policy sem destino"
    resolved_by: clarification
  - id: OQ-22
    status: resolved
    summary: "Inventário: a11y do medidor de força de senha e do toggle não anotada"
    resolved_by: clarification
advisories: []
---

# phase-02-auth-frontend — Validation

## Findings

### Inconsistencies

_None._ _(IC-6 e IC-7 fecharam neste ciclo. A IC-6 não volta a disparar: o `Capability: Transversal — covers:` das três TDs de `http-error-contract` agora inclui o bullet das telas. A IC-7 fechou por Revision que documenta a divergência dentro da própria TD-01. Nenhuma nova contradição entre TDs decididas: a `auth-frontend/TD-11` (repassa o corpo verbatim) e a `http-error-contract/TD-02` (`message` sempre `string`) continuam se reforçando, e a `TD-01` Option B é aditiva sobre o envelope já implementado.)_

### Ambiguities

_None._ _(O bullet único da slice é desdobrado em 3 telas e 6 verbos concretos no `## UI Inventory`, e as onze TDs de `auth-frontend` fixam mecanismo de submissão, cliente HTTP, cookies, refresh, guarda, formulários, E2E e formato de erro. Nada exige a pergunta "qual X?" antes de derivar SIs.)_

### Missing Decisions

_None._ _(O bullet único tem cobertura por 14 TDs decididas — as 11 de `auth-frontend` mais as 3 de `http-error-contract`, que passaram a constar no `## Capability Coverage` depois da regeneração de 2026-08-22. O sub-tipo de formato de erro HTTP está fechado em duas camadas: `http-error-contract/TD-01`–`TD-03` para a API e `auth-frontend/TD-11` para os route handlers do BFF. O sub-tipo de contract-sync (Decisão #29) **não** dispara mesmo com `ui_in_scope: true`: `http-error-contract/TD-03` é `Cross-layer` e sua Topic/Recommendation casam o heurístico de palavras-chave (`contrato`, `spec`, `OpenAPI`, `codegen`), e as herdadas `openapi-spec/TD-05` e `next-frontend-api-typing/TD-01` já fixavam a estratégia.)_

### Dependency Gaps

_None._ _(DG-2 fechou por clarificação: esta slice assume o trabalho de backend do envelope de erro. Nenhuma nova lacuna — as pré-condições da Fase 01 (config tipada, Joi, TypeORM com migrations) e da slice irmã `auth` (API de auth entregue, Mailpit no ambiente para a E2E da `TD-08`) estão todas satisfeitas.)_

### Inherited Constraint Conflicts

_None._ _(As TDs desta slice estendem as herdadas em vez de contrariá-las: `auth-frontend/TD-03` reemite os cookies lendo nome e TTL do `Set-Cookie` upstream, preservando `auth/TD-03` e `auth/TD-15` como donos dos valores; `auth-frontend/TD-06` deriva o schema Zod de `contracts.ts`, honrando `next-frontend-api-typing/TD-02` e `TD-03`; `auth-frontend/TD-11` repassa o corpo verbatim, que é o que `http-error-contract/TD-02` torna tipável sem narrowing. As convenções herdadas de configuração e TypeORM não são tocadas por esta slice.)_

### UI Coverage Gaps

_None._ _(Check 7 rodou com o digest populado. O único bullet de `## Capability Coverage` tem cobertura por TD **e** seis verbos no `### UI ↔ Capability Join`, então a condição 2 falha por construção. As duas superfícies faltantes — tela de confirmação e `/reset-password` — estão registradas em `## Non-UI / Deferred Capabilities` com status `deferred`, o que também satisfaz a condição 3 de nunca-dispara.)_

### Capability Consistency (slicing, phase mode only)

_None._ _(Check 8.a rodou sobre as duas slices da Fase 02 — `S_phase ∩ S_2` = {`auth`, `auth-frontend`}. A única entrada de `covers_capabilities` de `auth-frontend` e as sete de `auth` casam verbatim com os oito bullets da `### Fase 02` em `docs/project-plan.md`, sem sobreposição.)_

## Cross-slice Advisories

_None._ _(Check 8.b: a união de `covers_capabilities` das duas slices cobre os 8 bullets da Fase 02 — `expected \ covered` é vazio. **Os sete `MC-cross-1` a `MC-cross-7` que esta slice carregava em aberto foram eliminados**: eles existiam porque a doc `technical-decisions-auth.md` não declarava `covers_capabilities`, de modo que os sete bullets de backend não eram reivindicados por slice nenhuma. A declaração foi acrescentada em 2026-08-22 e o gap fechou.)_

## Resolved Issues

- **IC-1** _(resolved_by deferred_capability)_ — "auth/TD-09 manda confirmação direto para a API, mas a capability exige tela".
- **IC-2** _(resolved_by deferred_capability)_ — "auth/TD-09 aponta link de reset para /reset-password, página não planejada".
- **IC-3** _(resolved_by deferred_capability)_ — "Non-UI / Deferred Capabilities vazia, mas TD-07 declara registro ali". As duas linhas gravadas então seguem preservadas no `context.md` a cada regeneração, com a justificativa registrada in-file.
- **IC-4** _(resolved_by screen_inventory_extension_run)_ — "Inventário não tem o extension run que auth-frontend/TD-09 exige".
- **IC-5** _(resolved_by auth-frontend/TD-07)_ — "Recommendation da TD-07 contradiz sua Decision (Adiada) no bloco que o build lê". Resolvida por Revision que reescreveu a Recommendation preservando o texto original citado.
- **MD-1** _(resolved_by auth-frontend/TD-09)_ — "Destino pós-cadastro bem-sucedido não é decidido por nenhuma TD".
- **MD-2** _(resolved_by auth-frontend/TD-11)_ — "Nenhuma TD define o formato de erro dos route handlers do BFF".
- **DG-1** _(resolved_by auth-frontend/TD-10)_ — "E2E full-stack (TD-08) exige reset de banco entre runs; ninguém provê".
- **OQ-1** a **OQ-10** _(resolved_by auth-frontend/TD-01 a TD-10)_ — as dez TDs da slice estavam `pending` e foram decididas.
- **OQ-11** e **OQ-12** _(resolved_by deferred_capability)_ — tela de confirmação e `/reset-password`, ambas registradas como `deferred`.
- **OQ-13** a **OQ-22** _(resolved_by clarification)_ — inconsistências de copy no Figma, divergências entre telas irmãs, estados não modelados e a11y não anotada.
- **OQ-23** _(resolved_by auth-frontend/TD-11)_ — "auth-frontend/TD-11 pendente — formato do corpo de erro do BFF".
- **OQ-24** e **OQ-25** _(resolved_by clarification)_ — estado de sucesso do cadastro e superfície de erro em nível de formulário, ambos sem nó no Figma.

- **IC-6** _(resolved_by http-error-contract/TD-01, TD-02, TD-03)_ — "3 TDs de http-error-contract citam Capability fora do escopo desta slice". Resolvida por `Append revision` nas três: o campo `Capability: Transversal — covers:` de cada uma foi estendido com o bullet "Telas de cadastro, login, confirmação de conta e recuperação de senha". Nenhuma decisão mudou (B / A / A) — é drift de campo estrutural, não de escolha. Com o bullet no lugar, o `/plan-build auth-frontend` agrupa as três sob a capability da slice em vez de descartá-las.
- **IC-7** _(resolved_by http-error-contract/TD-01)_ — "`details` da TD-01 não tem consumidor: auth-frontend/TD-11 manda 400 pro root". Resolvida por `Append revision` na TD-01, registrando que `details` é **contrato preparado, sem consumidor nesta fase**. A Option B é mantida: o campo fica disponível para o primeiro consumidor que precisar de granularidade por campo, e a divergência entre a justificativa da TD-01 e o que a `auth-frontend/TD-11` de fato faz passa a estar documentada na própria TD em vez de só na validação.
- **DG-2** _(resolved_by clarification)_ — "Mudança no http-exception.filter.ts decidida mas sem dono em nenhum artefato". Resolvida sem edição de TD: **esta slice assume o trabalho**. O `/plan-build auth-frontend` deve escrever SIs de `nestjs-project` — alterar `src/common/filters/http-exception.filter.ts` para popular `details` (TD-01) e normalizar `message` para `string` (TD-02), declarar os códigos de domínio como enum no `ErrorResponseDto` (TD-03 + `auth-frontend/TD-11`), regerar `openapi.json` e rodar `scripts/generate-api-types.sh` — **ordenadas antes** das SIs de tela, que dependem do tipo gerado. O `## Scope` do `context.md` já declara `nestjs-project` em Affected subprojects, então a fronteira está registrada.

## Nota desta revisão

Revalidação após `/plan-context auth-frontend`. A única mudança no `context.md` foi o `## Capability Coverage`, que passou a listar as três TDs de `http-error-contract` sob o bullet das telas — consequência da Revision que a IC-6 aplicou nos campos `Capability:`. Os oito checks rodaram contra o arquivo regenerado e nenhum disparou.

Estado acumulado: 36 issues resolvidas, 0 abertas, 0 advisories. Check 8 confirmou de novo que a união de `covers_capabilities` das slices `auth` e `auth-frontend` cobre os 8 bullets da Fase 02, sem sobreposição e sem sobra.

**Correção de premissa, mantida do ciclo anterior.** A IC-6 alegava que as TDs de `http-error-contract` ficariam órfãs no artefato porque "o `/plan-build` agrupa TDs pelo campo `Capability:`". Isso está errado: o `plan-build` A2 filtra `## Decisions Detail` por **`Scope:` + `Renders in:` + `ui_in_scope`**, e as três são `Scope: Cross-layer`, o que as renderiza em `### API Contracts` incondicionalmente. Nunca houve risco de orfandade. A edição aplicada continua correta pelo mérito — as telas de fato consomem o envelope, o tipo de `message` e o enum de códigos —, e o efeito real de tê-la propagado até esta tabela é outro: o **B2** agora enxerga as três ao decompor a capability em SIs, o que antes não aconteceria.

**O que o `/plan-build` continua não lendo.** A ordenação decidida na DG-2 — filtro → enum no `ErrorResponseDto` → regerar `openapi.json` → `generate-api-types.sh` → SIs de tela — está registrada apenas em `## Resolved Issues` deste arquivo, e o `plan-build` lê `context.md`, não `validation.md`. A dependência é inferível do `### API Contracts` e do `**Affected subprojects:**`, mas a **ordem** precisa ser conferida no `## Dependency Map` que o build produzir.
