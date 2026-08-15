---
kind: task
name: task-next-frontend-msw-base
test_specs_aware: true
sources_mtime:
  docs/tasks/task-next-frontend-msw-base/context.md: "2026-08-15 16:21:06.344349050 -0300"
  docs/tasks/task-next-frontend-msw-base/library-refs.md: "2026-08-15 16:10:49.680347168 -0300"
  docs/decisions/technical-decisions-next-frontend-msw-base.md: "2026-08-15 16:08:55.132346818 -0300"
  docs/decisions/technical-decisions-next-frontend-api-typing.md: "2026-08-15 13:15:37.640315088 -0300"
  docs/decisions/technical-decisions-next-frontend-env-config.md: "2026-08-10 07:30:53.728007501 -0300"
  docs/phases/phase-02-auth/context.md: "2026-08-08 17:56:25.348038238 -0300"
  .claude/skills/testing-guide-next-frontend/SKILL.md: "2026-08-14 09:19:58.600008267 -0300"
---

# task-next-frontend-msw-base

## Objective

Base de testes do next-frontend com Vitest + MSW: separação de ambientes de execução por lane, biblioteca de DOM, tipagem dos handlers a partir do contrato OpenAPI e superfície de fake das rotas relativas do BFF. Inclui a materialização do contrato de teste diferido de lib/env.ts (seis casos devidos pela next-frontend-env-config), que passa a ser o primeiro teste da lane de node. Não inclui o bootstrap do Playwright nem a criação do primeiro route handler do BFF.

---

## Step Implementations

### SI-1 — Instalar o ferramental de teste (Infra)

**Frontend Runtime spec:** see `## Technical Specifications` → `### Frontend Runtime` → `#### next-frontend-msw-base/TD-01` e `#### next-frontend-msw-base/TD-02`

**Description:** instala as devDependencies do runner, do ambiente de DOM e do MSW tipado, e cria os scripts de teste que o `next-frontend/CLAUDE.md` já documenta como inexistentes.

**Technical actions:**

1. Instalar as devDependencies em `next-frontend/package.json`: `vitest` (per `next-frontend-msw-base/TD-01`), `jsdom` (per `TD-02`), `msw` e `openapi-msw` (per `TD-03`), mais as do guia oficial de Vitest do Next.js — `@vitejs/plugin-react`, `@testing-library/react`, `@testing-library/dom`, `@testing-library/jest-dom`, `vite-tsconfig-paths`. **Requer autorização explícita do usuário** para o procedimento root do `next-frontend/CLAUDE.md` § "Installing Dependencies Inside the Container", seguido imediatamente do `chown -R node:node node_modules .next tsconfig.tsbuildinfo next-env.d.ts`.
2. Confirmar, antes de fixar a versão, a compatibilidade declarada de `openapi-msw` com `msw` 2.x e com a saída de `openapi-typescript` 7.13.0 — verificação exigida nominalmente pela `TD-03`. Divergência de peer range é motivo de parar e reportar, não de forçar a instalação.
3. Acrescentar aos `scripts` de `package.json`: `"test": "vitest run"` e `"test:watch": "vitest"` — os nomes que o `next-frontend/CLAUDE.md` § Commands já publica.

**Tests:** _(empty — Infra)_

**Dependencies:** none

**Acceptance criteria:**

- `docker compose exec next-frontend npm test` deixa de falhar com `npm error Missing script: "test"` e passa a invocar o Vitest.
- `next-frontend/package.json` declara as bibliotecas acima em `devDependencies`, nenhuma delas em `dependencies` — o ferramental de teste não entra no bundle de produção.
- `npx tsc --noEmit`, `npm run lint` e `npm run build` continuam em exit 0 dentro do container após a instalação.
- Nenhum caminho sob `node_modules`, `.next`, `tsconfig.tsbuildinfo` ou `next-env.d.ts` fica com owner `root` ao fim do SI.

---

### SI-2 — Construir a superfície de fake do MSW, tipada pelo contrato (Setup)

**Frontend Runtime spec:** see `## Technical Specifications` → `### Frontend Runtime` → `#### next-frontend-msw-base/TD-03` e `#### next-frontend-msw-base/TD-04`

**Description:** cria os três arquivos de `mocks/` e abre o acesso a `paths` pela porta certa, materializando as duas superfícies separadas que a `TD-04` decidiu e a tipagem por contrato que a `TD-03` decidiu.

