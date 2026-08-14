---
kind: task
name: task-next-frontend-env-config
test_specs_aware: true
sources_mtime:
  docs/tasks/task-next-frontend-env-config/context.md: "2026-08-10T10:44:08Z"
  docs/tasks/task-next-frontend-env-config/library-refs.md: "2026-08-10T10:32:14Z"
  docs/decisions/technical-decisions-next-frontend-env-config.md: "2026-08-10T10:30:53Z"
  docs/decisions/technical-decisions-config.md: "2026-08-10T10:31:59Z"
  docs/decisions/technical-decisions-openapi-spec.md: "2026-08-08T21:32:44Z"
  docs/phases/phase-02-auth/context.md: "2026-08-08T20:56:25Z"
  .claude/skills/testing-guide-next-frontend/SKILL.md: "2026-08-09T18:07:37Z"
---

# Task — Configuração de Ambiente do `next-frontend`

## Objective

Base de configuração de variáveis de ambiente do next-frontend: acesso tipado, validação, organização e fronteira server/client. Inclui também a convenção de carregamento de env no ambiente de teste, cuja implementação é delegada à task de MSW (que materializa o ferramental Vitest).

---

## Step Implementations

### SI-1 — Alinhar os arquivos de ambiente com a decisão de BFF

**Description:** Remover `NEXT_PUBLIC_API_BASE_URL` da superfície de configuração do `next-frontend` e ajustar a documentação que a descrevia, materializando a decisão de que o browser consome apenas o BFF.

**Technical actions:**

1. Editar `next-frontend/.env.example` — remover a entrada `NEXT_PUBLIC_API_BASE_URL` e o comentário que a acompanha; manter `API_BASE_URL=http://nestjs-api:3000` (per `next-frontend-env-config/TD-04`).
2. Editar `next-frontend/.env` — remover `NEXT_PUBLIC_API_BASE_URL`, caso presente no arquivo local (não versionado).
3. Editar `next-frontend/CLAUDE.md` § API Integration — substituir a descrição das duas base URLs pelo modelo de origem única: o browser chama rotas relativas `/api/...` dos route handlers, que usam `API_BASE_URL` server-side (per `next-frontend-env-config/TD-04`).
4. Corrigir, no mesmo trecho, a referência ao client tipado: `openapi-spec/TD-07` → `openapi-spec/TD-05` (o TD-07 documenta respostas de erro; o client tipado é o TD-05).

**Tests:** _(empty — Infra)_

**Dependencies:** none

**Acceptance criteria:**

- `grep -rn 'NEXT_PUBLIC_API_BASE_URL' next-frontend/` não retorna nenhuma ocorrência.
- `next-frontend/.env.example` declara `API_BASE_URL` e nenhuma variável com prefixo `NEXT_PUBLIC_`.
- `next-frontend/CLAUDE.md` § API Integration descreve uma única base URL server-side e cita `openapi-spec/TD-05` como o TD do client tipado.

---

### SI-2 — Biblioteca de validação do schema de ambiente (Setup)

**Frontend Runtime spec:** see `## Technical Specifications` → `### Frontend Runtime` → `#### next-frontend-env-config/TD-02 — Biblioteca de validação do schema de ambiente`

**Technical actions:**

1. Instalar `zod` em `next-frontend/package.json` — versão `^4` (a v3 tem API divergente para `z.url()`); registrar o pin no manifesto (per `next-frontend-env-config/TD-02`).
2. Rodar a instalação dentro do container conforme `next-frontend/CLAUDE.md` § "Installing Dependencies Inside the Container" — instalar como root e restaurar a propriedade de `node_modules` e `.next` para `node:node` imediatamente depois, com autorização explícita do usuário.

**Tests:** _(empty — Setup SI; smoke-gated by AC; behavior tests live in Migration + Verification SIs)_

**Dependencies:** —

**Acceptance criteria:**

- `zod` consta em `next-frontend/package.json` com pin `^4` e resolve para uma versão 4.x no lockfile.
- `node_modules` e `.next` permanecem com owner `node:node` após a instalação.
- `npx tsc --noEmit` continua passando no `next-frontend`.

---

### SI-3 — Módulo de configuração tipada com fronteira server/client (Setup)

**Frontend Runtime spec:** see `## Technical Specifications` → `### Frontend Runtime` → `#### next-frontend-env-config/TD-01 — Estratégia de acesso à configuração e enforcement da fronteira server/client`

