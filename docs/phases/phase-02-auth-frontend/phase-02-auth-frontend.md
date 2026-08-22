---
kind: phase
name: phase-02-auth-frontend
test_specs_aware: true
sources_mtime:
  docs/phases/phase-02-auth-frontend/context.md: "2026-08-22T14:44:05Z"
  docs/phases/phase-02-auth-frontend/library-refs.md: "2026-08-22T14:38:01Z"
  docs/decisions/technical-decisions-auth-frontend.md: "2026-08-18T22:04:39Z"
  docs/decisions/technical-decisions-http-error-contract.md: "2026-08-22T14:35:43Z"
  docs/decisions/technical-decisions-next-frontend-api-typing.md: "2026-08-15T16:15:37Z"
  docs/decisions/technical-decisions-next-frontend-env-config.md: "2026-08-10T10:30:53Z"
  docs/decisions/technical-decisions-next-frontend-msw-base.md: "2026-08-15T19:59:53Z"
  docs/decisions/technical-decisions-openapi-spec.md: "2026-08-08T21:32:44Z"
---

# Fase 02 — Cadastro, Login e Gerenciamento de Conta (slice `auth-frontend`)

## Objective

Entregar as telas de cadastro (`/signup`), login (`/login`) e solicitação de recuperação de senha (`/forgot-password`) no `next-frontend`, submetidas através dos route handlers do BFF e com a mecânica de sessão no cliente, mais o ajuste do envelope de erro no `nestjs-project` de que essas telas dependem — a capability "Telas de cadastro, login, confirmação de conta e recuperação de senha" da Fase 02, com a tela de confirmação e a de redefinição de senha registradas como diferidas.

---

## Step Implementations

_Os seis handlers do BFF (`SI-02.5`, `SI-02.10` a `SI-02.14`) **não** recebem `**Test Specs:**`: route handlers do Next são testados por integração no Vitest contra o MSW, e essa camada fica inline na tabela `**Tests:**` de cada SI por regra de fronteira do `/plan-test-specs`. A camada externalizada em `next-frontend/specs/` é só o E2E Playwright das telas — `SI-02.15b`, `SI-02.16b` e `SI-02.17b`._

### SI-02.0.1 — Infra: instalar os primitives shadcn em lote

**Description:** Instalar via CLI do shadcn os dois primitives do registry que as três telas consomem e que ainda não existem em `next-frontend/components/ui/`, para que a auditoria de drift de cada tela encontre os arquivos no disco em vez de reportar `componente ausente` falso.

**Technical actions:**

1. Rodar `docker compose run --rm next-frontend npx shadcn@latest add card checkbox` — gera `next-frontend/components/ui/card.tsx` e `next-frontend/components/ui/checkbox.tsx`.
2. Conferir os arquivos gerados contra `components.json` do projeto (aliases e tokens de tema) e rodar `npm run check:tokens`.

**Tests:** _(empty — Infra)_

Nenhuma suíte é escrita para os primitives instalados: `## Testing Requirements → next-frontend` fixa "**shadcn UI primitive** (`components/ui/*`) — Nenhum; confiar na biblioteca, cobrir via consumidores". A cobertura chega pelos testes das telas que os consomem.

**Dependencies:** none

**Acceptance criteria:**

- `next-frontend/components/ui/card.tsx` e `next-frontend/components/ui/checkbox.tsx` existem.
- `npx tsc --noEmit` continua limpo no `next-frontend`.
- `npm run check:tokens` passa — os arquivos gerados não introduzem cor fora dos tokens do tema.

---

### SI-02.0.2 — Custom-ui: `icon-button.tsx`

**Description:** Autorar `next-frontend/components/ui/icon-button.tsx` — primitive sob `components/ui/` que não existe no registry do shadcn. Uma única implementação atende os dois campos de senha de `/signup` (`I143:2435;82:6685` e `I143:2436;82:6685`), instanciada uma vez por campo.

**Technical actions:**

1. Autorar `next-frontend/components/ui/icon-button.tsx` conforme o UI Contract de `#### Screen: Tela de cadastro de conta` — botão de ícone com `aria-label` obrigatório na API do componente, seguindo o padrão CVA dos primitives já existentes (`components/ui/button.tsx`).

**Tests:**

| Artifact | Layer | Test file |
|----------|-------|-----------|
| `icon-button.tsx` | Unit (lane `dom`) per `## Testing Requirements → next-frontend` § "Client component com estado/handlers" — variantes, `aria-label` presente, `onClick` disparado | `next-frontend/components/ui/__tests__/icon-button.test.tsx` |

**Dependencies:** none

**Acceptance criteria:**

- `next-frontend/components/ui/icon-button.tsx` existe e exporta `IconButton`.
- O componente exige rótulo acessível: renderizá-lo sem `aria-label` é erro de tipo, não apenas de lint.
- Clique no botão dispara o handler recebido por prop.

---

### SI-02.0.3 — Custom-ui: `progress-linear.tsx`

**Description:** Autorar `next-frontend/components/ui/progress-linear.tsx` — a barra de força de senha de `/signup` (143:2446). Primitive sob `components/ui/` sem correspondente no registry do shadcn (`progress` do registry tem outra API e outro nome de arquivo).

**Technical actions:**

1. Autorar `next-frontend/components/ui/progress-linear.tsx` conforme o UI Contract de `#### Screen: Tela de cadastro de conta` — recebe o nível de força como prop e expõe `id` para que o campo de senha o referencie por `aria-describedby` (a associação em si é feita em SI-02.15b).

**Tests:** _(empty — apresentacional puro, sem lógica própria; coberto pelos testes de `/signup` em SI-02.15b e pelo build)_

**Dependencies:** none

**Acceptance criteria:**

- `next-frontend/components/ui/progress-linear.tsx` existe e exporta `ProgressLinear`.
- O componente não calcula força de senha — recebe o valor pronto por prop.
- `npm run check:tokens` passa.

---

### SI-02.0.4 — Ícones: `arrow-back.tsx` + `eye.tsx`

**Description:** Autorar os dois ícones novos que as telas consomem: `ArrowBackIcon` (BackLink de `/signup` e `/forgot-password`) e `EyeIcon` (toggle de visibilidade dos dois campos de senha de `/signup`), seguindo a forma de `components/icons/spinner.tsx` já existente.

**Technical actions:**

1. Autorar `next-frontend/components/icons/arrow-back.tsx` a partir do nó Figma `I143:2407;107:246`.
2. Autorar `next-frontend/components/icons/eye.tsx` a partir dos nós dos campos de senha de `/signup`, com as duas variantes de estado (visível / oculto).
3. Reexportar ambos em `next-frontend/components/icons/index.ts`.

**Tests:** _(empty — ícones não recebem teste per `## Testing Requirements → next-frontend` § "Icon")_

**Dependencies:** none

**Acceptance criteria:**

- `next-frontend/components/icons/arrow-back.tsx` e `next-frontend/components/icons/eye.tsx` existem e são reexportados por `components/icons/index.ts`.
- Ambos aceitam `className` e herdam a cor por `currentColor`, como `spinner.tsx`.
- `npm run check:tokens` passa.

---

### SI-02.1 — Normalizar o envelope de erro do `nestjs-project` e propagar o contrato

**Description:** Aplicar no backend a mudança aditiva de `### API Contracts → Superfície 2` — `message` sempre `string`, `details` opcional, `error` declarado como enum — e propagar o resultado até `next-frontend/lib/api/schema.d.ts`. É a raiz da slice: nenhum código de frontend desta fase pode ser tipado antes desta propagação (validation.md DG-2).

**Technical actions:**

1. Alterar `nestjs-project/src/common/filters/http-exception.filter.ts` — normalizar a saída do `ValidationPipe`: as violações por campo migram para `details` no formato `[{ field, message }]` e `message` recebe uma frase única de nível de formulário (per `http-error-contract/TD-02`, Option A). O ramo de `DomainException` permanece inalterado.
2. Criar `nestjs-project/src/common/dto/error-detail.dto.ts` (`ErrorDetailDto` — `field`, `message`) e estender `ErrorResponseDto` com `details?: ErrorDetailDto[]` decorado como array opcional de objetos (per `http-error-contract/TD-01`, Option B).
3. Promover `error` a enum em `ErrorResponseDto` com `enumName` explícito, para que o código de domínio vire um tipo nomeado na spec e uma renomeação quebre o `tsc` do frontend (per `http-error-contract/TD-03` + `auth-frontend/TD-11`, consequência (i)). Decorar apenas este campo — a convenção do projeto (`openapi-spec/TD-02`) mantém a inferência pelo CLI plugin para o resto; enum é o caso ambíguo que justifica o decorator.
4. Regerar a spec (`docker compose run --rm nestjs-api npm run openapi:generate`, per `openapi-spec/TD-04`) e então rodar `./scripts/generate-api-types.sh` na raiz, commitando `next-frontend/lib/api/schema.d.ts` no mesmo commit. **Não** acrescentar a flag `--enum` ao script — ela emitiria objeto em runtime, contra a escolha de custo zero de `openapi-spec/TD-05`.

**Tests:**

| Artifact | Layer | Test file |
|----------|-------|-----------|
| `HttpExceptionFilter` | Unit per `## Testing Requirements → nestjs-project` § "Exception Filter" — `message` string única + `details` populado a partir do array do `ValidationPipe`; `DomainException` continua sem `details` | `nestjs-project/src/common/filters/http-exception.filter.spec.ts` |
| `ErrorResponseDto` / `ErrorDetailDto` | E2E per § "DTO" — um endpoint com corpo inválido devolve `message` string e `details` no formato `[{ field, message }]` | `nestjs-project/test/*.e2e-spec.ts` (suíte de auth existente) |

**Dependencies:** none

**Acceptance criteria:**

- `POST /auth/register` com corpo que viola os DTOs retorna `400` cujo `message` é uma `string` (nunca array) e cujo `details` é um array de `{ field, message }`.
- `POST /auth/register` com e-mail já cadastrado retorna `409` com `error: "EMAIL_JA_EXISTE"` e **sem** o campo `details`.
- `nestjs-project/openapi.json` declara o campo `error` como enum nomeado e `details` como array opcional de objetos.
- `./scripts/check-api-types-drift.sh` sai com código 0 — os tipos versionados estão alinhados à spec regerada.
- As 8 suítes e2e pré-existentes passam sem edição — a mudança é aditiva.

---

### SI-02.2 — Cliente HTTP do BFF para o `nestjs-api` (Setup)

**Frontend Runtime spec:** see `## Technical Specifications` → `### Frontend Runtime` → `#### auth-frontend/TD-02 — Cliente HTTP do BFF para o nestjs-api`

**Technical actions:**

1. Instalar `openapi-fetch` no `next-frontend` (`docker compose run --rm next-frontend npm install openapi-fetch`) e registrar o pin em `next-frontend/package.json`.
2. Criar `next-frontend/lib/api/client.ts` com `createClient<paths>({ baseUrl: config.api.baseUrl })`, importando `paths` de `@/lib/api/contracts` e `config` de `@/lib/env` — nunca `process.env` direto, nunca URL hardcoded (per `next-frontend-env-config/TD-01`).
3. Deixar preparado no mesmo módulo o ponto de extensão por *middleware* do `openapi-fetch`, que é onde as mecânicas de `auth-frontend/TD-03` e `TD-04` se instalam sem repetição por handler.

**Tests:** _(empty — Setup SI; garantido pelo `tsc --noEmit`; o comportamento é exercitado pelos handlers de SI-02.5 e SI-02.10 a SI-02.14)_

**Dependencies:** SI-02.1 _(o cliente é tipado por `paths`, que deriva da spec regerada)_

**Acceptance criteria:**

- `openapi-fetch` consta em `next-frontend/package.json` com versão pinada.
- `next-frontend/lib/api/client.ts` exporta um cliente tipado por `paths`; chamar um path ou método inexistente na spec **não compila**.
- `npx tsc --noEmit` no `next-frontend` sai limpo.
- Nenhum módulo sob `components/` ou `hooks/` importa este cliente — ele é exclusivo do lado servidor do BFF.

---

### SI-02.3 — Propagação dos cookies de sessão até o browser (Setup)

**Frontend Runtime spec:** see `## Technical Specifications` → `### Frontend Runtime` → `#### auth-frontend/TD-03 — Propagação dos cookies de sessão até o browser`

**Technical actions:**

1. Criar `next-frontend/lib/api/cookies.ts` com a função de reemissão: lê nome, valor e `Max-Age` do `Set-Cookie` upstream e reescreve o cookie com atributos do BFF — `httpOnly: true`, `secure: true` (também em desenvolvimento), `sameSite: "strict"` (per `auth/TD-15`), `path: "/"`.
2. Derivar no mesmo módulo `clearAuthCookies` e a leitura por nome, usadas por SI-02.13 e SI-02.7.

**Tests:**