**Technical actions:**

1. Acrescentar `export type { paths } from "@/lib/api/schema"` a `next-frontend/lib/api/contracts.ts` (per `next-frontend-msw-base/TD-03`) — é a sub-decisão que mantém a regra de importação de `next-frontend-api-typing/TD-02` sem carve-out para `mocks/`.
2. Criar `next-frontend/mocks/server.ts` — `setupServer()` sem handlers iniciais; a composição por lane é dos `setupFiles` do SI-3.
3. Criar `next-frontend/mocks/handlers.ts` — `createOpenApiHttp<paths>({ baseUrl: config.api.baseUrl })`, com `paths` importado de `@/lib/api/contracts` e `config` de `@/lib/env`, nunca de `process.env`. Declarar o handler de caminho feliz de `POST /auth/login`, hoje a única rota da spec.
4. Criar `next-frontend/mocks/bff-handlers.ts` — array exportado vazio (per `TD-04`), com comentário registrando que nenhuma rota relativa existe enquanto `app/api/` não tiver route handler, e que a task que criar o primeiro é dona do primeiro handler daqui.

**Tests:** _(empty — Setup SI; a prova desta superfície é de build (`tsc`) e está nas ACs; os testes de comportamento vivem no SI-4 e na task que criar o primeiro route handler)_

**Dependencies:** SI-1 — `msw` e `openapi-msw` precisam estar instalados para os módulos compilarem.

**Acceptance criteria:**

- `npx tsc --noEmit` sai 0 com os três arquivos de `mocks/` presentes.
- Trocar o path do handler por um inexistente na spec (`http.get("/unknown", …)`) faz `npx tsc --noEmit` falhar nomeando o arquivo — a tipagem é verificada em build, não decorativa.
- Declarar em `response(200).json(...)` um corpo que não casa com o declarado na spec para o status 200 falha em `npx tsc --noEmit`.
- `grep -rn "lib/api/schema" next-frontend/mocks/` retorna vazio — o acesso a `paths` passa por `contracts.ts`.
- `grep -rn "process.env" next-frontend/mocks/` retorna vazio — a base URL upstream vem de `config.api.baseUrl`.

---

### SI-3 — Configurar as duas lanes de execução do Vitest (Setup)

**Frontend Runtime spec:** see `## Technical Specifications` → `### Frontend Runtime` → `#### next-frontend-msw-base/TD-01` e `#### next-frontend-msw-base/TD-02`

**Description:** cria o `vitest.config.ts` com os dois projetos e os dois `setupFiles`, que é onde a separação de ambientes da `TD-01` e a composição de handlers por lane da `TD-04` de fato acontecem.

**Technical actions:**

1. Criar `next-frontend/vitest.config.ts` — `loadEnvConfig(process.cwd())` no topo do módulo, antes do `defineConfig` (per `next-frontend-env-config/TD-05`); plugins `@vitejs/plugin-react` e `vite-tsconfig-paths` na raiz, para que os dois projetos os herdem por `extends: true` e o alias `@/*` resolva sem duplicação.
2. Declarar os dois projetos em `test.projects` conforme o snippet de Setup da `TD-01`: `node` sobre `app/api/**/__tests__/` + `lib/**/__tests__/`, e `dom` sobre `components/**/__tests__/` + `hooks/**/__tests__/`, cada um com `setupFiles` próprio.
3. Fixar `environmentOptions.jsdom.url` em `http://localhost:3001` no projeto `dom` (per `TD-02`) — o default do `jsdom` é `3000`, que neste projeto é a porta do `nestjs-api`.
4. Criar `next-frontend/vitest.setup.node.ts` — `server.listen({ onUnhandledRequest: "error" })`, `resetHandlers(...handlers)` no `afterEach` e `server.close()` no `afterAll`.
5. Criar `next-frontend/vitest.setup.dom.ts` — mesmo ciclo de vida, mas compondo `...handlers` **e** `...bffHandlers` (per `TD-04`), mais os matchers de `@testing-library/jest-dom` e o `cleanup` da Testing Library.

**Tests:** _(empty — Setup SI; smoke-gated pelas ACs; o comportamento é provado pelo SI-4)_

**Dependencies:** SI-1 (ferramental instalado) + SI-2 (`mocks/server.ts`, `handlers.ts` e `bff-handlers.ts` precisam existir para os `setupFiles` importarem).

