---
kind: task
name: task-next-frontend-env-config
status: clean
issue_count: 0
sources_mtime:
  docs/tasks/task-next-frontend-env-config/context.md: "2026-08-10T10:44:08Z"
  docs/decisions/technical-decisions-next-frontend-env-config.md: "2026-08-10T10:30:53Z"
issues:
  - id: AMB-1
    status: resolved
    summary: "Escopo não diz se esta task bootstrapa o Vitest ou o assume existente"
    resolved_by: clarification
  - id: OQ-1
    status: resolved
    summary: "TD-01 pending — acesso à config e enforcement da fronteira server/client"
    resolved_by: next-frontend-env-config/TD-01
  - id: OQ-2
    status: resolved
    summary: "TD-02 pending — biblioteca de validação do schema de ambiente"
    resolved_by: next-frontend-env-config/TD-02
  - id: OQ-3
    status: resolved
    summary: "TD-03 pending — organização das variáveis (arquivo único vs namespaces)"
    resolved_by: next-frontend-env-config/TD-03
  - id: OQ-4
    status: resolved
    summary: "TD-04 pending — resolução das públicas: build time vs runtime"
    resolved_by: next-frontend-env-config/TD-04
  - id: OQ-5
    status: resolved
    summary: "TD-05 pending — carregamento da configuração no ambiente de teste"
    resolved_by: next-frontend-env-config/TD-05
  - id: IC-1
    status: resolved
    summary: "Scope prose ainda anuncia 'carregamento em teste' que a TD-05 tirou do escopo"
    resolved_by: clarification
  - id: ICC-1
    status: resolved
    summary: "TD-02 (Zod) contraria convenção herdada de validação com Joi da fase 01"
    resolved_by: config/TD-03
  - id: ICC-2
    status: resolved
    summary: "TD-01 (createEnv) contraria convenção herdada de registerAs + ConfigType"
    resolved_by: config/TD-01
---

# task-next-frontend-env-config — Validation

## Findings

### Inconsistencies

_None._

_Nota sobre o Scope-Subsection orphan check:_ os quatro TDs `Scope: Frontend` sob `## UI Inventory` logic-only continuam não orfanando — TD-01 tem `Renders in: frontend-runtime` explícito e TD-02/TD-03/TD-05 sem marcador resolvem para o mesmo destino por inferência padrão. Os quatro TDs de `openapi-spec` com `Renders in: ui-contracts` que entraram nesta rodada **não** disparam a checagem: ela lê o `## Decisions Index`, que carrega apenas TDs de escopo corrente, e esses são herdados.

### Ambiguities

_None._ — o `## Scope` reescrito agora declara explicitamente que a implementação do carregamento em teste é delegada à task de MSW, eliminando a pergunta que um implementador teria de fazer.

### Missing Decisions

_None._ — os cinco eixos da prosa de escopo seguem mapeados um-a-um para TD-01 a TD-05, todos decididos. O sub-tipo de contract-sync de tipos compartilhados (Decisão #29) é exclusivo de phase mode e não se aplica aqui.

### Dependency Gaps

_None._ — `DG-N` nunca é emitido em task mode.

### Inherited Constraint Conflicts

_None._

_Nota (observação não emitida):_ o `## Inherited Conventions` ainda carrega, literalmente, _"Configuração acessada exclusivamente via namespaces tipados (`registerAs` + `ConfigType`)"_ e _"Validação de ambiente com Joi no boot"_. Esses bullets são um **snapshot** lido do `context.md` da fase 02 e não absorvem as Revisions de 2026-08-10 — só mudariam se a fase 02 fosse reprocessada com `/plan-context`. O conflito está materialmente resolvido porque `## Inherited Decisions Detail` agora carrega `config/TD-01` e `config/TD-03` **com** as Revisions delimitadoras, que são o registro autoritativo e vencem por especificidade e recência. Um leitor deste contexto vê os dois textos e a delimitação junto.

### Unresolved Open Questions

_None._ — nenhum TD permanece `pending`.

### UI Coverage Gaps

_None._ — `## UI Inventory` carrega o placeholder logic-only; a checagem é pulada por construção.

## Resolved Issues

- **AMB-1** _(resolved_by clarification)_ — O bootstrap do ferramental de teste (`vitest.config.ts`, `vitest.setup.ts`) **não** pertence a esta task. O escopo fica reduzido aos quatro eixos de configuração; a TD-05 permanece decidida aqui como **convenção**, e sua materialização em disco pertence à pesquisa de MSW, que já vai tocar `mocks/` e `vitest.setup.ts`. Evita que duas tasks disputem os mesmos arquivos.
- **OQ-1** _(resolved_by next-frontend-env-config/TD-01)_ — TD-01 decidido: Option C, `@t3-oss/env-nextjs`. Fronteira server/client passa a ser estrutural.
- **OQ-2** _(resolved_by next-frontend-env-config/TD-02)_ — TD-02 decidido: Option A, Zod v4. Escolha consciente contra a convenção herdada da fase 01 sobre Joi; produziu o `ICC-1`, resolvido depois via Revision.
- **OQ-3** _(resolved_by next-frontend-env-config/TD-03)_ — TD-03 decidido: Option C, namespacing no objeto exportado com arquivo único.
- **OQ-4** _(resolved_by next-frontend-env-config/TD-04)_ — TD-04 decidido: Option C, sem URL pública; o browser consome apenas o BFF. `NEXT_PUBLIC_API_BASE_URL` é removida. Streaming e download (Fases 03 e 05) ficam fora desta decisão.
- **OQ-5** _(resolved_by next-frontend-env-config/TD-05)_ — TD-05 decidido: Option A, `loadEnvConfig()` de `@next/env` + `.env.test` versionado com hosts fictícios. Implementação delegada à task de MSW, conforme AMB-1.
- **IC-1** _(resolved_by clarification)_ — `scope_description` reescrito em `docs/decisions/technical-decisions-next-frontend-env-config.md`: o quinto eixo passa a ser descrito como "convenção de carregamento de env no ambiente de teste, cuja implementação é delegada à task de MSW". Confirmado nesta revisão — o `## Scope` regenerado reflete o novo texto.
- **ICC-1** _(resolved_by config/TD-03)_ — Revision de 2026-08-10 anexada a `config/TD-03` delimitando a escolha de **Joi** ao `nestjs-project/`. O que rege o monorepo passa a ser o comportamento (validação no boot que derruba a aplicação), não a biblioteca. A TD-02 permanece em Zod v4.
- **ICC-2** _(resolved_by config/TD-01)_ — Revision de 2026-08-10 anexada a `config/TD-01` separando as duas metades da convenção: o mecanismo `registerAs`/`ConfigType` fica restrito ao `nestjs-project/`, e o princípio "sem `process.env` disperso, concentrado num loader único" é promovido a transversal. A TD-01 permanece em `@t3-oss/env-nextjs`. Completa a delimitação iniciada pela Revision de 2026-08-09 em `config/TD-02`.