| Artifact | Layer | Test file |
|----------|-------|-----------|
| `lib/api/cookies.ts` | Unit (lane `node`) per `## Testing Requirements → next-frontend` § "`lib/` utility com branching" — parsing do `Set-Cookie` upstream, atributos reescritos, `Max-Age` preservado | `next-frontend/lib/api/__tests__/cookies.test.ts` |

**Dependencies:** none

**Acceptance criteria:**

- Dado um `Set-Cookie` upstream com nome e `Max-Age` quaisquer, o cookie reemitido preserva nome, valor e `Max-Age` e substitui `path` pelo do BFF.
- O cookie reemitido carrega `HttpOnly`, `Secure` e `SameSite=Strict` mesmo quando o ambiente é desenvolvimento.
- Nenhum código de browser consegue ler o cookie — não há caminho de leitura por JavaScript no módulo.

---

### SI-02.4 — Renovação do access token (Setup)

**Frontend Runtime spec:** see `## Technical Specifications` → `### Frontend Runtime` → `#### auth-frontend/TD-04 — Renovação do access token`

**Technical actions:**

1. Implementar em `next-frontend/lib/api/client.ts` a renovação reativa: ao receber `401` upstream numa chamada autenticada, chamar `POST /auth/refresh` uma única vez e repetir a chamada original.
2. Implementar a guarda de *single-flight* com o primitivo `inflightRefresh` — duas chamadas concorrentes compartilham a mesma promessa de renovação, para não rotacionarem a mesma família e dispararem `TOKEN_REUTILIZADO`.
3. Fixar **retry único**: um segundo `401` após a renovação propaga em vez de renovar de novo.

**Tests:**

| Artifact | Layer | Test file |
|----------|-------|-----------|
| `lib/api/client.ts` (single-flight) | Unit (lane `node`) — duas chamadas concorrentes com upstream fakeado em `401` disparam **um** `POST /auth/refresh`, não dois | `next-frontend/lib/api/__tests__/refresh.test.ts` |
| `lib/api/client.ts` (retry) | Integration (lane `node`, MSW) — `401` → refresh `200` → repetição devolve `200`; `401` → refresh `401` propaga o `401` | `next-frontend/lib/api/__tests__/refresh.integration.test.ts` |

**Dependencies:** SI-02.2 _(o middleware vive no cliente)_, SI-02.3 _(a renovação reemite o par de cookies)_

**Acceptance criteria:**

- Duas chamadas autenticadas concorrentes que recebem `401` produzem exatamente uma requisição de renovação.
- Após uma renovação bem-sucedida, a chamada original é repetida e devolve o resultado upstream.
- Um `401` na própria renovação é propagado ao chamador sem nova tentativa.
- `TOKEN_REUTILIZADO` não é observável em nenhum cenário de concorrência coberto pelos testes.
- Os handlers anônimos não disparam renovação: um `401` neles chega ao chamador como veio.

---

### SI-02.5 — Fundação dos route handlers do BFF (Setup)

**Route:** POST /api/auth/register
**Authorization:** Anonymous _(see `### Authorization Matrix`)_
**Frontend Runtime spec:** see `## Technical Specifications` → `### Frontend Runtime` → `#### auth-frontend/TD-01 — Mecanismo de submissão dos formulários de auth`

**Description:** Materializa o padrão de `auth-frontend/TD-01` no primeiro handler — `POST /api/auth/register` — junto com o utilitário de repasse verbatim do envelope que os outros cinco handlers reutilizam. É o Setup SI do padrão e, ao mesmo tempo, o primeiro endpoint do BFF.

**Technical actions:**

1. Criar `next-frontend/lib/api/passthrough.ts` — recebe o `{ data, error, response }` do `openapi-fetch` e devolve `NextResponse.json(data ?? error, { status: response.status })`, repassando o corpo upstream sem reescrita (per `auth-frontend/TD-11`, Option A).
2. Criar `next-frontend/app/api/auth/register/route.ts` — `POST` que lê o corpo do browser, chama `api.POST("/auth/register", { body })` e devolve pelo utilitário acima. **Não** emite cookie de sessão: o `201` não faz auto-login (per `auth/TD-09`).

**Tests:**

| Artifact | Layer | Test file |
|----------|-------|-----------|
| `app/api/auth/register/route.ts` | Integration (lane `node`, MSW tipado por `createOpenApiHttp<paths>()`) per `## Testing Requirements → next-frontend` § "Route handler (proxy simples)" — `201` repassado verbatim; `409 EMAIL_JA_EXISTE` e `400` repassados com status e corpo intactos; nenhum `Set-Cookie` na resposta | `next-frontend/app/api/auth/register/__tests__/route.integration.test.ts` |
| `lib/api/passthrough.ts` | Unit (lane `node`) — corpo de sucesso e corpo de erro escolhidos corretamente, status espelhado | `next-frontend/lib/api/__tests__/passthrough.test.ts` |

**Dependencies:** SI-02.2

**Acceptance criteria:**

- `POST /api/auth/register` com corpo válido retorna `201` com o corpo upstream inalterado e **sem** header `Set-Cookie`.
- `POST /api/auth/register` com e-mail já cadastrado retorna `409` com `error: "EMAIL_JA_EXISTE"` byte a byte como veio do upstream.
- `POST /api/auth/register` com corpo inválido retorna `400` com `statusCode`, `error`, `message` e `details` upstream intactos.
- Nenhum teste Vitest deste handler abre conexão real com o `nestjs-api` — `server.listen({ onUnhandledRequest: "error" })` está ativo.

---

### SI-02.6 — Formulários: React Hook Form + schema Zod tipado contra o contrato (Setup)

**Frontend Runtime spec:** see `## Technical Specifications` → `### Frontend Runtime` → `#### auth-frontend/TD-06 — Formulários: biblioteca e origem do schema`

**Technical actions:**

1. Instalar `react-hook-form` e `@hookform/resolvers` no `next-frontend` (`zod` já está instalado) e registrar os pins em `package.json`.
2. Criar `next-frontend/lib/forms/` com um schema por formulário — `signup-schema.ts`, `login-schema.ts`, `forgot-password-schema.ts` —, cada um declarado como `z.ZodType<{RequestBody}>` com o tipo derivado de `@/lib/api/contracts`. É esse elo que quebra o `tsc` quando o DTO do backend muda; um objeto Zod solto não quebra.
3. Criar `next-frontend/lib/forms/error-map.ts` — a tabela única código de domínio → campo do RHF, não replicada por formulário (per `auth-frontend/TD-11`, consequência (ii)). O `400` do `ValidationPipe` e o `500` mapeiam para `root.serverError`, nunca por campo.

**Tests:**

| Artifact | Layer | Test file |
|----------|-------|-----------|
| `lib/forms/*-schema.ts` | Unit (lane `node`) — rejeita senha < 8, e-mail malformado e campo ausente; aceita o corpo exato do DTO; `confirmPassword` do cadastro é regra só do cliente | `next-frontend/lib/forms/__tests__/schemas.test.ts` |
| `lib/forms/error-map.ts` | Unit (lane `node`) — cada código de `### Error Catalog` cai no destino declarado; código desconhecido cai em `root.serverError` | `next-frontend/lib/forms/__tests__/error-map.test.ts` |

**Dependencies:** SI-02.1 _(os schemas são tipados contra o contrato regerado)_

**Acceptance criteria:**

- `react-hook-form` e `@hookform/resolvers` constam em `package.json` com versão pinada.
- Cada schema recusa os corpos que as `Validation Rules` de `### API Contracts` descrevem e aceita os válidos.
- Remover um campo do DTO no backend e regerar os tipos faz `npx tsc --noEmit` falhar no schema correspondente — não no formulário.
- `EMAIL_JA_EXISTE` resolve para o campo `email`; o código do `ValidationPipe` e o `INTERNAL_SERVER_ERROR` resolvem para `root.serverError`.

---

### SI-02.7 — Fronteira de guarda de sessão (Setup)

**Frontend Runtime spec:** see `## Technical Specifications` → `### Frontend Runtime` → `#### auth-frontend/TD-05 — Fronteira de guarda de sessão`

**Technical actions:**

1. Criar `next-frontend/proxy.ts` com a verificação otimista por presença do cookie de sessão e `config.matcher` restrito — **nenhuma rota desta slice entra no matcher**: as três telas são públicas (`### Authorization Matrix`). O arquivo existe para deixar o mecanismo no lugar; a Fase 04 o aplica sobre superfície protegida de verdade.
2. Confirmar que `next-frontend/middleware.ts` **não** existe. O `middleware.ts` está deprecado no Next.js 16 e o **build falha se os dois arquivos coexistirem** — não criar o arquivo deprecado em nenhuma hipótese.

**Tests:** _(empty — Setup SI; o matcher está vazio nesta slice, e a prova é negativa via E2E das três telas)_

**Dependencies:** SI-02.3 _(a leitura do cookie por nome vive no módulo de cookies)_

**Acceptance criteria:**

- `next-frontend/proxy.ts` existe e exporta `config.matcher`; `next-frontend/middleware.ts` não existe.
- `npm run build` no `next-frontend` conclui sem erro de convenção de arquivo.
- `/signup`, `/login` e `/forgot-password` renderizam sem redirecionamento, com ou sem cookie de sessão presente.

---

### SI-02.8 — Provisionamento do stack E2E (Setup)

**Frontend Runtime spec:** see `## Technical Specifications` → `### Frontend Runtime` → `#### auth-frontend/TD-08 — Provisionamento do stack E2E`

**Technical actions:**

1. Instalar `@playwright/test` no `next-frontend` e registrar o pin em `package.json`; acrescentar o script `test:e2e` (`playwright test`), que hoje não existe.
2. Criar `next-frontend/playwright.config.ts` — `webServer` dirigindo o **build de produção** (`npm run build && npm run start`), nunca o dev server, com `baseURL: http://localhost:3001`; a URL do Mailpit e a base da API vêm da configuração de ambiente, nunca hardcoded.
3. Criar `next-frontend/tests/auth.setup.ts` — o ponto de semeadura de sessão e o acesso ao Mailpit para capturar o e-mail de confirmação.

**Tests:** _(empty — Setup SI; o stack é o meio, não o objeto; as suítes E2E são autoradas por /plan-test-specs)_

**Dependencies:** none

**Acceptance criteria:**

- `npm run test:e2e` no `next-frontend` executa o Playwright contra o build de produção, com `nestjs-api`, `db` e `mailpit` reais.
- Nenhuma suíte sob `__tests__/` é coletada pelo Playwright, e nenhuma suíte `*.e2e-spec.ts` é coletada pelo Vitest.
- `npm test` (Vitest, duas lanes) continua passando sem depender do stack de E2E.

---

### SI-02.9 — Ciclo de vida do banco entre execuções E2E (Setup)

**Frontend Runtime spec:** see `## Technical Specifications` → `### Frontend Runtime` → `#### auth-frontend/TD-10 — Ciclo de vida do banco entre execuções E2E`

**Technical actions:**

1. Criar em `next-frontend/tests/` o utilitário de identidade única por execução (e-mail derivado de timestamp + UUID), a ser usado por toda suíte `*.e2e-spec.ts` que cria conta. **Nenhum reset de estado** — sem truncate, sem drop, sem migração entre execuções.
2. Registrar no próprio utilitário, em comentário, o gatilho de reavaliação já fixado na TD: quando houver pipeline de CI, ou quando surgir um teste que dependa de estado pré-existente, migrar para database dedicado com perfil `e2e` no Compose.

**Tests:** _(empty — Setup SI; a prova é a repetibilidade das suítes E2E, verificada na AC)_

**Dependencies:** SI-02.8

**Acceptance criteria:**

- Duas execuções consecutivas da mesma suíte E2E passam sem qualquer limpeza entre elas.
- Nenhuma suíte E2E desta slice assume estado pré-existente no banco de desenvolvimento.
- O banco de desenvolvimento continua intacto após uma execução completa de `npm run test:e2e`.

---

### SI-02.10 — Handler `POST /api/auth/login`

**Route:** POST /api/auth/login
**Authorization:** Anonymous _(see `### Authorization Matrix`)_

**Description:** Único handler anônimo que recebe `Set-Cookie` upstream — repassa o corpo verbatim e **reemite** o par de cookies de sessão com atributos do BFF.

**Technical actions:**

1. Criar `next-frontend/app/api/auth/login/route.ts` — `POST` que chama `api.POST("/auth/login", { body })` e devolve pelo utilitário de repasse de SI-02.5.
2. Reemitir os cookies de sessão pela função de SI-02.3 antes de devolver a resposta, no caso `200`.

**Tests:**

| Artifact | Layer | Test file |
|----------|-------|-----------|
| `app/api/auth/login/route.ts` | Integration (lane `node`, MSW tipado) — `200` com reemissão de cookie; `401 CREDENCIAIS_INVALIDAS`, `403 EMAIL_NAO_CONFIRMADO`, `400` e `429` repassados verbatim e **sem** `Set-Cookie` | `next-frontend/app/api/auth/login/__tests__/route.integration.test.ts` |