**Acceptance criteria:**

- `npx vitest run --project node` e `npx vitest run --project dom` executam sem erro de configuração, mesmo com zero arquivos casados.
- `npx vitest list` mostra os dois projetos nomeados `node` e `dom`.
- Um teste que importe `@/lib/env` sob o projeto `node` avalia o módulo sem lançar — prova de que a lane certa foi escolhida para a fronteira server/client de `@t3-oss/env-core`.
- Nenhum arquivo de teste declara ambiente por docblock (`@vitest-environment`) — a seleção é por caminho.
- `npx tsc --noEmit`, `npm run lint` e `npm run build` continuam em exit 0.

---

### SI-4 — Materializar o contrato de teste diferido de `lib/env.ts`

**Description:** entrega os seis casos que a `next-frontend-env-config` deixou devendo por falta de runner (SI-3 e SI-4 daquela task), provando por execução as ACs que ela fechou apenas por leitura. É o primeiro teste da lane de `node`.

**Technical actions:**

1. Criar `next-frontend/lib/__tests__/env.test.ts` com os quatro casos devidos pelo SI-3 da `next-frontend-env-config`, todos exercendo a validação **no momento da importação** (`vi.resetModules()` + `await import("../env")` por caso): (1) ambiente válido expõe `config.api.baseUrl` com o valor validado; (2) `API_BASE_URL` ausente rejeita a importação com erro que nomeia a variável; (3) `API_BASE_URL` com valor não-URL rejeita a importação; (4) `API_BASE_URL=""` rejeita a importação, provando `emptyStringAsUndefined: true`.
2. Acrescentar ao mesmo arquivo os dois casos devidos pelo SI-4 daquela task, sobre o export `config`: (5) `config.api.baseUrl` reflete o valor validado por `createEnv`; (6) a reatribuição de `config.api.baseUrl` falha no type-check — caso de regressão do `as const`, expresso com `@ts-expect-error`, que falha se o erro deixar de ocorrer.
3. Usar o cast local registrado como armadilha de tipo naquela task para manipular o ambiente por caso — `ProcessEnv` declara `NODE_ENV` como readonly, então a atribuição direta não compila: `const testEnv = () => process.env as Record<string, string | undefined>`.

**Tests:**

| Artifact | Layer | Test file |
|----------|-------|-----------|
| `lib/env.ts` | Unit per `## Testing Requirements` → `lib/` utility with branching — validação no import e superfície pública de `config`, sob `environment: "node"` | `next-frontend/lib/__tests__/env.test.ts` |

**Dependencies:** SI-3 — sem o projeto `node` configurado, o arquivo não roda no ambiente que a fronteira server/client de `@t3-oss/env-core` exige.

**Acceptance criteria:**

- `docker compose exec next-frontend npm test` executa os seis casos e todos passam.
- Remover `API_BASE_URL` de `.env.test` faz a suíte falhar com mensagem que nomeia a variável — a validação derruba a importação em vez de produzir `undefined` silencioso.
- Os seis casos rodam sob `environment: "node"`; forçá-los para a lane de DOM faz a importação de `@/lib/env` lançar, o que documenta a armadilha em vez de escondê-la.
- `npx tsc --noEmit` sai 0 com o arquivo de teste presente.

---

### SI-5 — Alinhar a skill de testes e o `CLAUDE.md` ao ferramental entregue

**Frontend Runtime spec:** see `## Technical Specifications` → `### Frontend Runtime` → `#### next-frontend-msw-base/TD-02` → Migração row para `.claude/skills/testing-guide-next-frontend/SKILL.md`

**Description:** corrige a documentação que a task contradiz. A `TD-02` exige nominalmente essa correção no mesmo commit; sem ela, a skill continua instruindo `happy-dom` e ambiente único, que é exatamente a configuração que a `TD-01` rejeitou.

**Technical actions:**