**Technical actions:**

1. Instalar `@t3-oss/env-nextjs` em `next-frontend/package.json`, pelo mesmo procedimento de container do SI-2 (per `next-frontend-env-config/TD-01`).
2. Criar `next-frontend/lib/env.ts` implementando o Setup snippet byte-verbatim da spec: `createEnv` com blocos `server` / `client` / `shared`, `experimental__runtimeEnv` e `emptyStringAsUndefined: true`. O bloco `client` nasce vazio por decisão do `next-frontend-env-config/TD-04`.
3. Criar `next-frontend/lib/__tests__/env.test.ts` cobrindo os casos de validação — o arquivo é escrito agora e passa a rodar quando o ferramental Vitest existir (criado pela task de MSW, per `next-frontend-env-config/TD-05`).

**Tests:**

| Artifact | Layer | Test file |
|----------|-------|-----------|
| `lib/env.ts` | Unit per `testing-guide-next-frontend` § "`lib/` utility with branching" — schema válido produz o objeto tipado; `API_BASE_URL` ausente lança na importação; `API_BASE_URL` com valor não-URL é rejeitada | `next-frontend/lib/__tests__/env.test.ts` |

**Dependencies:** SI-1 (a superfície de variáveis precisa estar alinhada antes de o schema validá-la), SI-2 (o `createEnv` consome os schemas Zod)

**Acceptance criteria:**

- `next-frontend/lib/env.ts` existe e é o único arquivo do subprojeto que referencia `process.env` (`grep -rn 'process\.env' next-frontend/ --exclude-dir=node_modules` retorna apenas ele e `next.config.ts`, se aplicável).
- Importar o módulo com `API_BASE_URL` ausente derruba o processo com erro que nomeia a variável faltante.
- Importar o módulo com `API_BASE_URL` preenchido com valor não-URL derruba o processo com erro de validação.
- `npx tsc --noEmit` passa e o tipo exportado deriva do schema, sem interface escrita à mão.

---

### SI-4 — Organização das variáveis por domínio no objeto exportado (Setup)

**Frontend Runtime spec:** see `## Technical Specifications` → `### Frontend Runtime` → `#### next-frontend-env-config/TD-03 — Organização das variáveis — arquivo único vs namespaces por domínio`

**Technical actions:**

1. Estender `next-frontend/lib/env.ts` com o export reagrupado por domínio — `config.api.baseUrl` sobre o schema plano, congelado com `as const` (per `next-frontend-env-config/TD-03`).
2. Estender `next-frontend/lib/__tests__/env.test.ts` com os casos de forma do objeto exportado.

**Tests:**

| Artifact | Layer | Test file |
|----------|-------|-----------|
| `lib/env.ts` (export `config`) | Unit per `testing-guide-next-frontend` § "`lib/` utility with branching" — `config.api.baseUrl` reflete o valor validado; o objeto é congelado e a reatribuição falha no type-check | `next-frontend/lib/__tests__/env.test.ts` |

**Dependencies:** SI-3 (o objeto reagrupado é construído sobre o schema validado)

**Acceptance criteria:**

- Consumidores acessam a base URL por `config.api.baseUrl`; o schema plano não é exportado como superfície pública do módulo.
- Acrescentar uma variável de um novo domínio exige apenas uma chave de primeiro nível em `config` e uma entrada no mesmo `createEnv` — sem novo arquivo.
- `npx tsc --noEmit` passa com o objeto tipado como `as const`.

---

### SI-5 — Convenção de carregamento de env no ambiente de teste (Setup)

**Frontend Runtime spec:** see `## Technical Specifications` → `### Frontend Runtime` → `#### next-frontend-env-config/TD-05 — Carregamento da configuração no ambiente de teste`

**Technical actions:**

1. Declarar `@next/env` explicitamente em `next-frontend/package.json` — hoje é dependência transitiva de `next` e a importação direta funciona por acidente de hoisting (per `next-frontend-env-config/TD-05`).
2. Criar `next-frontend/.env.test` versionado, com `API_BASE_URL=http://nestjs-api.test:3000` — host fictício, para que qualquer request não interceptado pelo MSW falhe de forma óbvia em vez de vazar para o serviço real.

**Tests:** _(empty — Setup SI; smoke-gated by AC; behavior tests live in Migration + Verification SIs)_