**Dependencies:** SI-02.5, SI-02.3

**Acceptance criteria:**

- `POST /api/auth/login` com credenciais válidas retorna `200` com o corpo upstream e header `Set-Cookie` carregando `HttpOnly`, `Secure`, `SameSite=Strict` e o `Max-Age` do upstream.
- `POST /api/auth/login` com senha incorreta retorna `401` com `error: "CREDENCIAIS_INVALIDAS"` e nenhum `Set-Cookie`.
- `POST /api/auth/login` para conta não confirmada retorna `403` com `error: "EMAIL_NAO_CONFIRMADO"`.
- Estouro do rate limit retorna `429` repassado verbatim.

---

### SI-02.11 — Handler `POST /api/auth/forgot-password`

**Route:** POST /api/auth/forgot-password
**Authorization:** Anonymous _(see `### Authorization Matrix`)_

**Description:** Repasse simples da solicitação de recuperação de senha. O upstream responde `204` mesmo quando o e-mail não existe, por design do fluxo — o handler não pode acrescentar informação que revele a existência da conta.

**Technical actions:**

1. Criar `next-frontend/app/api/auth/forgot-password/route.ts` — `POST` que chama `api.POST("/auth/forgot-password", { body })` e devolve o status upstream **sem corpo** no caso `204`.

**Tests:**

| Artifact | Layer | Test file |
|----------|-------|-----------|
| `app/api/auth/forgot-password/route.ts` | Integration (lane `node`, MSW tipado) — `204` sem corpo para e-mail existente e inexistente (respostas indistinguíveis); `400` e `429` repassados verbatim | `next-frontend/app/api/auth/forgot-password/__tests__/route.integration.test.ts` |

**Dependencies:** SI-02.5

**Acceptance criteria:**

- `POST /api/auth/forgot-password` com e-mail cadastrado e com e-mail desconhecido produzem respostas idênticas: `204`, sem corpo e sem headers que as diferenciem.
- Corpo inválido retorna `400` com o envelope upstream intacto.
- Estouro do rate limit retorna `429` repassado verbatim.

---

### SI-02.12 — Handler `POST /api/auth/resend-confirmation`

**Route:** POST /api/auth/resend-confirmation
**Authorization:** Anonymous _(see `### Authorization Matrix`)_

**Description:** Repasse do reenvio do e-mail de confirmação, consumido pelo `ResendConfirmationButton` dentro do painel de sucesso de `/signup`. É o handler em que o `429` precisa chegar distinguível à tela, para o botão exibir cooldown.

**Technical actions:**

1. Criar `next-frontend/app/api/auth/resend-confirmation/route.ts` — `POST` que chama `api.POST("/auth/resend-confirmation", { body })` e devolve pelo utilitário de repasse de SI-02.5.

**Tests:**

| Artifact | Layer | Test file |
|----------|-------|-----------|
| `app/api/auth/resend-confirmation/route.ts` | Integration (lane `node`, MSW tipado) — `204`; `409 EMAIL_JA_CONFIRMADO`, `400` e `429` repassados verbatim com status distinguível | `next-frontend/app/api/auth/resend-confirmation/__tests__/route.integration.test.ts` |

**Dependencies:** SI-02.5

**Acceptance criteria:**

- `POST /api/auth/resend-confirmation` para conta pendente retorna `204` sem corpo.
- Para conta já confirmada retorna `409` com `error: "EMAIL_JA_CONFIRMADO"`.
- Estouro do rate limit retorna `429` com status preservado — o cliente consegue distingui-lo de qualquer outro desfecho pelo status, sem inspecionar texto.

---

### SI-02.13 — Handler `POST /api/auth/refresh`

**Route:** POST /api/auth/refresh
**Authorization:** exige cookie de refresh _(see `### Authorization Matrix`)_

**Description:** Handler chamado pelo próprio BFF, nunca pelo browser. Renova o par de cookies de sessão e encerra a sessão no cliente quando o refresh é inválido ou reutilizado.

**Technical actions:**

1. Criar `next-frontend/app/api/auth/refresh/route.ts` — `POST` sem corpo que encaminha o cookie de refresh ao upstream.
2. No `200`, reemitir o novo par de cookies pela função de SI-02.3.
3. No `401` (`SESSAO_INVALIDA` ou `TOKEN_REUTILIZADO`), limpar os cookies de sessão via `clearAuthCookies` e propagar o status.

**Tests:**

| Artifact | Layer | Test file |
|----------|-------|-----------|
| `app/api/auth/refresh/route.ts` | Integration (lane `node`, MSW tipado) — `200` reemite o novo par; `401 SESSAO_INVALIDA` e `401 TOKEN_REUTILIZADO` limpam os cookies e propagam o status | `next-frontend/app/api/auth/refresh/__tests__/route.integration.test.ts` |

**Dependencies:** SI-02.5, SI-02.3, SI-02.4

**Acceptance criteria:**

- `POST /api/auth/refresh` com cookie de refresh válido retorna `200` e emite um novo par de cookies com os mesmos atributos de segurança do login.
- `POST /api/auth/refresh` sem cookie de refresh retorna `401` com `error: "SESSAO_INVALIDA"`.
- `POST /api/auth/refresh` com refresh já utilizado retorna `401` com `error: "TOKEN_REUTILIZADO"` e a resposta expira os cookies de sessão no browser.

---

### SI-02.14 — Handler `GET /api/users/me`

**Route:** GET /api/users/me
**Authorization:** Autenticado _(see `### Authorization Matrix`)_

**Description:** Única chamada autenticada da slice e o único ponto que exercita a renovação de SI-02.4 de ponta a ponta. É o que a fronteira de guarda consulta quando precisa da sessão real.

**Technical actions:**

1. Criar `next-frontend/app/api/users/me/route.ts` — `GET` que chama `api.GET("/users/me")` pelo cliente com a mecânica de renovação já instalada.
2. Propagar `401` ao chamador quando a própria renovação falhar, e `404` verbatim.

**Tests:**

| Artifact | Layer | Test file |
|----------|-------|-----------|
| `app/api/users/me/route.ts` | Integration (lane `node`, MSW tipado) — `200` com perfil verbatim; `401` upstream → refresh `200` → repetição devolve `200`; `401` upstream → refresh `401` propaga `401`; `404` verbatim | `next-frontend/app/api/users/me/__tests__/route.integration.test.ts` |

**Dependencies:** SI-02.5, SI-02.4

**Acceptance criteria:**

- `GET /api/users/me` com sessão válida retorna `200` com o corpo do perfil upstream inalterado.
- `GET /api/users/me` cujo access token expirou dispara uma renovação e, após ela, devolve `200` sem que o chamador perceba o `401` intermediário.
- `GET /api/users/me` sem sessão, ou com renovação falhando, retorna `401`.
- `404` upstream é propagado verbatim.

---

### SI-02.15.0 — Drift audit: Tela de cadastro de conta

**Figma:** https://www.figma.com/design/btF0MZVd48p33ufSP08RrX/FC-Tube?node-id=140-333
**UI Contract:** see `## Technical Specifications` → `### UI Contracts` → `#### Screen: Tela de cadastro de conta`

**Technical actions:**

1. **Drift audit** — invocar `figma:figma-implement-design` com:
   - Figma URL: https://www.figma.com/design/btF0MZVd48p33ufSP08RrX/FC-Tube?node-id=140-333
   - Reused DS components: `components/brand-logo.tsx`, `components/ui/form-label.tsx`, `components/ui/text-field.tsx`, `components/ui/button.tsx`, `components/auth-footer.tsx`, `components/ui/card.tsx`, `components/ui/icon-button.tsx`, `components/icons/eye.tsx`, `components/icons/arrow-back.tsx`, `components/ui/progress-linear.tsx`, `components/ui/checkbox.tsx`, `components/signup-form.tsx`, `components/signup-success-panel.tsx`
   - Server-connected component names: `SignupForm`, `Button "Create account"`, `SignupSuccessPanel`, `ResendConfirmationButton`
   - Target paths (contexto de leitura; sem escrita aqui): `next-frontend/app/signup/page.tsx` + `next-frontend/components/signup-form.tsx` + `next-frontend/components/signup-success-panel.tsx`

   Para cada componente da lista, fazer diff em nível de valor contra o arquivo em disco e classificar no enum de 4 valores (`alinhado` / `drift menor` / `drift relevante` / `componente ausente`). Compor a Decision pela política padrão. Ler as seções anteriores de `frontend-drift-report.md` para montar `prior_decisions` e preencher a coluna `Prior` com detecção de CONFLICT. Escrever a seção `## Screen: signup — audited at SI-02.15.0 ({YYYY-MM-DD})` em `frontend-drift-report.md`. **Sem edição de código.**

**Dependencies:** SI-02.0.1, SI-02.0.2, SI-02.0.3, SI-02.0.4

**Tests:** _(empty — audit-only; the report is the deliverable)_

**Acceptance criteria:**

- `frontend-drift-report.md` existe na pasta do plano e contém a seção `## Screen: signup` com a data da execução corrente no cabeçalho.
- Cada componente da lista Reused DS tem exatamente uma linha na tabela.
- Cada linha tem Decision preenchida: `alinhado` → `skip`; `drift menor` → `auto-Edit "<specifics>"` ou `exception "<reason>"`; `drift relevante` → `auto-Edit`, `exception` ou `CONFLICT: <one-liner>; <verb> "<specifics>"`; `componente ausente` → `create`.
- Toda decisão `exception` carrega justificativa de uma linha.
- `git diff --name-only HEAD -- next-frontend` está vazio ao fim do SI.

---

### SI-02.15a — Tela de cadastro de conta (visual shell)

**Route:** /signup
**Figma:** https://www.figma.com/design/btF0MZVd48p33ufSP08RrX/FC-Tube?node-id=140-333
**UI Contract:** see `## Technical Specifications` → `### UI Contracts` → `#### Screen: Tela de cadastro de conta`
**Drift Report:** see `frontend-drift-report.md` → `## Screen: signup`

**Technical actions:**

1. **Aplicar as decisões de drift** — ler a seção `## Screen: signup` do relatório e aplicar cada linha mecanicamente: `auto-Edit "<specifics>"` → `Edit` no arquivo do DS com os specifics documentados; `create` → criar o arquivo; `exception` / `skip` → nada; `CONFLICT: <one-liner>; <verb> "<specifics>"` → descartar o prefixo informativo e aplicar o verbo. Sem nova detecção nem novo julgamento — a auditoria já decidiu.
2. **Geração do shell visual** — invocar `figma:figma-implement-design` com a URL do Figma acima, a lista Reused DS (já refletindo as edições da ação 1), os nomes dos componentes server-connected e os target paths `next-frontend/app/signup/page.tsx` + `next-frontend/components/signup-form.tsx` + `next-frontend/components/signup-success-panel.tsx`.

**Dependencies:** SI-02.15.0 + SI-02.0.1, SI-02.0.2, SI-02.0.3, SI-02.0.4

**Tests:** _(empty — shell smoke-gated by build AC; Unit tests live in SI-Xb; E2E in /plan-test-specs spec)_

**Acceptance criteria:**

- `next-frontend/app/signup/page.tsx`, `components/signup-form.tsx` e `components/signup-success-panel.tsx` existem, exportam os componentes esperados e compilam com `npm run build`.
- A renderização corresponde ao nó `140:333` dentro da tolerância do conjunto de componentes do DS.
- Nenhum import em runtime além da lista Reused DS — o shell permanece visualmente escopado.
- `npm run check:tokens` passa.

---

### SI-02.15b — Tela de cadastro de conta (lógica & wiring)

**Test Specs:** see `next-frontend/specs/signup.plan.md`
**UI Contract:** see `## Technical Specifications` → `### UI Contracts` → `#### Screen: Tela de cadastro de conta`

**Technical actions:**

1. **Estratégia de renderização** — marcar `SignupForm` e `SignupSuccessPanel` como Client Components (`"use client"`), com o estado do formulário local (per `auth-frontend/TD-01`, Option A). A rota é anônima e não recebe guarda (`### Authorization Matrix`).
2. **Wiring de endpoint** — ligar o submit a `POST /api/auth/register` por `fetch` relativo, com corpo tipado a partir de `@/lib/api/contracts`; no `201`, substituir o card do formulário pelo `SignupSuccessPanel` **permanecendo em `/signup`** (per `auth-frontend/TD-09`). Ligar o `ResendConfirmationButton` a `POST /api/auth/resend-confirmation`.
3. **Mapeamento de erros** — aplicar a tabela `### Error Catalog → UX mapping` desta tela pelo módulo único de SI-02.6: `EMAIL_JA_EXISTE` no campo `email`; o `400` do `ValidationPipe` e o `INTERNAL_SERVER_ERROR` em `root.serverError`, nunca por campo; `EMAIL_JA_CONFIRMADO` e `429` tratados dentro do painel de sucesso.
4. **Espelho de validação no cliente** — aplicar `signup-schema.ts` por `zodResolver`: `name` obrigatório, `email` com formato, `password` de 8 a 128 sem exigência de complexidade, e `confirmPassword` igual a `password` (regra só do cliente). Desabilitar o submit enquanto o `TermsCheckbox` não estiver marcado.
5. **Acessibilidade e interações locais** — associar `ProgressLinear` e `PasswordStrengthHint` ao campo de senha por `aria-describedby`; dar rótulo acessível ao toggle de visibilidade; ligar cada instância do toggle ao seu próprio campo.