1. Corrigir o template de `vitest.config.ts` em `.claude/skills/testing-guide-next-frontend/SKILL.md` — trocar o `environment: "happy-dom"` único e global pelos dois projetos da `TD-01`, com `jsdom` no projeto de DOM e a `url` fixada em `3001`.
2. Corrigir o template de `mocks/handlers.ts` na mesma skill — hoje usa literais inline sem tipagem; passa a usar `createOpenApiHttp<paths>` com `paths` vindo de `@/lib/api/contracts` (per `TD-03`).
3. Atualizar `.claude/skills/testing-guide-next-frontend/references/external-systems.md` § "Typing the fixtures" — a afirmação de que a adoção de codegen está diferida deixou de valer com a `TD-03`.
4. Reescrever a abertura de `next-frontend/CLAUDE.md` § Testing, que hoje diz que o ferramental "is **not wired yet**" e lista `vitest.config.ts`, `vitest.setup.ts`, `mocks/server.ts` e os scripts como inexistentes. Registrar o que passou a existir e o que segue pendente — `playwright.config.ts` e `test:e2e` continuam fora desta task.

**Tests:** _(empty — alteração de documentação; a verificação é por grep, nas ACs)_

**Dependencies:** SI-3 — a documentação descreve a configuração entregue; escrevê-la antes a tornaria uma promessa, não um registro.

**Acceptance criteria:**

- `grep -rn "happy-dom" .claude/skills/testing-guide-next-frontend/` retorna vazio.
- O template de `vitest.setup.ts` da skill deixa de existir como arquivo único e passa a nomear os dois `setupFiles` por lane, sem contradizer o `vitest.config.ts` entregue.
- `next-frontend/CLAUDE.md` § Testing não afirma mais que `vitest.config.ts`, `mocks/server.ts` ou o script `test` não existem.
- `next-frontend/CLAUDE.md` continua registrando `playwright.config.ts` e `test:e2e` como pendentes — a task não os entrega e a documentação não pode sugerir o contrário.

---

## Technical Specifications

### Frontend Runtime

#### next-frontend-msw-base/TD-01 — Separação dos ambientes de execução do Vitest (`node` vs DOM)

**Pattern:** é o único caminho que dá `setupFiles` por lane, o que a TD-04 precisa para não misturar as duas superfícies de fake, e é o mecanismo que a documentação do Vitest 4 indica depois de remover `environmentMatchGlobs`. O custo é verbosidade num arquivo que se escreve uma vez; o custo das outras duas é uma classe de erro recorrente cuja mensagem não aponta para a causa.

**Setup:** dois projetos inline em `test.projects`, ambos com `extends: true` (herdam plugins e alias da raiz) e `setupFiles` próprio. `loadEnvConfig()` roda no topo do módulo, antes do `defineConfig`, per `next-frontend-env-config/TD-05` — a validação-no-import de `lib/env.ts` exige que `process.env` já esteja populado quando o primeiro teste importar o módulo.

```ts
// next-frontend/vitest.config.ts
loadEnvConfig(process.cwd())

test: {
  projects: [
    {
      extends: true,
      test: {
        name: "node",
        environment: "node",
        include: ["app/api/**/__tests__/**/*.test.ts", "lib/**/__tests__/**/*.test.ts"],
        setupFiles: ["./vitest.setup.node.ts"],
      },
    },
    {
      extends: true,
      test: {
        name: "dom",
        environment: "jsdom",
        include: ["components/**/__tests__/**/*.test.{ts,tsx}", "hooks/**/__tests__/**/*.test.{ts,tsx}"],
        setupFiles: ["./vitest.setup.dom.ts"],
      },
    },
  ],
}
```

**Aplicação:** a separação é global e determina, por caminho de arquivo, em que ambiente cada teste roda. Não há componentes a listar — esta task é logic-only.

- **Lane `node`** — tudo sob `app/api/**/__tests__/` e `lib/**/__tests__/`. É a lane que hospeda o primeiro teste desta task (`lib/__tests__/env.test.ts`) e, no futuro, os testes de integração dos route handlers do BFF. `environment: "node"` é obrigatório aqui: `@/lib/env` decide server vs client por `typeof window === "undefined"`, e importá-lo sob um ambiente de DOM lança na avaliação do módulo, antes de qualquer asserção.
- **Lane `dom`** — tudo sob `components/**/__tests__/` e `hooks/**/__tests__/`. Nasce sem nenhum teste nesta task; a configuração existe para que o primeiro teste de componente não precise reabrir a decisão.
- **Fora das duas lanes** — `tests/` (Playwright, `*.e2e-spec.ts`) não é incluído por nenhum projeto e continua fora do escopo desta task.

**Migração:** _No existing files require refactor — não existe `vitest.config.ts` no repositório; a adoção é greenfield. O único arquivo pré-existente afetado é o template da skill, tratado na TD-02._

**Verificação:**