**Dependencies:** SI-1 (o conjunto de chaves precisa estar fixado antes de ser espelhado no `.env.test`)

**Acceptance criteria:**

- `next-frontend/.env.test` está versionado no repositório e declara `API_BASE_URL` apontando para um host que não resolve fora do MSW.
- `@next/env` consta em `next-frontend/package.json` como dependência explícita.
- `next-frontend/.env.test` não é ignorado por `.gitignore`.

**Observação de escopo:** a linha `loadEnvConfig(process.cwd())` em `vitest.config.ts` **não** é entregue por esta task — o arquivo não existe e sua criação pertence à task de MSW, conforme `AMB-1` em `validation.md`. Este SI entrega o `.env.test` e a dependência declarada; a task de MSW aplica a chamada.

---

## Technical Specifications

### Frontend Runtime

#### next-frontend-env-config/TD-01 — Estratégia de acesso à configuração e enforcement da fronteira server/client

**Pattern:** a diferença material entre B e C não é tipagem (as duas entregam), é **onde mora o enforcement da fronteira**: em B ele depende de o autor lembrar do `import "server-only"` a cada arquivo novo; em C ele é estrutural, e a exigência de destructuração literal em `experimental__runtimeEnv` neutraliza de graça o modo de falha mais caro do Next (uma `NEXT_PUBLIC_*` que silenciosamente vira `undefined` no bundle).

**Setup:**

```ts
// next-frontend/lib/env.ts
const env = createEnv({
  server: {
    API_BASE_URL: z.url(),
  },
  client: {},
  shared: {
    NODE_ENV: z.enum(["development", "production", "test"]),
  },
  experimental__runtimeEnv: {
    NODE_ENV: process.env.NODE_ENV,
  },
  emptyStringAsUndefined: true,
})
```

O bloco `client` nasce **vazio** por decisão da TD-04 (`NEXT_PUBLIC_API_BASE_URL` removida); permanece declarado para que o enforcement continue ativo quando uma chave pública for adicionada. `emptyStringAsUndefined: true` é recomendação explícita da documentação para projetos novos — sem ela, `VAR=` chega como string vazia e derruba defaults. Toda chave de `client` e `shared` precisa aparecer literalmente em `experimental__runtimeEnv`: é essa destructuração que o inlining em build time do Next enxerga.

**Aplicação:** fase logic-only — não há `### Server-connected Components` a referenciar. O padrão se aplica a **todo** consumo de configuração no `next-frontend/`: qualquer Server Component, route handler sob `next-frontend/app/api/**/route.ts` ou server action passa a importar de `@/lib/env` em vez de ler `process.env`. Client Components só podem importar chaves declaradas em `client` ou `shared` — o acesso a chave de `server` a partir do browser dispara `onInvalidAccess`. As telas de auth diferidas em `auth/TD-09` herdam esta restrição via `## Inherited Decisions Detail`.

**Migração:** _No existing files require refactor — Setup SI is the only application of this pattern in the current phase._ (`grep -rn 'process\.env'` sobre `app/`, `components/`, `lib/` e `scripts/` do `next-frontend/` retorna zero ocorrências; o subprojeto nunca leu variável de ambiente.)

**Verificação:**

- **Unit:** `lib/__tests__/env.test.ts` — schema válido produz o objeto tipado esperado; variável obrigatória ausente lança na importação do módulo; `API_BASE_URL` com valor não-URL é rejeitada.
- **Integration:** o primeiro route handler que consumir `env.API_BASE_URL` prova, no lane Vitest + MSW, que o valor chega ao `fetch` upstream — não há route handler nesta task, então esta linha é contrato para a task de MSW.
- **E2E:** não aplicável nesta task (sem superfície de UI).
- **Regression guards:** `npx tsc --noEmit` e `npm run lint` devem continuar passando; `npm run check:tokens` não é afetado (nenhuma mudança em `globals.css` ou `components/ui/*`).

#### next-frontend-env-config/TD-02 — Biblioteca de validação do schema de ambiente

**Pattern:** a decisão real não é "o que valida 2 variáveis melhor" (as quatro validam), é qual biblioteca o front vai carregar quando as telas de formulário chegarem, e aí Zod é a que tem integração pronta com React Hook Form e com o `openapi-fetch` de `openapi-spec/TD-05`, evitando uma segunda lib depois.