**Dependencies:** SI-02.15a, SI-02.5, SI-02.12, SI-02.6

**Tests:**

| Artifact | Layer | Test file |
|----------|-------|-----------|
| `components/signup-form.tsx` | Unit (lane `dom`, MSW `bff-handlers`) per `## Testing Requirements → next-frontend` § "Client component com estado/handlers" — submit feliz, cada linha do Error Catalog → UX mapping, validação pré-submit, gate do checkbox | `next-frontend/components/__tests__/signup-form.test.tsx` |
| `components/signup-success-panel.tsx` | Unit (lane `dom`, MSW `bff-handlers`) — exibe o e-mail registrado; reenvio em `204`, `409 EMAIL_JA_CONFIRMADO` e `429` | `next-frontend/components/__tests__/signup-success-panel.test.tsx` |

O E2E da página (fluxo completo de cadastro contra o stack real, incluindo a captura do e-mail no Mailpit) é autorado externamente por `/plan-test-specs` no arquivo apontado por `**Test Specs:**`.

**Acceptance criteria:**

- Submeter o formulário com dados válidos posta em `POST /api/auth/register` o corpo exato do DTO e, no `201`, o card do formulário é substituído pelo painel de sucesso com o e-mail registrado, sem sair de `/signup`.
- E-mail já cadastrado exibe o erro no campo `email`; corpo rejeitado pelo backend exibe erro em nível de formulário, nunca por campo.
- O submit permanece desabilitado enquanto o checkbox de termos não estiver marcado ou algum campo violar o espelho de validação.
- `confirmPassword` diferente de `password` bloqueia o submit sem qualquer ida à rede.
- O campo de senha referencia a barra de força e a dica por `aria-describedby`, e o toggle de visibilidade tem rótulo acessível.
- Reenviar a confirmação chama `POST /api/auth/resend-confirmation`; o `429` é distinguido dos demais desfechos e leva o botão a cooldown.

_Lacuna de design ativa: copy, layout e os estados do reenvio (em curso, concluído, cooldown) não existem em nenhum nó do Figma — ver `### Open Questions from Inventory` no `context.md`. As ACs acima fixam o comportamento; a apresentação é decisão do implementador até haver design._

---

### SI-02.16.0 — Drift audit: Tela de login

**Figma:** https://www.figma.com/design/btF0MZVd48p33ufSP08RrX/FC-Tube?node-id=138-179
**UI Contract:** see `## Technical Specifications` → `### UI Contracts` → `#### Screen: Tela de login`

**Technical actions:**

1. **Drift audit** — invocar `figma:figma-implement-design` com:
   - Figma URL: https://www.figma.com/design/btF0MZVd48p33ufSP08RrX/FC-Tube?node-id=138-179
   - Reused DS components: `components/brand-logo.tsx`, `components/ui/form-label.tsx`, `components/ui/text-field.tsx`, `components/ui/button.tsx`, `components/auth-footer.tsx`, `components/ui/card.tsx`
   - Server-connected component names: `Button — "Sign in"`
   - Target paths (contexto de leitura; sem escrita aqui): `next-frontend/app/login/page.tsx` + `next-frontend/components/login-form.tsx`

   Para cada componente da lista, fazer diff em nível de valor contra o arquivo em disco e classificar no enum de 4 valores. Compor a Decision pela política padrão. Ler as seções anteriores de `frontend-drift-report.md` para montar `prior_decisions` e preencher a coluna `Prior` com detecção de CONFLICT — esta tela compartilha com `/signup` cinco dos seis componentes, então é a auditoria onde o CONFLICT tem chance real de aparecer. Escrever a seção `## Screen: login — audited at SI-02.16.0 ({YYYY-MM-DD})`. **Sem edição de código.**

**Dependencies:** SI-02.0.1

**Tests:** _(empty — audit-only; the report is the deliverable)_

**Acceptance criteria:**

- `frontend-drift-report.md` contém a seção `## Screen: login` com a data da execução corrente no cabeçalho.
- Cada componente da lista Reused DS tem exatamente uma linha na tabela.
- Cada linha tem Decision preenchida conforme o status classificado.
- Componentes já auditados em `## Screen: signup` têm a coluna `Prior` preenchida, e qualquer divergência de decisão aparece como `CONFLICT`.
- `git diff --name-only HEAD -- next-frontend` está vazio ao fim do SI.

---

### SI-02.16a — Tela de login (visual shell)

**Route:** /login
**Figma:** https://www.figma.com/design/btF0MZVd48p33ufSP08RrX/FC-Tube?node-id=138-179
**UI Contract:** see `## Technical Specifications` → `### UI Contracts` → `#### Screen: Tela de login`
**Drift Report:** see `frontend-drift-report.md` → `## Screen: login`

**Technical actions:**

1. **Aplicar as decisões de drift** — ler a seção `## Screen: login` do relatório e aplicar cada linha mecanicamente, conforme o verbo da coluna Decision. Sem nova detecção nem novo julgamento.
2. **Geração do shell visual** — invocar `figma:figma-implement-design` com a URL acima, a lista Reused DS (já refletindo as edições da ação 1), o nome do componente server-connected (`Button — "Sign in"`) e os target paths `next-frontend/app/login/page.tsx` + `next-frontend/components/login-form.tsx`. **`app/login/page.tsx` já existe no repositório** — este SI a substitui pela tela do nó Figma, não cria do zero.

**Dependencies:** SI-02.16.0 + SI-02.0.1

**Tests:** _(empty — shell smoke-gated by build AC; Unit tests live in SI-Xb; E2E in /plan-test-specs spec)_

**Acceptance criteria:**

- `next-frontend/app/login/page.tsx` e `components/login-form.tsx` existem, exportam os componentes esperados e compilam com `npm run build`.
- A renderização corresponde ao nó `138:179` dentro da tolerância do conjunto de componentes do DS.
- A árvore introduz semântica de formulário (`<form>`, submit) que o Figma não modela — os nós `147:534` e `147:537` são frames de layout.
- Nenhum import em runtime além da lista Reused DS.
- `npm run check:tokens` passa.

_Inconsistência de copy registrada no inventário: o placeholder do campo de senha (`147:540`) diz "Enter your email". Confirmar com quem desenhou antes de reproduzi-la._

---

### SI-02.16b — Tela de login (lógica & wiring)

**Test Specs:** see `next-frontend/specs/login.plan.md`
**UI Contract:** see `## Technical Specifications` → `### UI Contracts` → `#### Screen: Tela de login`

**Technical actions:**

1. **Estratégia de renderização** — marcar `LoginForm` como Client Component (`"use client"`), estado local. Rota anônima, sem guarda.
2. **Wiring de endpoint** — ligar o submit a `POST /api/auth/login` por `fetch` relativo, com corpo tipado a partir de `@/lib/api/contracts`. Os cookies são reemitidos pelo BFF (SI-02.10) e **nunca lidos por JavaScript** — a tela não inspeciona sessão.
3. **Mapeamento de erros** — aplicar a tabela desta tela pelo módulo único de SI-02.6: `CREDENCIAIS_INVALIDAS` em `root.serverError` (o backend usa o mesmo código para e-mail desconhecido e senha errada, não há campo a culpar); `EMAIL_NAO_CONFIRMADO` em `root.serverError` **com CTA de reenvio de confirmação** apontando para `POST /api/auth/resend-confirmation`; `429`, `400` e `500` em `root.serverError`.
4. **Espelho de validação no cliente** — aplicar `login-schema.ts` por `zodResolver`: `email` com formato, `password` de 8 a 128.
5. **Navegação** — ligar `ForgotPasswordLink` (`147:539`) a `/forgot-password` e o `AuthFooter` a `/signup`, ambos client-side.

**Dependencies:** SI-02.16a, SI-02.10, SI-02.12, SI-02.6

**Tests:**

| Artifact | Layer | Test file |
|----------|-------|-----------|
| `components/login-form.tsx` | Unit (lane `dom`, MSW `bff-handlers`) per § "Client component com estado/handlers" — submit feliz, cada linha do Error Catalog → UX mapping, validação pré-submit, CTA de reenvio no `403` | `next-frontend/components/__tests__/login-form.test.tsx` |

O E2E da página (login contra o stack real e navegação autenticada subsequente, que é o que prova o cookie reemitido) é autorado externamente por `/plan-test-specs`.

**Acceptance criteria:**

- Submeter credenciais válidas posta em `POST /api/auth/login` o corpo exato do DTO e a sessão passa a existir pelos cookies reemitidos pelo BFF.
- Senha incorreta e e-mail desconhecido produzem a **mesma** mensagem em nível de formulário — a tela não revela qual dos dois falhou.
- Conta não confirmada exibe erro em nível de formulário com um CTA que chama `POST /api/auth/resend-confirmation`.
- Nenhum código da tela lê cookie por JavaScript.
- `/forgot-password` e `/signup` são alcançáveis pelos links da tela sem recarregar a página.

_Lacuna de design ativa: a superfície de erro em nível de formulário e o CTA de reenvio não estão modelados em nenhum nó do Figma. As ACs fixam o comportamento; a apresentação é decisão do implementador até haver design._

---

### SI-02.17.0 — Drift audit: Tela de solicitação de redefinição de senha

**Figma:** https://www.figma.com/design/btF0MZVd48p33ufSP08RrX/FC-Tube?node-id=140-289
**UI Contract:** see `## Technical Specifications` → `### UI Contracts` → `#### Screen: Tela de solicitação de redefinição de senha`

**Technical actions:**

1. **Drift audit** — invocar `figma:figma-implement-design` com:
   - Figma URL: https://www.figma.com/design/btF0MZVd48p33ufSP08RrX/FC-Tube?node-id=140-289
   - Reused DS components: `components/brand-logo.tsx`, `components/ui/form-label.tsx`, `components/ui/text-field.tsx`, `components/ui/button.tsx`, `components/auth-footer.tsx`, `components/ui/card.tsx`, `components/icons/arrow-back.tsx`
   - Server-connected component names: `Button (submit)`
   - Target paths (contexto de leitura; sem escrita aqui): `next-frontend/app/forgot-password/page.tsx` + `next-frontend/components/forgot-password-form.tsx`

   Para cada componente da lista, fazer diff em nível de valor contra o arquivo em disco e classificar no enum de 4 valores. Ler as seções `## Screen: signup` e `## Screen: login` para montar `prior_decisions` e preencher a coluna `Prior` com detecção de CONFLICT. Escrever a seção `## Screen: forgot-password — audited at SI-02.17.0 ({YYYY-MM-DD})`. **Sem edição de código.**

**Dependencies:** SI-02.0.1, SI-02.0.4

**Tests:** _(empty — audit-only; the report is the deliverable)_

**Acceptance criteria:**

- `frontend-drift-report.md` contém a seção `## Screen: forgot-password` com a data da execução corrente no cabeçalho.
- Cada componente da lista Reused DS tem exatamente uma linha na tabela.
- Cada linha tem Decision preenchida conforme o status classificado, e as decisões anteriores das duas telas já auditadas aparecem na coluna `Prior`.
- `git diff --name-only HEAD -- next-frontend` está vazio ao fim do SI.

---

### SI-02.17a — Tela de solicitação de redefinição de senha (visual shell)

**Route:** /forgot-password
**Figma:** https://www.figma.com/design/btF0MZVd48p33ufSP08RrX/FC-Tube?node-id=140-289
**UI Contract:** see `## Technical Specifications` → `### UI Contracts` → `#### Screen: Tela de solicitação de redefinição de senha`
**Drift Report:** see `frontend-drift-report.md` → `## Screen: forgot-password`

**Technical actions:**

1. **Aplicar as decisões de drift** — ler a seção `## Screen: forgot-password` do relatório e aplicar cada linha mecanicamente, conforme o verbo da coluna Decision. Sem nova detecção nem novo julgamento.
2. **Geração do shell visual** — invocar `figma:figma-implement-design` com a URL acima, a lista Reused DS (já refletindo as edições da ação 1), o nome do componente server-connected (`Button (submit)`) e os target paths `next-frontend/app/forgot-password/page.tsx` + `next-frontend/components/forgot-password-form.tsx`. **A rota é `/forgot-password`**, embora o frame e o `<h1>` do Figma se chamem "Reset password": o conteúdo é a etapa de solicitação.

**Dependencies:** SI-02.17.0 + SI-02.0.1, SI-02.0.4