- **Unit:** `npx vitest run --project node` executa os seis casos de `lib/__tests__/env.test.ts` e nenhum outro; `npx vitest run --project dom` executa zero arquivos sem erro de configuração.
- **Integration:** não aplicável nesta task — a lane de integração nasce sem teste por decisão registrada (AMB-2), já que nenhum route handler existe em `app/api/`.
- **E2E:** fora de escopo — o bootstrap do Playwright não pertence a esta task.
- **Regression guards:** `npx tsc --noEmit`, `npm run lint` e `npm run build` continuam em exit 0 depois da introdução do `vitest.config.ts` e das novas devDependencies.

#### next-frontend-msw-base/TD-02 — Biblioteca de DOM da lane de browser — `jsdom` ou `happy-dom`

**Pattern:** a diferença de velocidade só se paga com uma suíte grande, que este projeto não tem e não terá tão cedo, enquanto a diferença de cobertura cobra logo no primeiro teste de componente que abrir um overlay do Radix. Escolher `jsdom` também elimina a divergência com a documentação do Next.js. Se a decisão for esta, a skill `testing-guide-next-frontend` precisa ter o template de `vitest.config.ts` corrigido no mesmo commit — hoje ela diz `happy-dom`.

**Setup:** `jsdom` entra como devDependency e é o valor de `environment` do projeto `dom` da TD-01. O `url` do ambiente é fixado explicitamente: o default do `jsdom` é `http://localhost:3000`, que neste projeto é a porta do `nestjs-api`, e é contra esse `location` que os handlers de caminho relativo da TD-04 resolveriam.

```ts
// next-frontend/vitest.config.ts — no projeto "dom" da TD-01
environment: "jsdom",
environmentOptions: {
  jsdom: {
    url: "http://localhost:3001",
  },
},
```

**Aplicação:** vale para todo arquivo casado pelo `include` do projeto `dom` (`components/**/__tests__/`, `hooks/**/__tests__/`). A lane `node` não instancia DOM nenhum. Nenhum arquivo de teste declara ambiente por docblock (`// @vitest-environment ...`) — a separação é por caminho, e um docblock avulso reintroduz exatamente a divergência que a TD-01 fecha.

**Migração:** a decisão contradiz um artefato versionado do repositório, que precisa ser corrigido no mesmo commit.

| File | Current behavior | Required change | Owning SI |
|------|-----------------|-----------------|-----------|
| `.claude/skills/testing-guide-next-frontend/SKILL.md` | O template de `vitest.config.ts` declara um `environment: "happy-dom"` único e global | Trocar para os dois projetos da TD-01 com `environment: "jsdom"` no projeto de DOM | SI de alinhamento da skill |

**Verificação:**

- **Unit:** um teste-canário de componente sob `components/__tests__/` renderiza e monta sem erro de API de DOM ausente, provando que o ambiente está instanciado. _(Opcional — a lane nasce vazia por escopo; se o canário não for criado, a prova fica sendo o `--project dom` da TD-01 rodar sem erro de configuração.)_
- **Integration:** não aplicável.
- **E2E:** fora de escopo.
- **Regression guards:** `grep -n 'happy-dom' .claude/skills/testing-guide-next-frontend/` retorna vazio ao fim da task.

#### next-frontend-msw-base/TD-03 — Tipagem dos handlers MSW a partir do contrato OpenAPI (codegen)

**Pattern:** é a única que fecha o buraco que a `next-frontend-api-typing/TD-03` conscientemente deixou aberto, e ela o fecha no lugar mais barato (build do teste, não runtime de produção). Vale um efeito colateral concreto: com a verificação de status, o fixture de `POST /auth/login` vai acusar de imediato a imprecisão já confirmada na spec do backend, que declara `RegisterResponseDto` como resposta 200 do login. Se adotada, decidir junto como `mocks/` acessa `paths` — reexportar o tipo por `lib/api/contracts.ts` mantém a regra de importação vigente sem carve-out; abrir exceção para `mocks/` é a alternativa mais direta e mais frouxa. Verificar a compatibilidade da versão de `openapi-msw` com `msw` 2.x e `openapi-typescript` 7.13.0 no momento da instalação.

**Setup:** `paths` é **reexportado** por `lib/api/contracts.ts` e importado de lá pelos mocks — nunca de `lib/api/schema` diretamente, o que preservaria a regra de `next-frontend-api-typing/TD-02` sem carve-out. O `baseUrl` do `createOpenApiHttp` vem de `config.api.baseUrl` (`@/lib/env`), o mesmo módulo que o código sob teste lê.