**Setup:**

```ts
// next-frontend/lib/env.ts — schemas consumidos pelo createEnv da TD-01
API_BASE_URL: z.url(),
NODE_ENV: z.enum(["development", "production", "test"]),
```

Zod v4 implementa Standard Schema v1, que é o que permite plugá-lo direto no `createEnv`. Duas armadilhas documentadas em `library-refs.md` que valem para qualquer variável futura: `z.enum([...])` exige `as const` quando os valores vêm de uma variável (sem ele, `z.infer` degrada para `string`); e `z.coerce.boolean()` aplica `Boolean(value)`, então `"false"` coage para `true` — flag booleana de `.env` precisa de `z.enum(["true","false"]).transform(v => v === "true")`.

**Aplicação:** fase logic-only. Zod passa a ser a biblioteca de validação do `next-frontend/`, começando pelo schema de ambiente em `lib/env.ts`. Escopo declarado desta task: **apenas** o schema de ambiente. Validação de formulário e parsing de resposta de API são superfícies futuras que herdam a escolha, não entregáveis aqui.

**Migração:** _No existing files require refactor — Setup SI is the only application of this pattern in the current phase._ (`next-frontend/package.json` não tem nenhuma biblioteca de validação instalada.)

**Verificação:**

- **Unit:** coberto pelos mesmos casos de `lib/__tests__/env.test.ts` da TD-01 — o schema é o objeto sob teste.
- **Integration:** não aplicável isoladamente.
- **E2E:** não aplicável nesta task.
- **Regression guards:** a instalação de `zod` não pode quebrar `npx tsc --noEmit`; conferir que a versão instalada é `^4` (a v3 tem API divergente para `z.url()`).

#### next-frontend-env-config/TD-03 — Organização das variáveis — arquivo único vs namespaces por domínio

**Pattern:** preserva o que a Revision de `config/TD-02` de fato exige (fronteiras de domínio visíveis no ponto de consumo) sem pagar por três arquivos para duas variáveis, e mantém a validação atômica que a TD-01 Option C torna desejável.

**Setup:**

```ts
// next-frontend/lib/env.ts — export reagrupado por domínio sobre o schema plano
export const config = {
  api: {
    baseUrl: env.API_BASE_URL,
  },
} as const
```

O schema do `createEnv` permanece **plano** (uma chamada só, validação atômica com relatório de erro único); o reagrupamento por domínio acontece apenas no objeto exportado. Consumidores falam `config.api.baseUrl`, nunca `env.API_BASE_URL` diretamente — é isso que torna mecânica uma migração futura para arquivos separados por domínio.

**Aplicação:** fase logic-only. A convenção rege todo consumo de configuração no `next-frontend/`: cada domínio novo (storage na Fase 03, player na Fase 05, analytics na Fase 07) ganha uma chave de primeiro nível em `config`, com o schema correspondente acrescentado ao mesmo `createEnv`. Herdado de `config/TD-02` como princípio; a mecânica `registerAs` do backend não se transporta, conforme a Revision de 2026-08-10 em `config/TD-01`.

**Migração:** _No existing files require refactor — Setup SI is the only application of this pattern in the current phase._

**Verificação:**

- **Unit:** `lib/__tests__/env.test.ts` — o objeto exportado expõe `config.api.baseUrl` e o mapeamento reflete o valor validado; o objeto é congelado (`as const`), então a tentativa de reatribuição falha no type-check.
- **Integration:** não aplicável isoladamente.
- **E2E:** não aplicável nesta task.
- **Regression guards:** nenhum — superfície nova.

#### next-frontend-env-config/TD-05 — Carregamento da configuração no ambiente de teste

**Pattern:** Option A, com um `.env.test` versionado no repositório apontando para hosts fictícios (`http://nestjs-api.test:3000`) — reusa a mesma precedência do runtime do Next, mantém uma fonte de verdade só para as chaves, e o host fictício garante que qualquer request não interceptado pelo MSW falhe de forma óbvia em vez de vazar para o serviço real.

**Setup:**

```ts
// next-frontend/vitest.config.ts — materialização delegada (ver Aplicação)
loadEnvConfig(process.cwd())
```

```
# next-frontend/.env.test — versionado
API_BASE_URL=http://nestjs-api.test:3000
```