**Tests:** _(empty — shell smoke-gated by build AC; Unit tests live in SI-Xb; E2E in /plan-test-specs spec)_

**Acceptance criteria:**

- `next-frontend/app/forgot-password/page.tsx` e `components/forgot-password-form.tsx` existem, exportam os componentes esperados e compilam com `npm run build`.
- A tela é servida em `/forgot-password`; nenhuma rota `/reset-password` é criada — a tela de redefinição está diferida.
- A renderização corresponde ao nó `140:289` dentro da tolerância do conjunto de componentes do DS.
- Nenhum import em runtime além da lista Reused DS.
- `npm run check:tokens` passa.

_Inconsistência de copy registrada no inventário: o `AuthFooter` (`2394:2276`) pergunta "Remember your password?" e rotula o link como "Sign up" — quem lembrou a senha quer entrar, não se cadastrar. O destino do `BackLink` (`143:2343`) também não está definido no Figma. Confirmar ambos antes de reproduzi-los._

---

### SI-02.17b — Tela de solicitação de redefinição de senha (lógica & wiring)

**Test Specs:** see `next-frontend/specs/forgot-password.plan.md`
**UI Contract:** see `## Technical Specifications` → `### UI Contracts` → `#### Screen: Tela de solicitação de redefinição de senha`

**Technical actions:**

1. **Estratégia de renderização** — marcar `ForgotPasswordForm` como Client Component (`"use client"`), estado local. Rota anônima, sem guarda.
2. **Wiring de endpoint** — ligar o submit a `POST /api/auth/forgot-password` por `fetch` relativo, com corpo tipado a partir de `@/lib/api/contracts`. O `204` é o único desfecho de sucesso e chega igual para e-mail existente e inexistente — a tela **não pode** revelar se a conta existe.
3. **Estado de sucesso** — introduzir a confirmação pós-envio que o Figma não modela, redigida de forma neutra quanto à existência da conta.
4. **Mapeamento de erros** — aplicar a tabela desta tela pelo módulo único de SI-02.6: `429`, o `400` do `ValidationPipe` e o `INTERNAL_SERVER_ERROR` em `root.serverError`. Nenhum código de domínio alcança esta tela.
5. **Espelho de validação no cliente** — aplicar `forgot-password-schema.ts` por `zodResolver`: `email` obrigatório com formato.

**Dependencies:** SI-02.17a, SI-02.11, SI-02.6

**Tests:**

| Artifact | Layer | Test file |
|----------|-------|-----------|
| `components/forgot-password-form.tsx` | Unit (lane `dom`, MSW `bff-handlers`) per § "Client component com estado/handlers" — submit feliz leva ao estado de sucesso; e-mail existente e inexistente produzem a mesma tela; `429` e `500` em nível de formulário; validação pré-submit | `next-frontend/components/__tests__/forgot-password-form.test.tsx` |

O E2E da página (solicitação contra o stack real e captura do e-mail de recuperação no Mailpit) é autorado externamente por `/plan-test-specs`.

**Acceptance criteria:**

- Submeter um e-mail válido posta em `POST /api/auth/forgot-password` e a tela passa ao estado de confirmação.
- Um e-mail cadastrado e um desconhecido levam a exatamente a mesma tela e ao mesmo texto — nada na UI distingue os dois casos.
- E-mail malformado bloqueia o submit sem qualquer ida à rede.
- Estouro do rate limit exibe erro em nível de formulário sem revelar existência de conta.
- Nenhum link desta tela leva a `/reset-password` — a tela de redefinição está diferida.

_Lacuna de design ativa: a mensagem de sucesso pós-envio não existe em nenhum nó do Figma e, diferente de `/signup`, nenhuma TD a fechou. O texto é decisão do implementador, restrito pela AC de indistinguibilidade acima._

---

## Technical Specifications

### API Contracts

Duas superfícies HTTP nesta slice. O browser fala **apenas** com a primeira (`next-frontend-env-config/TD-04`); a segunda é a mudança de contrato no `nestjs-project` que esta slice assume (validation.md DG-2).

#### Superfície 1 — Route handlers do BFF (`next-frontend/app/api/**/route.ts`)

Todos seguem a mesma forma, fixada por `auth-frontend/TD-02` (cliente `openapi-fetch` num módulo único) e `auth-frontend/TD-11` (corpo de erro repassado verbatim): recebem o corpo do browser, chamam o `nestjs-api` pelo cliente tipado, reemitem os cookies de sessão conforme `auth-frontend/TD-03` e devolvem o corpo upstream sem reescrita.

#### POST /api/auth/register

**Upstream:** `POST /auth/register`

**Request body:**

```json
{ "name": "string (required)", "email": "string (required)", "password": "string (required)" }
```

**Responses:**
- `201 Created` — corpo do `RegisterResponseDto` upstream, repassado verbatim. Não emite cookie de sessão: o `201` não faz auto-login (`auth/TD-09` — o login de conta não confirmada é rejeitado com `403 EMAIL_NAO_CONFIRMADO`).
- `400 Bad Request` — `{ statusCode, error, message, details }` verbatim do upstream.
- `409 Conflict` — `{ statusCode, error, message }` verbatim, `error` = `EMAIL_JA_EXISTE`.

#### POST /api/auth/login

**Upstream:** `POST /auth/login`

**Request body:**

```json
{ "email": "string (required)", "password": "string (required)" }
```

**Responses:**
- `200 OK` — corpo upstream verbatim **+ reemissão dos cookies de sessão** (ver `#### Reemissão de cookies` abaixo).
- `400 Bad Request` — `{ statusCode, error, message, details }` verbatim.
- `401 Unauthorized` — `error` = `CREDENCIAIS_INVALIDAS`.
- `403 Forbidden` — `error` = `EMAIL_NAO_CONFIRMADO`.
- `429 Too Many Requests` — rate limit de `auth/TD-13`.

#### POST /api/auth/forgot-password

**Upstream:** `POST /auth/forgot-password`

**Request body:**

```json
{ "email": "string (required)" }
```

**Responses:**
- `204 No Content` — sem corpo. O upstream responde `204` independentemente de o e-mail existir.
- `400 Bad Request` — `{ statusCode, error, message, details }` verbatim.
- `429 Too Many Requests` — rate limit de `auth/TD-13`.

#### POST /api/auth/resend-confirmation

**Upstream:** `POST /auth/resend-confirmation`

**Request body:**

```json
{ "email": "string (required)" }
```

**Responses:**
- `204 No Content` — sem corpo.
- `400 Bad Request` — `{ statusCode, error, message, details }` verbatim.
- `429 Too Many Requests` — rate limit de `auth/TD-13`. É o desfecho que o `ResendConfirmationButton` precisa distinguir para exibir cooldown.

#### POST /api/auth/refresh

**Upstream:** `POST /auth/refresh`

Chamado pelo próprio BFF, não pelo browser — é o gatilho reativo de `auth-frontend/TD-04` (renovação ao receber `401` real, com deduplicação *single-flight*).

**Request body:** vazio. O refresh token viaja no cookie.

**Responses:**
- `200 OK` — reemite o novo par de cookies de sessão.
- `401 Unauthorized` — `error` ∈ { `SESSAO_INVALIDA`, `TOKEN_REUTILIZADO` }. Encerra a sessão no cliente.

#### GET /api/users/me

**Upstream:** `GET /users/me`

Única chamada autenticada desta slice (`auth-frontend/TD-04`). É o que a fronteira de guarda de `auth-frontend/TD-05` consulta quando precisa da sessão real.

**Responses:**
- `200 OK` — corpo do perfil upstream verbatim.
- `401 Unauthorized` — dispara o fluxo de refresh de `auth-frontend/TD-04`; se o refresh também falhar, propaga o `401`.
- `404 Not Found` — propagado verbatim.

#### Reemissão de cookies (`auth-frontend/TD-03`, Option B)

O BFF **reemite** os cookies em vez de repassar o `Set-Cookie` upstream: o descasamento de `path` é estrutural (os caminhos da API são dela e nunca coincidem com os do BFF). Nome e TTL são lidos do `Set-Cookie` upstream — o backend permanece dono dos valores, preservando o princípio de não duplicar contrato. O `Secure` é acrescentado também em desenvolvimento.

#### Superfície 2 — Contrato de erro no `nestjs-project`

Mudança aditiva sobre o envelope já implementado, decidida em `http-error-contract/TD-01` (Option B) e `TD-02` (Option A), e atribuída a esta slice por `validation.md` DG-2.

**Envelope (após a mudança):**

```json
{ "statusCode": 409, "error": "EMAIL_JA_EXISTE", "message": "E-mail já está cadastrado" }
```

```json
{ "statusCode": 400, "error": "VALIDATION_ERROR", "message": "Dados inválidos", "details": [{ "field": "email", "message": "e-mail inválido" }] }
```

- `statusCode` — espelha o status HTTP. Inalterado.
- `error` — código de domínio. Passa a ser declarado como **enum** no `ErrorResponseDto` (`http-error-contract/TD-03` + `auth-frontend/TD-11`), para que uma renomeação quebre o `tsc` do frontend em vez da tela.
- `message` — **sempre `string`** (`http-error-contract/TD-02`). O filtro normaliza a saída do `ValidationPipe`: as violações por campo migram para `details` e `message` recebe uma frase única de nível de formulário. Elimina a união `string | string[]` que hoje existe entre `DomainException` e `ValidationPipe`.
- `details` — **opcional**, presente apenas quando o erro tem granularidade por campo, no formato `[{ field, message }]`. Contrato preparado: nenhum consumidor nesta fase (`http-error-contract/TD-01`, Revision de 2026-08-22).

**Arquivo afetado:** `nestjs-project/src/common/filters/http-exception.filter.ts` — hoje devolve `{ statusCode, error, message }` e propaga `resp.message` sem normalizar o array do `ValidationPipe`.

**Propagação obrigatória após a mudança:** regerar a spec (`docker compose run --rm nestjs-api npm run openapi:generate`, per `openapi-spec/TD-04`) e então `./scripts/generate-api-types.sh`, antes de qualquer tipagem no frontend. As 8 suítes e2e existentes seguem válidas sem edição — a mudança é aditiva.

#### Validation Rules

Espelham os DTOs do backend (`auth/TD-11` — política de senha; `class-validator`). O schema Zod do cliente (`auth-frontend/TD-06`) é tipado contra `contracts.ts` e é **afordância de UX**: a autoridade sobre a regra permanece no backend, que revalida sempre.

- `name`: obrigatório
- `email`: obrigatório, formato de e-mail
- `password`: obrigatório, mín. 8, máx. 128, sem exigência de complexidade (`auth/TD-11`)

### Authorization Matrix

Rotas do BFF (`next-frontend/app/api/**`). "Sessão" = par de cookies `httpOnly` emitido por `auth/TD-03` e reemitido pelo BFF conforme `auth-frontend/TD-03`.

| Endpoint | Anônimo | Autenticado |
|----------|---------|-------------|
| POST /api/auth/register | ✓ | ✓ |
| POST /api/auth/login | ✓ | ✓ |
| POST /api/auth/forgot-password | ✓ | ✓ |
| POST /api/auth/resend-confirmation | ✓ | ✓ |
| POST /api/auth/refresh | ✗ _(exige cookie de refresh)_ | ✓ |
| GET /api/users/me | ✗ | ✓ |

**Fronteira de guarda de página** (`auth-frontend/TD-05`, Option A): o redirecionamento é otimista, no proxy, e cobre prefetch. A autorização real continua sendo do backend, que já responde `401` corretamente — o proxy decide se redireciona, não se autoriza.

| Rota de página | Sem sessão | Com sessão |
|----------------|-----------|------------|
| `/signup` | renderiza | renderiza _(nenhuma TD desta slice decide redirecionar usuário logado para fora das telas de auth)_ |
| `/login` | renderiza | renderiza _(idem)_ |
| `/forgot-password` | renderiza | renderiza _(idem)_ |

_As três telas desta slice são públicas por natureza. A tabela existe porque `auth-frontend/TD-05` fixa o mecanismo agora, para a Fase 04 aplicá-lo sobre superfícies protegidas de verdade._

### Error Catalog

**Formato da resposta de erro** — herdado da slice `auth` e **estendido nesta** por `http-error-contract/TD-01` e `TD-02`: `{ statusCode, error, message, details? }`. A coluna abaixo chama-se `errorCode` por continuidade com o artefato da slice irmã; o **nome do campo no envelope é `error`**.