```ts
// next-frontend/lib/api/contracts.ts — acrescentar à reexportação pública
export type { paths } from "@/lib/api/schema"
```

```ts
// next-frontend/mocks/handlers.ts
const http = createOpenApiHttp<paths>({ baseUrl: config.api.baseUrl })

export const handlers = [
  http.post("/auth/login", async ({ response }) => response(200).json({ /* ... */ })),
]
```

**Aplicação:** vale para todo handler que fale com a API upstream do NestJS — isto é, todo handler de `mocks/handlers.ts`, a superfície que a TD-04 mantém separada.

- **Adota** — `mocks/handlers.ts` e qualquer override de runtime via `server.use()` que mire uma rota upstream.
- **Não adota** — `mocks/bff-handlers.ts`, cujas rotas relativas `/api/...` são do próprio Next e não existem na spec do NestJS; e o escape hatch `http.untyped`, reservado para o que estiver legitimamente fora da spec.

**Migração:** um arquivo pré-existente ganha a reexportação; nenhum comportamento de runtime muda.

| File | Current behavior | Required change | Owning SI |
|------|-----------------|-----------------|-----------|
| `next-frontend/lib/api/contracts.ts` | Importa `paths` de `@/lib/api/schema` para uso interno; não reexporta nada | Acrescentar `export type { paths }`, tornando `contracts.ts` a porta única de acesso ao tipo | SI de tipagem dos handlers |

**Verificação:**

- **Unit:** um caminho ou método inexistente na spec (`http.get("/unknown", ...)`) falha em `npx tsc --noEmit` — prova por build de que a tipagem está ativa, não decorativa.
- **Integration:** não aplicável nesta task (nenhum route handler a exercitar).
- **E2E:** fora de escopo.
- **Regression guards:** `./scripts/check-api-types-drift.sh` continua em exit 0 — a reexportação não toca no arquivo gerado; e `grep -rn 'lib/api/schema' next-frontend/mocks/` retorna vazio, provando que a regra de importação da `api-typing/TD-02` seguiu sem carve-out.

#### next-frontend-msw-base/TD-04 — Superfície de fake da lane de browser — rotas relativas do BFF

**Pattern:** preserva o padrão de default + override que o projeto já adotou e evita o efeito mais nocivo da Option A, que é embaralhar duas fronteiras com garantias de tipagem diferentes logo no arquivo onde a TD-03 quer precisão. Com uma única rota de BFF hoje, B e C custam quase o mesmo; a diferença aparece na terceira rota, e B é a que não precisa ser refeita lá. Se a TD-01 não for decidida como Option A, esta TD deve cair para a Option C, não para a A — sem `setupFiles` por lane, a composição da Option B não tem onde acontecer.

**Setup:** dois conjuntos de handlers em arquivos separados, compostos por lane nos `setupFiles` da TD-01. `mocks/server.ts` expõe o `setupServer` e o ciclo de vida; cada `setupFiles` decide **quais** handlers registrar. `onUnhandledRequest: "error"` é o trilho que torna absoluta a regra de que nenhum teste Vitest abre conexão real com o `nestjs-api`.

```ts
// next-frontend/mocks/server.ts
export const server = setupServer()

// next-frontend/vitest.setup.node.ts   — lane node: só o upstream
beforeAll(() => server.listen({ onUnhandledRequest: "error" }))
afterEach(() => server.resetHandlers(...handlers))
afterAll(() => server.close())

// next-frontend/vitest.setup.dom.ts    — lane dom: upstream + rotas relativas do BFF
afterEach(() => server.resetHandlers(...handlers, ...bffHandlers))
```

**Aplicação:** a composição é por lane, não por arquivo de teste.

- **Lane `node`** — recebe apenas `mocks/handlers.ts`. É a fronteira que os route handlers do BFF atravessam quando chamam o `nestjs-api`; as rotas relativas não fazem sentido aqui, porque em Node puro não existe `location` contra o qual resolvê-las.
- **Lane `dom`** — recebe **apenas** `mocks/bff-handlers.ts`. As rotas relativas `/api/...` resolvem contra o `location` fixado pela TD-02 (`http://localhost:3001`). Os handlers upstream ficam de fora por restrição dura, não por preferência: `mocks/handlers.ts` importa `@/lib/env`, e `@t3-oss/env-core` lança `Attempted to access a server-side environment variable on the client` sob jsdom. Também seriam inúteis — per `next-frontend-env-config/TD-04`, código de browser só chama rotas relativas. Ver a Revision de 2026-08-15 na TD-04.
- **Override por teste** — `server.use()` continua sendo a via para o caminho de exceção; `resetHandlers()` no `afterEach` é obrigatório, sob pena de vazar override entre testes.