`loadEnvConfig()` de `@next/env` reproduz a cascata do runtime do Next: `.env.test.local` > `.env.test` > `.env`, com `mode = test` quando `NODE_ENV=test`. **`.env.local` é deliberadamente pulado sob `mode=test`** — é essa exclusão que impede o `.env.local` de um dev vazar para o suite. `@next/env` é hoje dependência transitiva de `next`: a entrada explícita em `package.json` é obrigatória.

**Aplicação:** fase logic-only, e esta TD é o caso limite — a **convenção** é fixada aqui, a **materialização** pertence à task de MSW, que cria `vitest.config.ts` e `vitest.setup.ts` (decisão registrada em `AMB-1` de `validation.md`). Esta task entrega apenas `.env.test`, que é artefato de configuração e não depende do ferramental existir. Quando a task de MSW rodar, ela aplica a linha `loadEnvConfig(process.cwd())` no topo do `vitest.config.ts` que criar, e os handlers MSW leem a base URL de `@/lib/env` — nunca hardcoded, conforme `next-frontend/CLAUDE.md` § Testing.

**Migração:** _No existing files require refactor — Setup SI is the only application of this pattern in the current phase._ (`vitest.config.ts`, `vitest.setup.ts`, `playwright.config.ts` e `mocks/server.ts` não existem; sua criação está fora do escopo desta task.)

**Verificação:**

- **Unit:** não aplicável — o carregamento de env é pré-condição do suite, não unidade sob teste.
- **Integration:** a prova real acontece na task de MSW: com `.env.test` presente e `loadEnvConfig` no config, o primeiro teste de integração de route handler deve resolver `config.api.baseUrl` para `http://nestjs-api.test:3000` e o `server.listen({ onUnhandledRequest: "error" })` deve derrubar qualquer request não interceptado.
- **E2E:** não aplicável nesta task.
- **Regression guards:** nenhum — o suite ainda não existe.

---

## Dependency Map

```
SI-1 (root) — Alinhar os arquivos de ambiente com a decisão de BFF
├── SI-3 — depends on SI-1 + SI-2 (a superfície de variáveis precisa estar fixada antes de o schema validá-la)
│   └── SI-4 — depends on SI-3 (o objeto reagrupado é construído sobre o schema validado)
└── SI-5 — depends on SI-1 (o conjunto de chaves precisa estar fixado antes de ser espelhado no .env.test)

SI-2 (root) — Biblioteca de validação do schema de ambiente
└── SI-3 — depends on SI-2 (o createEnv consome os schemas Zod)
```

Dois roots independentes: `SI-1` (superfície de variáveis) e `SI-2` (instalação do validador). `SI-3` é o ponto de junção — só pode rodar depois dos dois. `SI-5` pende apenas de `SI-1` e pode rodar em paralelo com `SI-2`/`SI-3`/`SI-4`.

---

## Deliverables

- [ ] SI-1 — Alinhar os arquivos de ambiente com a decisão de BFF
- [ ] SI-2 — Biblioteca de validação do schema de ambiente (Setup)
- [ ] SI-3 — Módulo de configuração tipada com fronteira server/client (Setup)
- [ ] SI-4 — Organização das variáveis por domínio no objeto exportado (Setup)
- [ ] SI-5 — Convenção de carregamento de env no ambiente de teste (Setup)

**Full test suites:**

Todos os comandos rodam dentro do container, a partir da raiz do repositório (per `next-frontend/CLAUDE.md` § Commands):

- [ ] Type-check passa (`docker compose exec next-frontend npx tsc --noEmit`)
- [ ] Lint passa (`docker compose exec next-frontend npm run lint`)
- [ ] Build de produção passa (`docker compose exec next-frontend npm run build`)

**Suite de testes unitários — não executável nesta task.** `next-frontend/package.json` não tem script `test`, e `vitest.config.ts` / `vitest.setup.ts` não existem — `next-frontend/CLAUDE.md` § Testing declara isso explicitamente. O arquivo `lib/__tests__/env.test.ts` entregue em SI-3/SI-4 é escrito conforme o contrato de testes vigente e passa a ser executável quando a task de MSW materializar o ferramental. Até lá, a verificação desta task é type-check + lint + build.

- [ ] `docker compose exec next-frontend npm test` — **bloqueado**: script inexistente; desbloqueado pela task de MSW.

`npm run check:tokens` não se aplica — nenhuma mudança em `app/globals.css` ou `components/ui/*`.