| errorCode | HTTP | Trigger | Tela que consome |
|-----------|------|---------|------------------|
| EMAIL_JA_EXISTE | 409 | `POST /auth/register` com e-mail já cadastrado | `/signup` |
| EMAIL_JA_CONFIRMADO | 409 | `POST /auth/resend-confirmation` para conta já confirmada | `/signup` (painel de sucesso) |
| CREDENCIAIS_INVALIDAS | 401 | `POST /auth/login` com e-mail desconhecido OU senha incorreta | `/login` |
| EMAIL_NAO_CONFIRMADO | 403 | `POST /auth/login` com `is_confirmed = false` | `/login` |
| SESSAO_INVALIDA | 401 | `POST /auth/refresh` sem cookie de refresh, ou com refresh inválido/expirado | transversal (BFF) |
| TOKEN_REUTILIZADO | 401 | `POST /auth/refresh` com refresh já utilizado (revoga a família) | transversal (BFF) |
| TOKEN_INVALIDO | 400 | `GET /auth/confirm` ou `POST /auth/reset-password` com token inválido/expirado | _nenhuma nesta slice_ — as duas telas correspondentes estão diferidas |

**Códigos não-domínio relevantes às telas:**

| errorCode | HTTP | Trigger | Tratamento |
|-----------|------|---------|------------|
| _(código do `ValidationPipe`)_ | 400 | corpo que viola os DTOs do backend | vai para `root.serverError` do formulário, **não** por campo (`auth-frontend/TD-11`) |
| INTERNAL_SERVER_ERROR | 500 | falha não tratada | superfície de erro em nível de formulário |

**Por que o `400` não é renderizado por campo.** `auth-frontend/TD-11` (Option A) trata um `400` de validação chegando à tela em produção como divergência entre o schema Zod do cliente (`auth-frontend/TD-06`, que valida os mesmos campos antes do submit) e os DTOs do backend — ou seja, um bug a corrigir, não um erro de usuário a exibir por campo. O campo `details` existe no envelope mas **não tem consumidor nesta fase** (`http-error-contract/TD-01`, Revision de 2026-08-22).

**Mapeamento código→campo.** A tabela que decide qual campo do React Hook Form recebe cada código de domínio mora no cliente, num **módulo único**, não replicada por formulário (`auth-frontend/TD-11`, consequência (ii)).

### UI Contracts

#### Screen: Tela de cadastro de conta

**Route:** `/signup`
**Figma:** https://www.figma.com/design/btF0MZVd48p33ufSP08RrX/FC-Tube?node-id=140-333 (node `btF0MZVd48p33ufSP08RrX:140:333`)
**Purpose:** "Telas de cadastro, login, confirmação de conta e recuperação de senha" — esta tela cobre o cadastro de conta.

**Auth requirement:** Anonymous _(source: §Authorization Matrix — `POST /api/auth/register` e `POST /api/auth/resend-confirmation` são ambos ✓ para anônimo)_

**Rendering strategy:** Client Component submetendo a route handler do BFF via `fetch('/api/...')` relativo _(source: `auth-frontend/TD-01` — Option A; a Option B, Server Actions, foi descartada por retrabalho de fundação sobre a fronteira `/api/...` já materializada)_

**Reused DS components:**
- `next-frontend/components/brand-logo.tsx` — BrandLogo (2387:2263) — lockup play-mark + wordmark "StreamTube"
- `next-frontend/components/ui/form-label.tsx` — FormLabel ×4
- `next-frontend/components/ui/text-field.tsx` — TextField ×4 (Full Name, Email address, Password, Confirm Password)
- `next-frontend/components/ui/button.tsx` — Button "Create account" (143:2443) e ResendConfirmationButton
- `next-frontend/components/auth-footer.tsx` — AuthFooter (2394:2284)
- `next-frontend/components/ui/card.tsx (new)` — Card (143:2400)
- `next-frontend/components/ui/icon-button.tsx (new)` — PasswordVisibilityToggle; **uma única implementação atende os dois campos de senha** (`I143:2435;82:6685` e `I143:2436;82:6685`)
- `next-frontend/components/icons/eye.tsx (new)` — EyeIcon; reutilizado nos dois campos de senha
- `next-frontend/components/icons/arrow-back.tsx (new)` — ArrowBackIcon (I143:2407;107:246)
- `next-frontend/components/ui/progress-linear.tsx (new)` — ProgressLinear de força de senha (143:2446)
- `next-frontend/components/ui/checkbox.tsx (new)` — TermsCheckbox (143:2445)
- `next-frontend/components/signup-form.tsx (new)` — SignupForm (143:2399)
- `next-frontend/components/signup-success-panel.tsx (new)` — SignupSuccessPanel

**Server-connected components:**
- `SignupForm` — verbs: submeter cadastro; exibir erros do servidor | endpoint: `POST /api/auth/register` (§API Contracts) | reuse: `next-frontend/components/signup-form.tsx (new)`
- `Button "Create account"` — verb: dispara a submissão | endpoint: `POST /api/auth/register` | reuse: `next-frontend/components/ui/button.tsx`
- `SignupSuccessPanel` — verb: exibir a confirmação do cadastro com o e-mail registrado, substituindo o formulário após o `201` | endpoint: `POST /api/auth/register` (resposta `201`) | reuse: `next-frontend/components/signup-success-panel.tsx (new)`
- `ResendConfirmationButton` — verb: reenviar o e-mail de confirmação | endpoint: `POST /api/auth/resend-confirmation` | reuse: `next-frontend/components/ui/button.tsx`

**Behaviors:**

*Rendered states:*
- Loading: **não modelado no Figma.** Não há variante de loading/disabled para o Button "Create account" nem instância de spinner no nó. `next-frontend/components/icons/spinner.tsx` já existe no repo e é o alvo natural, mas sem evidência de uso.
- Empty: não se aplica.
- Success: o card do formulário é **substituído** pelo `SignupSuccessPanel` e o usuário **permanece em `/signup`** _(per `auth-frontend/TD-09`, Option A)_. O `201` não emite cookie de sessão — não há auto-login, e o login de conta não confirmada é rejeitado com `403 EMAIL_NAO_CONFIRMADO`, o que é a razão de o painel hospedar o reenvio em vez de empurrar para `/login`.
- Error: **variante de erro inline do `TextField` não modelada no Figma**, embora o formulário exija validação local dos quatro campos. Mapeamento por código na tabela abaixo.

*Interactions:*
- `TermsCheckbox` (143:2445) → gate de habilitação do submit; o estado de aceite vive no cliente.
- `TextField — Password` valor digitado → recalcula `ProgressLinear` (143:2446) e `PasswordStrengthHint` (143:2444) no cliente, sem depender do backend.
- `PasswordVisibilityToggle` click → alterna a visibilidade do campo correspondente (instância independente por campo).
- `AuthFooter` "Sign in" → navegação client-side para `/login`.

**Error Catalog → UX mapping:**

| errorCode (from §Error Catalog) | UX treatment |
|---------------------------------|--------------|
| `EMAIL_JA_EXISTE` | Erro no campo `email`, via o módulo único de mapeamento código→campo (`auth-frontend/TD-11`) |
| `EMAIL_JA_CONFIRMADO` | Dentro do `SignupSuccessPanel`, no reenvio: _TBD — implementer decides per screen_ |
| `429` no reenvio | Cooldown do `ResendConfirmationButton`: _TBD — copy e duração não definidas em nenhum nó_ |
| _(código do `ValidationPipe`, 400)_ | `root.serverError` do formulário — nunca por campo (`auth-frontend/TD-11`) |
| `INTERNAL_SERVER_ERROR` | `root.serverError` do formulário |

**Client-side validation mirror:** _(source: §API Contracts → Validation Rules)_

- `name`: obrigatório
- `email`: obrigatório, formato de e-mail
- `password`: obrigatório, mín. 8, máx. 128, sem exigência de complexidade
- `confirmPassword`: obrigatório, deve igualar `password` — **regra só do cliente**; o backend não a conhece (não há campo correspondente no DTO)

**Accessibility notes:**
- `ProgressLinear` (143:2446) e `PasswordStrengthHint` (143:2444) precisam de associação programática com o campo de senha (`aria-describedby`) — não anotado no Figma.
- `PasswordVisibilityToggle` precisa de rótulo acessível — não anotado no Figma.

---

#### Screen: Tela de login

**Route:** `/login`
**Figma:** https://www.figma.com/design/btF0MZVd48p33ufSP08RrX/FC-Tube?node-id=138-179 (node `btF0MZVd48p33ufSP08RrX:138:179`)
**Purpose:** "Telas de cadastro, login, confirmação de conta e recuperação de senha" — esta tela cobre a autenticação de um usuário já cadastrado.

**Auth requirement:** Anonymous _(source: §Authorization Matrix — `POST /api/auth/login` é ✓ para anônimo)_

**Rendering strategy:** Client Component submetendo a route handler do BFF via `fetch('/api/...')` relativo _(source: `auth-frontend/TD-01` — Option A)_

**Reused DS components:**
- `next-frontend/components/brand-logo.tsx` — BrandLogo (2387:2244)
- `next-frontend/components/ui/form-label.tsx` — FormLabel ×2
- `next-frontend/components/ui/text-field.tsx` — TextField e-mail (147:536) e senha (147:540)
- `next-frontend/components/ui/button.tsx` — Button "Sign in" (147:541)
- `next-frontend/components/auth-footer.tsx` — AuthFooter (2394:2271)
- `next-frontend/components/ui/card.tsx (new)` — Card (143:1250)

**Server-connected components:**
- `Button — "Sign in"` — verb: autenticar usuário a partir de e-mail e senha e iniciar sessão | endpoint: `POST /api/auth/login` (§API Contracts) | reuse: `next-frontend/components/ui/button.tsx`

**Behaviors:**

*Rendered states:*
- Loading: não modelado no Figma (mesma lacuna de `/signup`).
- Empty: não se aplica.
- Success: sessão iniciada — os cookies são **reemitidos pelo BFF** (`auth-frontend/TD-03`, Option B), nunca lidos por JavaScript. O destino pós-login não é decidido por nenhuma TD desta slice.
- Error: variante de erro inline do `TextField` não modelada no Figma.

*Interactions:*
- `ForgotPasswordLink` "Forgot password?" (147:539) → navegação para `/forgot-password`, tela inventariada nesta mesma fase.
- `AuthFooter` "Sign up" → navegação client-side para `/signup`.
- **Não há nó `<form>` na árvore Figma:** campos, botão e agrupamentos (147:534 / 147:537) são frames de layout. A semântica de formulário (submit, validação local, estados de erro/loading) é introduzida na implementação; o `Button` é o portador do comportamento server-connected.

**Error Catalog → UX mapping:**

| errorCode (from §Error Catalog) | UX treatment |
|---------------------------------|--------------|
| `CREDENCIAIS_INVALIDAS` | Erro em nível de formulário (`root.serverError`) — o backend usa o mesmo código para e-mail desconhecido e senha incorreta, então não há campo a culpar |
| `EMAIL_NAO_CONFIRMADO` | Erro em nível de formulário **com CTA de reenvio de confirmação**: _TBD — a superfície não está modelada em nenhum nó_ |
| `429` | Erro em nível de formulário: _TBD — copy não definida_ |
| _(código do `ValidationPipe`, 400)_ | `root.serverError` |
| `INTERNAL_SERVER_ERROR` | `root.serverError` |

**Client-side validation mirror:** _(source: §API Contracts → Validation Rules)_

- `email`: obrigatório, formato de e-mail
- `password`: obrigatório, mín. 8, máx. 128

**Accessibility notes:** seguir os padrões do DS — nenhuma anotação de a11y específica neste nó.

---

#### Screen: Tela de solicitação de redefinição de senha

**Route:** `/forgot-password`
**Figma:** https://www.figma.com/design/btF0MZVd48p33ufSP08RrX/FC-Tube?node-id=140-289 (node `btF0MZVd48p33ufSP08RrX:140:289`)
**Purpose:** "Telas de cadastro, login, confirmação de conta e recuperação de senha" — esta tela cobre a etapa de **solicitação** do link de recuperação de senha por e-mail.

**Auth requirement:** Anonymous _(source: §Authorization Matrix — `POST /api/auth/forgot-password` é ✓ para anônimo)_

**Rendering strategy:** Client Component submetendo a route handler do BFF via `fetch('/api/...')` relativo _(source: `auth-frontend/TD-01` — Option A)_

**Reused DS components:**
- `next-frontend/components/brand-logo.tsx` — BrandLogo (2387:2252)
- `next-frontend/components/ui/form-label.tsx` — FormLabel (2172:282)
- `next-frontend/components/ui/text-field.tsx` — TextField (143:2351)
- `next-frontend/components/ui/button.tsx` — Button "Send reset link" (143:2354)
- `next-frontend/components/auth-footer.tsx` — AuthFooter (2394:2276)
- `next-frontend/components/ui/card.tsx (new)` — Card (143:2308)
- `next-frontend/components/icons/arrow-back.tsx (new)` — ArrowBackIcon (`I143:2343;107:246`)

**Server-connected components:**
- `Button (submit)` — verb: solicitar o envio do e-mail de recuperação de senha para o endereço informado | endpoint: `POST /api/auth/forgot-password` (§API Contracts) | reuse: `next-frontend/components/ui/button.tsx`

**Behaviors:**