**Migração:** _No existing files require refactor — `mocks/` não existe no repositório; os três arquivos nascem nesta task._

**Verificação:**

- **Unit:** não aplicável — os handlers não têm lógica própria a testar isoladamente.
- **Integration:** a prova real fica devendo por decisão de escopo registrada (AMB-2): sem nenhum route handler em `app/api/`, `mocks/bff-handlers.ts` e a lane de integração nascem sem teste que os exercite. **A task que criar o primeiro route handler do BFF é dona do primeiro teste de integração e do primeiro handler relativo.** Até lá, `mocks/bff-handlers.ts` pode nascer com o array vazio e um comentário apontando para esta linha.
- **E2E:** fora de escopo.
- **Regression guards:** nenhum teste pré-existente — a suíte nasce nesta task.

#### Decisões herdadas que renderizam em Frontend Runtime

_Inherited: ver `next-frontend-api-typing/TD-02` — `components/` e `hooks/` importam apenas de `lib/api/contracts.ts`; é a regra que a TD-03 preserva pela reexportação._

_Inherited: ver `next-frontend-api-typing/TD-03` — ausência deliberada de validação de runtime na fronteira BFF↔NestJS; a TD-03 desta task cobre a mesma lacuna no build do teste, não em produção._

_Inherited: ver `next-frontend-env-config/TD-01` — `lib/env.ts` valida o ambiente no import e separa server/client por `typeof window`; é a causa direta de a lane `node` da TD-01 existir._

---

## Dependency Map

```text
SI-1 (root) — Instalar o ferramental de teste
└── SI-2 — depends on SI-1 (msw + openapi-msw instalados antes de mocks/ compilar)
    └── SI-3 — depends on SI-1 + SI-2 (os setupFiles importam mocks/server, handlers e bff-handlers)
        ├── SI-4 — depends on SI-3 (o projeto `node` precisa existir para o teste rodar no ambiente certo)
        └── SI-5 — depends on SI-3 (documenta a configuração entregue, não uma promessa)
```

SI-4 e SI-5 são independentes entre si e podem ser executados em qualquer ordem depois do SI-3.

---

## Deliverables

- [ ] SI-1 — Instalar o ferramental de teste (Infra)
- [ ] SI-2 — Construir a superfície de fake do MSW, tipada pelo contrato (Setup)
- [ ] SI-3 — Configurar as duas lanes de execução do Vitest (Setup)
- [ ] SI-4 — Materializar o contrato de teste diferido de `lib/env.ts`
- [ ] SI-5 — Alinhar a skill de testes e o `CLAUDE.md` ao ferramental entregue

**Arquivos que a task cria:**

- [ ] `next-frontend/vitest.config.ts` — dois projetos, `node` e `dom`
- [ ] `next-frontend/vitest.setup.node.ts` e `next-frontend/vitest.setup.dom.ts`
- [ ] `next-frontend/mocks/server.ts`, `mocks/handlers.ts` e `mocks/bff-handlers.ts`
- [ ] `next-frontend/lib/__tests__/env.test.ts`

**Full test suites:**

- [ ] Testes do frontend passam (`docker compose exec next-frontend npm test`)
- [ ] Type-check passa (`docker compose exec next-frontend npx tsc --noEmit`)
- [ ] Lint passa sem achados (`docker compose exec next-frontend npm run lint`)
- [ ] Build passa (`docker compose exec next-frontend npm run build`)
- [ ] Check de drift dos tipos de API continua em verde (`./scripts/check-api-types-drift.sh`)

**Fora do escopo desta task, registrado para não ser confundido com pendência:** o bootstrap do Playwright (`playwright.config.ts`, script `test:e2e`, `tests/auth.setup.ts`) e o primeiro route handler do BFF em `app/api/`. A lane de integração e `mocks/bff-handlers.ts` nascem sem teste que os exercite — consequência aceita e registrada em `validation.md` (AMB-2).