*Rendered states:*
- Loading: não modelado no Figma.
- Empty: não se aplica.
- Success: **não modelado.** O nó não expõe mensagem de sucesso pós-envio, e — diferente de `/signup` — esta lacuna **não** foi fechada por TD alguma (`auth-frontend/TD-09` decide apenas o desfecho do `/signup`). O upstream responde `204` independentemente de o e-mail existir, então a tela não pode revelar se a conta existe.
- Error: variante de erro inline do `TextField` não modelada no Figma.

*Interactions:*
- `AuthFooter` (2394:2276) → navegação; **destino ambíguo** — ver mapeamento abaixo e `## Open questions` do inventário.

**Error Catalog → UX mapping:**

| errorCode (from §Error Catalog) | UX treatment |
|---------------------------------|--------------|
| `429` | Erro em nível de formulário: _TBD — copy não definida_ |
| _(código do `ValidationPipe`, 400)_ | `root.serverError` |
| `INTERNAL_SERVER_ERROR` | `root.serverError` |

_Nenhum código de domínio alcança esta tela: o `204` é devolvido mesmo quando o e-mail não existe, por design do fluxo de recuperação._

**Client-side validation mirror:** _(source: §API Contracts → Validation Rules)_

- `email`: obrigatório, formato de e-mail

**Accessibility notes:** seguir os padrões do DS — nenhuma anotação de a11y específica neste nó.

**Identidade da tela:** o frame Figma e o `<h1>` chamam-se "Reset password", mas o conteúdo (campo de e-mail + botão "Send reset link") é a etapa de *solicitação*. A rota é `/forgot-password`; `/reset-password` — a tela de definição da nova senha — está registrada como diferida em `## Non-UI / Deferred Capabilities` do `context.md` e não existe em nenhum nó do arquivo Figma.

### Frontend Runtime

Oito TDs desta slice declaram `Renders in: frontend-runtime`. As TDs herdadas que também o declaram — `next-frontend-api-typing/TD-02`, `TD-03`, `next-frontend-env-config/TD-01`, `next-frontend-msw-base/TD-01` a `TD-04` — **não são materializadas aqui**: já foram entregues pelas tasks que as decidiram, e esta slice apenas as honra. Ver `## Inherited Decisions Detail` do `context.md`.

#### auth-frontend/TD-01 — Mecanismo de submissão dos formulários de auth

**Pattern:** route handlers do BFF (`app/api/auth/**/route.ts`) + `fetch("/api/...")` no cliente. Não por superioridade técnica intrínseca — a Option B (Server Actions) é o idioma mais moderno e ganha em progressive enhancement —, mas porque três tasks já entregues materializaram a fronteira `/api/...`: o contrato do login já está escrito em `contracts.ts`, o arquivo de fake das rotas relativas já existe vazio esperando o primeiro handler, e as regras de teste do `next-frontend/CLAUDE.md` descrevem essa forma em detalhe.

**Setup:**

```tsx
// next-frontend/app/api/auth/login/route.ts
export async function POST(request: Request) {
  const body = await request.json();
  const { data, error, response } = await api.POST("/auth/login", { body });
  // repasse verbatim do envelope upstream + status (auth-frontend/TD-11)
  return NextResponse.json(data ?? error, { status: response.status });
}
```

Os quatro handlers de `/api/auth/{register,login,forgot-password,resend-confirmation}` seguem esta forma; `/api/auth/refresh` e `/api/users/me` acrescentam a mecânica das TD-03/TD-04.

**Aplicação:**
- **Adota o padrão:** todos os Server-connected components de `## UI Inventory → ### Server-connected Components` — `SignupForm`, `Button "Create account"`, `SignupSuccessPanel`, `ResendConfirmationButton`, `Button — "Sign in"`, `Button (submit)`.
- **Excludes / boundaries:** nenhum. Os componentes `Local-interactive` do inventário (TextField, toggles, checkbox, links) não tocam a rede por construção.

**Migração:** `_No existing files require refactor — Setup SI is the only application of this pattern in the current phase._` O diretório `app/api/` ainda não tem nenhum handler.

**Verificação:**
- **Integration:** cada handler é importado e chamado como função (`import { POST } from "@/app/api/auth/login/route"`), com o `nestjs-api` fakeado por MSW e `server.listen({ onUnhandledRequest: "error" })`. Nenhum teste Vitest abre conexão real.
- **E2E:** o fluxo de submit completo, contra o stack real (TD-08).
- **Regression guards:** `npx tsc --noEmit` continua limpo — cada handler novo registra seu contrato em `contracts.ts` no mesmo commit.

#### auth-frontend/TD-02 — Cliente HTTP do BFF para o `nestjs-api`

**Pattern:** adotar `openapi-fetch` nos route handlers, com `createClient<paths>` num módulo de `lib/api/`. O diferimento registrado em `openapi-spec/TD-05` tinha um gatilho explícito e ele foi atingido; adotar agora fecha a cadeia contract-driven no único elo que ainda estava solto (o ponto de chamada) e dá um lugar único, e não repetido por handler, para a mecânica das TD-03 e TD-04.

**Setup:**

```ts
// next-frontend/lib/api/client.ts
import createClient from "openapi-fetch";
export const api = createClient<paths>({ baseUrl: config.api.baseUrl });
```

`baseUrl` vem de `config.api.baseUrl` (`@/lib/env`) — a mesma fonte que os handlers MSW leem, per `next-frontend-env-config/TD-01`. Nunca `process.env` direto, nunca hardcoded.

**Aplicação:**
- **Adota o padrão:** todo route handler sob `app/api/**`.
- **Excludes / boundaries:** código de browser — nunca importa este módulo. O cliente fala com o `nestjs-api`; o browser fala com rotas relativas (`next-frontend-env-config/TD-04`).

**Migração:** `_No existing files require refactor — Setup SI is the only application of this pattern in the current phase._` `openapi-fetch` ainda não está instalado.

**Verificação:**
- **Unit:** `npx tsc --noEmit` — o `createClient<paths>` é a garantia de build; um path ou método inexistente na spec não compila.
- **Integration:** os handlers exercitam o cliente contra o fake MSW tipado por `createOpenApiHttp<paths>()` (`next-frontend-msw-base/TD-03`).

#### auth-frontend/TD-03 — Propagação dos cookies de sessão até o browser

**Pattern:** o BFF reemite os cookies com atributos próprios, lendo nome, valor e `Max-Age` do `Set-Cookie` upstream e aplicando `path` das rotas do BFF, `sameSite` e `secure` condicionado ao ambiente. O descasamento de `path` é estrutural, não um bug: os caminhos da API são dela e nunca vão coincidir com os do BFF. Ler nome/TTL do `Set-Cookie` upstream mantém o backend como dono dos valores, preservando o princípio de não duplicar contrato.

**Setup:**

```ts
// next-frontend/lib/api/cookies.ts
// nome, valor e Max-Age vêm do Set-Cookie upstream; o resto é do BFF
cookieStore.set(name, value, {
  httpOnly: true,
  secure: true,          // também em desenvolvimento
  sameSite: "strict",    // auth/TD-15
  path: "/",
  maxAge,
});
```

`clearAuthCookies` e a leitura por nome derivam desta forma — não são materializados aqui.

**Aplicação:**
- **Adota o padrão:** `POST /api/auth/login` e `POST /api/auth/refresh` — os dois únicos handlers que recebem `Set-Cookie` upstream.
- **Excludes / boundaries:** `POST /api/auth/register` — o `201` **não** emite cookie de sessão (`auth/TD-09`: não há auto-login).

**Migração:** `_No existing files require refactor — Setup SI is the only application of this pattern in the current phase._`

**Verificação:**
- **Integration:** afirmar sobre o header `Set-Cookie` da `Response` devolvida pelo handler — `httpOnly`, `secure`, `sameSite=Strict`, `path`, e `Max-Age` igual ao do upstream fakeado.
- **E2E:** navegar autenticado após o login prova que o cookie reemitido é aceito pelo browser no `path` do BFF — que é exatamente o que a Option A não entregaria.

#### auth-frontend/TD-04 — Renovação do access token

**Pattern:** sob demanda no BFF, com retry único no 401 upstream e guarda de *single-flight* para evitar `TOKEN_REUTILIZADO` por corrida. Neste slice a única chamada autenticada é `/users/me`, então a janela de concorrência é estreita e o custo do *single-flight* é baixo; e o gatilho reativo (401 real) é o único que não presume conhecer a expiração.

**Setup:**

```ts
// next-frontend/lib/api/client.ts
let inflightRefresh: Promise<boolean> | null = null;
// no 401 upstream: renova uma única vez, deduplicado, e repete a chamada original
inflightRefresh ??= refreshSession().finally(() => { inflightRefresh = null; });
```

O primitivo `inflightRefresh` é o que impede duas renovações concorrentes de rotacionarem a mesma família e dispararem `TOKEN_REUTILIZADO`. **Retry único** — um segundo `401` após a renovação propaga.

**Aplicação:**
- **Adota o padrão:** `GET /api/users/me` — única chamada autenticada desta slice.
- **Excludes / boundaries:** os handlers anônimos (`register`, `login`, `forgot-password`, `resend-confirmation`) nunca disparam refresh; um `401` neles é `CREDENCIAIS_INVALIDAS`, não sessão expirada.

**Migração:** `_No existing files require refactor — Setup SI is the only application of this pattern in the current phase._`

**Verificação:**
- **Unit:** duas chamadas concorrentes com o upstream fakeado devolvendo `401` disparam **um** `POST /auth/refresh`, não dois.
- **Integration:** `401` → refresh `200` → repetição da chamada original devolve `200`; `401` → refresh `401` propaga o `401`.
- **Regression guards:** o `TOKEN_REUTILIZADO` não pode ser observado em nenhum cenário de concorrência do teste.

#### auth-frontend/TD-05 — Fronteira de guarda de sessão

**Pattern:** `proxy.ts` com verificação otimista por presença de cookie. A autorização real permanece no backend. É barata, é o padrão documentado e é a única que cobre prefetch; a autorização de verdade continua sendo do backend, que já responde 401 corretamente.

**Setup:**

```ts
// next-frontend/proxy.ts
// verificação otimista: presença do cookie, sem trabalho de rede
export const config = { matcher: [/* rotas protegidas — nenhuma nesta slice */] };
```

**Restrição de convenção do Next.js 16 (`auth-frontend/TD-03`, contexto):** `middleware.ts` está **deprecado** — o arquivo de convenção é `proxy.ts`, e o **build falha se os dois existirem**. Não criar `middleware.ts`.

**Aplicação:**
- **Adota o padrão:** nenhuma rota desta slice — as três telas são públicas (§Authorization Matrix). O arquivo é criado com o mecanismo no lugar e o `matcher` vazio ou restrito.
- **Excludes / boundaries:** `/signup`, `/login`, `/forgot-password` — públicas por natureza.

**Migração:** `_No existing files require refactor — Setup SI is the only application of this pattern in the current phase._`

**Verificação:**
- **E2E:** com o `matcher` ainda vazio, a prova nesta slice é negativa — nenhuma das três telas redireciona, com ou sem cookie. A verificação positiva chega na Fase 04, quando existir superfície protegida.

#### auth-frontend/TD-06 — Formulários: biblioteca e origem do schema

**Pattern:** React Hook Form + `@hookform/resolvers` + schema Zod **tipado contra `contracts.ts`** (`z.ZodType<...>`), não escrito solto. É a combinação que dá UX por campo sem abrir a segunda fonte de verdade: se o backend mudar a forma do payload, o `tsc --noEmit` acusa no schema em vez de o formulário passar a postar um corpo errado silenciosamente. O schema do cliente é afordância de UX; a autoridade sobre a regra permanece no backend, que revalida sempre.

**Setup:**

```ts
// next-frontend/lib/forms/login-schema.ts
const loginSchema: z.ZodType<LoginRequestBody> = z.object({ /* … */ });
useForm({ resolver: zodResolver(loginSchema) });
```

O `z.ZodType<LoginRequestBody>` é o elo que quebra o build quando o DTO do backend muda — sem ele, o schema é só um objeto Zod solto.

**Aplicação:**
- **Adota o padrão:** os três formulários — `SignupForm` (`/signup`), o de login (`/login`) e o de solicitação de reset (`/forgot-password`).
- **Excludes / boundaries:** `confirmPassword` do cadastro é **regra só do cliente** — não existe campo correspondente no DTO, então essa validação não deriva de `contracts.ts`.

**Migração:** `_No existing files require refactor — Setup SI is the only application of this pattern in the current phase._` Nenhuma das três bibliotecas está instalada.

**Verificação:**
- **Unit:** o schema rejeita os casos que os `Validation Rules` de §API Contracts descrevem (senha < 8, e-mail malformado, campo ausente).
- **Integration:** submit com corpo inválido não chega ao handler; submit válido chega com o corpo exato do DTO.
- **Regression guards:** `npx tsc --noEmit` falha se um campo sair do DTO do backend — é essa quebra que justifica a Option A sobre um schema solto.

#### auth-frontend/TD-08 — Provisionamento do stack E2E

**Pattern:** stack completo: Playwright contra `nestjs-api` + `db` + `mailpit` reais. Os fluxos de confirmação e de recuperação de senha só são verificáveis com e-mail real, e o Mailpit já está no ambiente exatamente para isso; a Option B pagaria o preço de um navegador para provar o que já está provado.

**Setup:**

```ts
// next-frontend/playwright.config.ts
// Playwright dirige o build de produção, nunca o dev server
webServer: { command: "npm run build && npm run start", url: "http://localhost:3001" },
use: { baseURL: "http://localhost:3001" },
```

**Aplicação:**
- **Adota o padrão:** as suítes `*.e2e-spec.ts` em `next-frontend/tests/` — a única lane que não vive colocada ao artefato.
- **Excludes / boundaries:** nada em `__tests__/` — essas rodam em Vitest contra MSW e nunca abrem conexão real.

**Migração:** `_No existing files require refactor — Setup SI is the only application of this pattern in the current phase._` `playwright.config.ts`, `tests/auth.setup.ts` e o script `test:e2e` **não existem** — a task `next-frontend-msw-base` entregou só a metade Vitest.

**Verificação:**
- **E2E:** cadastro → e-mail capturado no Mailpit → confirmação → login. É o fluxo que nenhuma outra lane cobre.
- **Regression guards:** `npm test` (Vitest, duas lanes) continua passando sem depender do stack de E2E.

#### auth-frontend/TD-10 — Ciclo de vida do banco entre execuções E2E

**Pattern:** dados únicos por execução, sem reset de estado. Os quatro fluxos deste slice são todos de **criação** (cadastrar, autenticar o usuário recém-criado, confirmar, redefinir senha): nenhum depende de estado que o próprio teste não possa produzir, então o determinismo que a Option B compra não é usado, e ela o cobra destruindo o banco de desenvolvimento.

**Setup:**

```ts
// next-frontend/tests/…  — e-mail único por execução, sem truncate entre runs
const email = `e2e-${Date.now()}-${randomUUID()}@example.test`;
```

**Aplicação:**
- **Adota o padrão:** toda suíte `*.e2e-spec.ts` que cria conta.
- **Excludes / boundaries:** nenhum teste desta slice pode assumir estado pré-existente no banco — é a condição que torna a Option A válida.

**Migração:** `_No existing files require refactor — Setup SI is the only application of this pattern in the current phase._`

**Verificação:**
- **E2E:** duas execuções consecutivas da mesma suíte passam sem qualquer limpeza entre elas.
- **Regression guards:** **gatilho de reavaliação registrado na TD** — quando houver pipeline de CI, ou quando surgir um teste que dependa de estado pré-existente, migrar para a Option C (database dedicado com perfil `e2e` no Compose).

### UI ↔ API Traceability Matrix

| Verb | Component | Screen | Endpoint (from API Contracts) | TD ref |
|------|-----------|--------|-------------------------------|--------|
| Submeter cadastro de nova conta com nome, e-mail e senha | SignupForm | /signup | POST /api/auth/register | auth-frontend/TD-01, auth-frontend/TD-06 |
| Exibir erros de cadastro retornados pelo servidor (ex.: e-mail já em uso) | SignupForm | /signup | POST /api/auth/register | auth-frontend/TD-11, http-error-contract/TD-03 |
| Exibir a confirmação do cadastro com o e-mail registrado, substituindo o formulário após o `201` | SignupSuccessPanel | /signup | POST /api/auth/register _(resposta `201`)_ | auth-frontend/TD-09 |
| Reenviar o e-mail de confirmação da conta recém-cadastrada | ResendConfirmationButton | /signup | POST /api/auth/resend-confirmation | auth-frontend/TD-09 |
| Autenticar usuário a partir de e-mail e senha e iniciar sessão | Button — "Sign in" | /login | POST /api/auth/login | auth-frontend/TD-01, auth-frontend/TD-03 |
| Solicitar o envio do e-mail de recuperação de senha para o endereço informado | Button (submit) | /forgot-password | POST /api/auth/forgot-password | auth-frontend/TD-01, auth-frontend/TD-06 |

_Capabilities marked in `## Non-UI / Deferred Capabilities` are excluded from this matrix._

**Endpoints do BFF sem verbo de UI nesta slice** — existem por decisão de runtime, não por demanda de tela, e por isso não constam acima:

| Endpoint | Por que existe | TD ref |
|----------|----------------|--------|
| POST /api/auth/refresh | Chamado pelo próprio BFF no `401` upstream, nunca pelo browser | auth-frontend/TD-04 |
| GET /api/users/me | Única chamada autenticada da slice; é o que a guarda consulta quando precisa da sessão real | auth-frontend/TD-04, auth-frontend/TD-05 |

**Duas superfícies diferidas**, registradas em `## Non-UI / Deferred Capabilities` do `context.md` e portanto ausentes da matriz: a **tela de confirmação de conta** (`auth-frontend/TD-07`, Adiada — o link do e-mail continua apontando direto para `GET /auth/confirm`, sem tela intermediária) e a **tela `/reset-password`** (lacuna de design: não existe em nenhum nó do arquivo Figma, embora `auth/TD-09` já aponte o link de reset para essa rota).

---

<!-- phase-a-complete -->

## Dependency Map

SI-02.1 (root — contrato de erro do backend + propagação dos tipos)
├── SI-02.2 — depends on SI-02.1 (o cliente é tipado por `paths`, que vem da spec regerada)
│   ├── SI-02.4 — depends on SI-02.2 + SI-02.3 (o middleware de renovação vive no cliente e reemite cookies)
│   │   ├── SI-02.13 — depends on SI-02.5 + SI-02.3 + SI-02.4 (handler de refresh)
│   │   └── SI-02.14 — depends on SI-02.5 + SI-02.4 (única chamada autenticada)
│   └── SI-02.5 — depends on SI-02.2 (Setup do padrão de handler + `POST /api/auth/register`)
│       ├── SI-02.10 — depends on SI-02.5 + SI-02.3 (login reemite cookies)
│       ├── SI-02.11 — depends on SI-02.5
│       └── SI-02.12 — depends on SI-02.5
└── SI-02.6 — depends on SI-02.1 (schemas Zod tipados contra o contrato regerado)

SI-02.3 (root — reemissão de cookies)
└── SI-02.7 — depends on SI-02.3 (a guarda lê o cookie por nome)

SI-02.8 (root — stack Playwright)
└── SI-02.9 — depends on SI-02.8

SI-02.0.1 (root, bootstrap — primitives shadcn)
SI-02.0.2 (root, bootstrap — `icon-button.tsx`)
SI-02.0.3 (root, bootstrap — `progress-linear.tsx`)
SI-02.0.4 (root, bootstrap — ícones)
├── SI-02.15.0 — depends on SI-02.0.1, SI-02.0.2, SI-02.0.3, SI-02.0.4 (auditoria de drift de /signup)
│   └── SI-02.15a — depends on SI-02.15.0 + os quatro bootstrap
│       └── SI-02.15b — depends on SI-02.15a + SI-02.5 + SI-02.12 + SI-02.6
├── SI-02.16.0 — depends on SI-02.0.1 (auditoria de drift de /login)
│   └── SI-02.16a — depends on SI-02.16.0 + SI-02.0.1
│       └── SI-02.16b — depends on SI-02.16a + SI-02.10 + SI-02.12 + SI-02.6
└── SI-02.17.0 — depends on SI-02.0.1, SI-02.0.4 (auditoria de drift de /forgot-password)
    └── SI-02.17a — depends on SI-02.17.0 + SI-02.0.1, SI-02.0.4
        └── SI-02.17b — depends on SI-02.17a + SI-02.11 + SI-02.6

**Ordem obrigatória registrada em `validation.md` (DG-2), reproduzida aqui porque `/plan-build` não lê aquele arquivo:** filtro de exceção → `error` como enum em `ErrorResponseDto` → regerar `openapi.json` → `scripts/generate-api-types.sh` → só então os SIs de tela. As quatro primeiras etapas são as ações 1–4 de **SI-02.1**, e é por isso que ele é raiz absoluta de toda a cadeia de frontend: SI-02.2 e SI-02.6 dependem dele, e todo SI de tela desce de um dos dois.

**Cross-slice:** a dependência desta slice sobre a slice irmã `auth` é declarada em `depends_on_slices` no frontmatter da doc de decisões, não por aresta de SI — a API de auth já está entregue e não é reaberta aqui.

**Auditorias de drift em série:** SI-02.15.0 → SI-02.16.0 → SI-02.17.0 não têm dependência técnica entre si, mas a detecção de `CONFLICT` só funciona se rodarem nessa ordem — cada auditoria lê as seções anteriores de `frontend-drift-report.md` para montar `prior_decisions`. Cinco dos seis componentes de `/login` já foram auditados em `/signup`.

---

## Deliverables

- [ ] SI-02.0.1 — Infra: instalar os primitives shadcn em lote
- [ ] SI-02.0.2 — Custom-ui: `icon-button.tsx`
- [ ] SI-02.0.3 — Custom-ui: `progress-linear.tsx`
- [ ] SI-02.0.4 — Ícones: `arrow-back.tsx` + `eye.tsx`
- [ ] SI-02.1 — Normalizar o envelope de erro do `nestjs-project` e propagar o contrato
- [ ] SI-02.2 — Cliente HTTP do BFF para o `nestjs-api` (Setup)
- [ ] SI-02.3 — Propagação dos cookies de sessão até o browser (Setup)
- [ ] SI-02.4 — Renovação do access token (Setup)
- [ ] SI-02.5 — Fundação dos route handlers do BFF (Setup)
- [ ] SI-02.6 — Formulários: React Hook Form + schema Zod tipado contra o contrato (Setup)
- [ ] SI-02.7 — Fronteira de guarda de sessão (Setup)
- [ ] SI-02.8 — Provisionamento do stack E2E (Setup)
- [ ] SI-02.9 — Ciclo de vida do banco entre execuções E2E (Setup)
- [ ] SI-02.10 — Handler `POST /api/auth/login`
- [ ] SI-02.11 — Handler `POST /api/auth/forgot-password`
- [ ] SI-02.12 — Handler `POST /api/auth/resend-confirmation`
- [ ] SI-02.13 — Handler `POST /api/auth/refresh`
- [ ] SI-02.14 — Handler `GET /api/users/me`
- [ ] SI-02.15.0 — Drift audit: Tela de cadastro de conta
- [ ] SI-02.15a — Tela de cadastro de conta (visual shell)
- [ ] SI-02.15b — Tela de cadastro de conta (lógica & wiring)
- [ ] SI-02.16.0 — Drift audit: Tela de login
- [ ] SI-02.16a — Tela de login (visual shell)
- [ ] SI-02.16b — Tela de login (lógica & wiring)
- [ ] SI-02.17.0 — Drift audit: Tela de solicitação de redefinição de senha
- [ ] SI-02.17a — Tela de solicitação de redefinição de senha (visual shell)
- [ ] SI-02.17b — Tela de solicitação de redefinição de senha (lógica & wiring)

**Per-screen deliverables:**

- [ ] Tela de cadastro de conta (`/signup`) é roteável
- [ ] Tela de cadastro de conta (`/signup`) renderiza os estados de carregamento, sucesso e erro
- [ ] Tela de cadastro de conta (`/signup`) passa nos testes de componente (lane `dom`)
- [ ] Tela de login (`/login`) é roteável
- [ ] Tela de login (`/login`) renderiza os estados de carregamento, sucesso e erro
- [ ] Tela de login (`/login`) passa nos testes de componente (lane `dom`)
- [ ] Tela de solicitação de redefinição de senha (`/forgot-password`) é roteável
- [ ] Tela de solicitação de redefinição de senha (`/forgot-password`) renderiza os estados de carregamento, sucesso e erro
- [ ] Tela de solicitação de redefinição de senha (`/forgot-password`) passa nos testes de componente (lane `dom`)

**Full test suites:**

- [ ] Testes do backend passam (`cd nestjs-project && npm test`)
- [ ] E2E do backend passam (`cd nestjs-project && npm run test:e2e`)
- [ ] Verificação de tipos do backend passa (`cd nestjs-project && npm run build`)
- [ ] Testes do frontend passam nas duas lanes (`cd next-frontend && npm test`)
- [ ] E2E do frontend passam (`cd next-frontend && npm run test:e2e`) — o script é criado em SI-02.8
- [ ] Verificação de tipos do frontend passa (`cd next-frontend && npx tsc --noEmit`)
- [ ] Build do frontend conclui (`cd next-frontend && npm run build`) — prova também que `proxy.ts` e `middleware.ts` não coexistem
- [ ] Tipos gerados não estão defasados em relação à spec (`./scripts/check-api-types-drift.sh`)
- [ ] Tokens de tema íntegros (`cd next-frontend && npm run check:tokens`)
