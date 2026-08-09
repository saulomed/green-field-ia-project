---
kind: task
name: task-openapi-spec
test_specs_aware: true
sources_mtime:
  docs/tasks/task-openapi-spec/context.md: "2026-08-08T21:34:22Z"
  docs/tasks/task-openapi-spec/library-refs.md: "2026-08-08T21:34:31Z"
  docs/decisions/technical-decisions-openapi-spec.md: "2026-08-08T21:32:44Z"
  docs/decisions/technical-decisions-auth.md: "2026-08-08T20:43:00Z"
  docs/phases/phase-02-auth/context.md: "2026-08-08T20:56:25Z"
  .claude/skills/testing-guide-nestjs-project/SKILL.md: "2026-08-08T20:01:09Z"
---

# Task openapi-spec — Documentação OpenAPI da API

## Objective

Documentação OpenAPI da API NestJS: geração da spec, metadados dos DTOs, exposição do Swagger UI, emissão do artefato openapi.json e consumo pelo frontend

---

## Step Implementations

### SI-1 — Infra: instalar `@nestjs/swagger` e habilitar o CLI plugin

**Description:** Adiciona a dependência que gera a spec e liga o CLI plugin, que é a fonte dos metadados dos DTOs — sem ele, todo o restante da task exigiria `@ApiProperty` manual.

**Technical actions:**

1. Instalar `@nestjs/swagger@^11.4.6` em `nestjs-project/` (peer `@nestjs/common ^11.0.1`, compatível com o instalado) — seguir o procedimento de instalação em container do `nestjs-project/CLAUDE.md` (install como root + `chown -R node:node node_modules`, com autorização prévia do usuário).
2. Configurar `compilerOptions.plugins` em `nestjs-project/nest-cli.json` com `name: "@nestjs/swagger"` e `options`: `dtoFileNameSuffix: [".dto.ts"]`, `introspectComments: true`, `classValidatorShim: true`, `dtoKeyOfComment: "description"`, `controllerKeyOfComment: "description"`, `introspectDefaultValues: true` (per `openapi-spec/TD-02`).
3. Registrar em `nestjs-project/CLAUDE.md` o critério de override: `@ApiProperty()` só para exemplos e para casos em que a inferência do plugin é ambígua — nunca para redeclarar o que `class-validator` já expressa.

**Tests:** _(empty — Infra)_

**Dependencies:** none

**Acceptance criteria:**

- `npm run build` conclui sem erro com o plugin ativo em `nest-cli.json`.
- `@nestjs/swagger` aparece em `dependencies` do `package.json` com a versão instalada registrada no lockfile.
- `nestjs-project/CLAUDE.md` documenta quando usar `@ApiProperty()`.

---

### SI-2 — Namespace de configuração `swagger` com validação Joi

**Description:** Cria o namespace tipado que governa se a UI existe e em que path — a política por ambiente do `openapi-spec/TD-03` precisa ser configuração validada no boot, não `process.env` espalhado.

**Technical actions:**

1. Criar `nestjs-project/src/config/swagger.config.ts` — `registerAs('swagger', () => ({ enabled, path }))`, resolvendo `process.env.SWAGGER_ENABLED` e `process.env.SWAGGER_PATH` inteiramente dentro da factory (convenção herdada `config/TD-01`).
2. Adicionar `SWAGGER_ENABLED` (`Joi.boolean()`, default por `NODE_ENV`) e `SWAGGER_PATH` (`Joi.string()`, default `api/docs`) ao `envValidationSchema` em `src/config/env.validation.ts` (per `openapi-spec/TD-03`).
3. Registrar `swaggerConfig` no array `load` do `ConfigModule.forRoot` do `AppModule`.
4. Declarar as duas variáveis no `compose.yaml` / `.env` de desenvolvimento com `SWAGGER_ENABLED=true`.

**Tests:**

| Artifact | Layer | Test file |
|----------|-------|-----------|
| `swaggerConfig` | Unit: mapeamento de env → namespace, defaults e coerção de booleano | `src/config/swagger.config.spec.ts` |
| `envValidationSchema` | Unit: `SWAGGER_PATH` default `api/docs`; `SWAGGER_ENABLED` inválido derruba a validação | `src/config/env.validation.spec.ts` |

**Dependencies:** none

**Acceptance criteria:**

- Com `SWAGGER_ENABLED` ausente, a aplicação sobe e o namespace `swagger` resolve `enabled` conforme o `NODE_ENV` corrente.
- Com `SWAGGER_ENABLED=nao-booleano`, a aplicação não sobe e a mensagem de erro do Joi nomeia a variável.
- Com `SWAGGER_PATH` ausente, o namespace resolve `path` como `api/docs`.

---

### SI-3 — Documento OpenAPI e exposição condicional do Swagger UI

**Route:** GET /{swagger.path}
**Test Specs:** see `nestjs-project/specs/swagger-ui.plan.md`
**Authorization:** Anonymous (rota inexistente quando `swagger.enabled` é `false`)

**Description:** Monta o documento OpenAPI a partir do código já existente (`openapi-spec/TD-01`, code-first) e o expõe pela UI apenas nos ambientes permitidos, com o esquema de segurança que descreve o cookie de sessão.

**Technical actions:**

1. Criar `nestjs-project/src/openapi/openapi.document.ts` — função pura `buildOpenApiDocument(app)` com `DocumentBuilder`: `setTitle`, `setDescription`, `setVersion`, `setOpenAPIVersion('3.0.0')`, `addTag('auth', …)`, `addTag('users', …)` e `addCookieAuth('access_token', { type: 'apiKey' }, 'jwt-cookie')` (per `openapi-spec/TD-06`), seguida de `SwaggerModule.createDocument`. A função é pura e reutilizável — o SI-6 a consome sem subir servidor HTTP.
2. Criar `nestjs-project/src/openapi/swagger.setup.ts` — `setupSwagger(app)` que lê o namespace `swagger` (`ConfigType<typeof swaggerConfig>`), retorna sem efeito quando `enabled` é `false` e, caso contrário, chama `SwaggerModule.setup(path, app, document, { swaggerOptions: { withCredentials: true } })`.
3. Invocar `setupSwagger(app)` em `src/main.ts`, depois de `cookieParser` e dos pipes/filters globais, antes de `app.listen(port)`.

**Tests:**

| Artifact | Layer | Test file |
|----------|-------|-----------|
| `buildOpenApiDocument` | Integration: documento gerado a partir do `AppModule` declara `openapi: "3.0.0"`, o securityScheme `jwt-cookie` como `apiKey` em cookie `access_token` e as tags `auth`/`users` | `src/openapi/openapi.document.integration.spec.ts` |
| `setupSwagger` | Unit: com `enabled: false` não registra rota; com `enabled: true` chama `SwaggerModule.setup` com o `path` do namespace | `src/openapi/swagger.setup.spec.ts` |

_As asserções de rota HTTP (`200` com a UI quando habilitado, `404` quando desabilitado) ficam de fora desta tabela — são cenários E2E autorados por `/plan-test-specs`._

**Dependencies:** SI-1 (a lib e o plugin precisam existir) + SI-2 (o namespace `swagger` precisa existir)

**Acceptance criteria:**

- Com `SWAGGER_ENABLED=true`, `GET /{swagger.path}` retorna `200` com a UI do Swagger e `GET /{swagger.path}-json` retorna `200` com um documento OpenAPI 3.0.
- Com `SWAGGER_ENABLED=false`, `GET /{swagger.path}` retorna `404` e nenhum documento é montado no boot.
- O documento servido declara o securityScheme `jwt-cookie` do tipo `apiKey` sobre o cookie `access_token`.
- Executar `POST /auth/login` pelo "Try it out" da UI faz as chamadas seguintes a `GET /users/me` retornarem `200` sem nenhuma configuração manual de credencial.

---

### SI-4 — Decoradores compostos de resposta de erro

**Description:** Materializa o `openapi-spec/TD-07`: o envelope de erro herdado (`{ statusCode, error, message }`) vira um schema nomeado e três decoradores compostos, evitando `@ApiResponse` cru repetido em cada handler.

**Technical actions:**

1. Criar `nestjs-project/src/common/dto/error-response.dto.ts` — `ErrorResponseDto` com `statusCode`, `error` e `message`, espelhando byte a byte o que `HttpExceptionFilter` emite.
2. Criar `nestjs-project/src/common/decorators/api-validation-error.decorator.ts` — `applyDecorators(ApiBadRequestResponse({ type: ErrorResponseDto, … }))` para o `400` do `ValidationPipe` global.
3. Criar `nestjs-project/src/common/decorators/api-domain-error.decorator.ts` — decorador parametrizado por `(status, error, description)` que declara uma resposta de erro de domínio da tabela de `### Error Catalog` usando `ErrorResponseDto`.
4. Criar `nestjs-project/src/common/decorators/api-rate-limited.decorator.ts` — declara o `429` `LIMITE_EXCEDIDO` das rotas com `@Throttle`.

**Tests:**

| Artifact | Layer | Test file |
|----------|-------|-----------|
| decoradores compostos | Unit: aplicados a um controller de fixture, os metadados de resposta resultantes trazem o status, a `description` e `type: ErrorResponseDto` esperados | `src/common/decorators/api-error.decorators.spec.ts` |

**Dependencies:** SI-1

**Acceptance criteria:**

- O documento OpenAPI declara `ErrorResponseDto` uma única vez em `components.schemas`, referenciado por todas as respostas de erro.
- O schema de erro declara exatamente os campos `statusCode`, `error` e `message` — nem mais, nem menos.
- Cada decorador aplicado produz a resposta do status correspondente com `description` legível em português.

---

### SI-5 — Anotar os controllers existentes com o contrato documentado

**Description:** Aplica tags, descrições, esquema de segurança e respostas de erro endpoint a endpoint, conforme a matriz de `### API Contracts` — é aqui que a spec deixa de ser um esqueleto e passa a descrever a API de verdade.

**Technical actions:**

1. Anotar `src/auth/auth.controller.ts` — `@ApiTags('auth')` na classe; por endpoint, `@ApiOperation` com `summary` e, em `login`/`refresh`/`logout`, `description` explicitando os efeitos de `Set-Cookie` sobre `access_token` e `refresh_token`; respostas de sucesso com o DTO da matriz; erros conforme a coluna "Erros a declarar" usando os decoradores do SI-4.
2. Aplicar `@ApiCookieAuth('jwt-cookie')` em `refresh`, `logout` (`auth.controller.ts`) e `getProfile` (`users.controller.ts`), casando com o `securityName` do `addCookieAuth` (per `openapi-spec/TD-06`).
3. Anotar `src/users/users.controller.ts` — `@ApiTags('users')` e as respostas `200 UserProfileResponseDto`, `401 SESSAO_INVALIDA`, `404 USUARIO_NAO_ENCONTRADO`.
4. Anotar `src/app.controller.ts` — `@ApiTags('app')` e a resposta `200` de tipo `string`.
5. Adicionar JSDoc de `description` aos DTOs cujo propósito não é auto-evidente pelo nome, aproveitando o `introspectComments: true` do plugin em vez de `@ApiProperty` (per `openapi-spec/TD-02`).

**Tests:**

| Artifact | Layer | Test file |
|----------|-------|-----------|
| documento gerado | Integration: todo path da matriz de `### API Contracts` existe no documento, com a tag, o `security` e os status codes declarados na matriz | `src/openapi/openapi.contract.integration.spec.ts` |
| schemas dos DTOs | Integration: `email` com `format: email` e `maxLength: 254`; `password` com `minLength: 8` e `maxLength: 128`; `token` obrigatório — derivados do `classValidatorShim`, sem `@ApiProperty` | `src/openapi/openapi.contract.integration.spec.ts` |

**Dependencies:** SI-3 (o documento precisa ser montável) + SI-4 (os decoradores de erro precisam existir)

**Acceptance criteria:**

- Todos os 10 endpoints da matriz de `### API Contracts` aparecem no documento sob a tag declarada.
- Os três endpoints protegidos (`POST /auth/refresh`, `POST /auth/logout`, `GET /users/me`) declaram `security: jwt-cookie`; os demais não declaram security.
- Cada endpoint declara exatamente os status de erro da coluna "Erros a declarar", nenhum a mais.
- As restrições de `email`, `password` e `token` aparecem no schema sem que nenhum `@ApiProperty` de tipo tenha sido escrito.
- A suíte E2E da fase 02 continua passando sem alteração — nenhum status code, body ou cookie muda.

---

### SI-6 — Script `openapi:generate` e artefato `openapi.json` versionado

**Description:** Emite o contrato como arquivo versionado (`openapi-spec/TD-04`), que é o que torna uma quebra de compatibilidade visível no code review e o insumo do codegen de frontend do `openapi-spec/TD-05`.

**Technical actions:**

1. Criar `nestjs-project/src/openapi/generate-openapi.ts` — cria o contexto da aplicação, chama `buildOpenApiDocument` (SI-3), serializa com `JSON.stringify(document, null, 2)`, escreve em `nestjs-project/openapi.json` e encerra a aplicação. **Sem `app.listen()`.**
2. Adicionar o script `"openapi:generate"` ao `package.json`, executável via `ts-node` no mesmo padrão do script `seed` já existente.
3. Gerar e versionar `nestjs-project/openapi.json` — o arquivo mora no subprojeto, não em `docs/`, que é reservado a documentação autoral.
4. Documentar em `nestjs-project/CLAUDE.md` que a geração é **sob demanda**, dentro da rede do Compose (`docker compose run --rm nestjs-api npm run openapi:generate`), e nunca um hook de `postbuild` — o bootstrap do `AppModule` exige Postgres, Mailpit e todas as variáveis obrigatórias no ar.

**Tests:**

| Artifact | Layer | Test file |
|----------|-------|-----------|
| `generate-openapi` | Integration: a execução escreve um JSON parseável cujo conjunto de paths é igual ao do documento montado em memória | `src/openapi/generate-openapi.integration.spec.ts` |

**Dependencies:** SI-5 (o documento só está completo depois das anotações)

**Acceptance criteria:**

- `npm run openapi:generate` termina com código 0 e escreve `nestjs-project/openapi.json` sem abrir porta HTTP.
- O arquivo gerado é um documento OpenAPI 3.0 válido e contém todos os paths da matriz de `### API Contracts`.
- Reexecutar o script sem mudanças no código produz um arquivo byte-idêntico (`git diff --exit-code openapi.json` limpo).
- `nestjs-project/CLAUDE.md` descreve o comando de geração sob demanda dentro do container.

---

## Technical Specifications

### API Contracts

Esta task **não cria nem altera endpoints de domínio** — ela documenta o contrato já exposto pela API (`openapi-spec/TD-01`, code-first). As duas subseções abaixo separam o que é superfície HTTP nova (a UI de documentação) do que é contrato existente a ser anotado.

#### GET /{swagger.path} — Swagger UI

Rota servida por `SwaggerModule.setup(path, app, document)` (`openapi-spec/TD-03`). Registrada **apenas quando `swagger.enabled` é verdadeiro**; em `NODE_ENV=production` a flag é `false` por padrão e a rota não existe (404 pelo roteador do Nest, sem guard e sem 403).

**Configuração** (namespace tipado `swagger`, seguindo a convenção herdada `registerAs` + `ConfigType`):

| Env var | Joi | Default | Efeito |
|---|---|---|---|
| `SWAGGER_ENABLED` | `Joi.boolean()` | `true` em `development`/`test`, `false` em `production` | Liga/desliga o registro da rota e a geração do documento no boot |
| `SWAGGER_PATH` | `Joi.string()` | `api/docs` | Path do Swagger UI |

**Responses:**
- `200 OK` — HTML da UI do Swagger (`text/html`), com "Try it out" habilitado e `withCredentials: true` via `swaggerOptions` (`openapi-spec/TD-06`)
- `404 Not Found` — quando `swagger.enabled` é `false` (rota não registrada)

#### GET /{swagger.path}-json — documento OpenAPI servido

Rota irmã registrada automaticamente por `SwaggerModule.setup`. Mesma condição de existência da UI.

**Responses:**
- `200 OK` — documento OpenAPI 3.0 serializado (`application/json`)
- `404 Not Found` — quando `swagger.enabled` é `false`

_O artefato versionado `nestjs-project/openapi.json` (`openapi-spec/TD-04`) **não** é servido por esta rota: ele é gerado sob demanda pelo script `openapi:generate`, sem `listen()`. Ver `### Frontend Runtime` para o consumo._

#### Contrato existente a documentar

Matriz autoritativa do que cada endpoint deve declarar na spec. Nomes de campo, códigos de erro e status são copiados verbatim do código já implementado — **nenhum deles muda nesta task**.

| Endpoint | Tag | Security | Sucesso | Response DTO | Erros a declarar |
|---|---|---|---|---|---|
| `POST /auth/register` | `auth` | — | `201 Created` | `RegisterResponseDto` | `400`, `409 EMAIL_JA_EXISTE` |
| `POST /auth/login` | `auth` | — | `200 OK` | `LoginResponseDto` | `400`, `401 CREDENCIAIS_INVALIDAS`, `403 EMAIL_NAO_CONFIRMADO`, `429 LIMITE_EXCEDIDO` |
| `POST /auth/refresh` | `auth` | `jwt-cookie` (refresh) | `200 OK` | `RefreshResponseDto` | `401 SESSAO_INVALIDA`, `401 TOKEN_REUTILIZADO` |
| `POST /auth/logout` | `auth` | `jwt-cookie` | `204 No Content` | — | `401 SESSAO_INVALIDA` |
| `GET /auth/confirm` | `auth` | — | `204 No Content` | — | `400 TOKEN_INVALIDO`, `409 EMAIL_JA_CONFIRMADO` |
| `POST /auth/resend-confirmation` | `auth` | — | `204 No Content` | — | `400`, `429 LIMITE_EXCEDIDO` |
| `POST /auth/forgot-password` | `auth` | — | `204 No Content` | — | `400`, `429 LIMITE_EXCEDIDO` |
| `POST /auth/reset-password` | `auth` | — | `204 No Content` | — | `400`, `400 TOKEN_INVALIDO` |
| `GET /users/me` | `users` | `jwt-cookie` | `200 OK` | `UserProfileResponseDto` | `401 SESSAO_INVALIDA`, `404 USUARIO_NAO_ENCONTRADO` |
| `GET /` | `app` | — | `200 OK` | `string` | — |

**Efeitos colaterais de cookie a documentar em prosa** (`@ApiOperation.description`), já que não aparecem no body: `POST /auth/login` e `POST /auth/refresh` emitem `Set-Cookie` para `access_token` e `refresh_token` (este último com `path=/auth`); `POST /auth/logout` os limpa.

**`RegisterDto`/`LoginDto`, `ConfirmDto`, `ResendConfirmationDto`, `ForgotPasswordDto`, `ResetPasswordDto`** entram na spec como schemas nomeados; `ConfirmDto` é bindado como **query parameter** (`@Query()`), não como body.

#### Validation Rules

As restrições vêm dos decorators de `class-validator` já presentes nos DTOs, traduzidas automaticamente pelo CLI plugin com `classValidatorShim: true` (`openapi-spec/TD-02`) — **não devem ser reescritas à mão** com `@ApiProperty`. Cobertura esperada na spec gerada:

- `email` (`@IsEmail` + `@MaxLength(254)`) → `type: string`, `format: email`, `maxLength: 254`
- `password` (`@IsString` + `@Length(8, 128)`) → `type: string`, `minLength: 8`, `maxLength: 128`
- `token` (`@IsString` + `@IsNotEmpty`) → `type: string`, `minLength: 1`
- Campos sem `@IsOptional` → entram em `required`

`@ApiProperty()` fica reservado a **exemplos** e a casos em que a inferência do plugin é ambígua (tipos que o TypeScript apaga em runtime); o critério de override é registrado em `nestjs-project/CLAUDE.md`.

### Authorization Matrix

O esquema de segurança declarado na spec é `addCookieAuth('access_token', { type: 'apiKey' }, 'jwt-cookie')` — descreve fielmente o contrato de `auth/TD-03` (cookie `httpOnly`), sem alterar a implementação de autenticação (`openapi-spec/TD-06`). Endpoints protegidos recebem `@ApiCookieAuth('jwt-cookie')`, cujo `name` deve casar com o `securityName` do `addCookieAuth`.

| Endpoint | Anonymous | Authenticated | Decorator na spec |
|---|---|---|---|
| `POST /auth/register` | ✓ | ✓ | — |
| `POST /auth/login` | ✓ | ✓ | — |
| `POST /auth/refresh` | ✗ | ✓ | `@ApiCookieAuth('jwt-cookie')` |
| `POST /auth/logout` | ✗ | ✓ | `@ApiCookieAuth('jwt-cookie')` |
| `GET /auth/confirm` | ✓ | ✓ | — |
| `POST /auth/resend-confirmation` | ✓ | ✓ | — |
| `POST /auth/forgot-password` | ✓ | ✓ | — |
| `POST /auth/reset-password` | ✓ | ✓ | — |
| `GET /users/me` | ✗ | ✓ | `@ApiCookieAuth('jwt-cookie')` |
| `GET /` | ✓ | ✓ | — |
| `GET /{swagger.path}` | ✓ (só quando `swagger.enabled`) | ✓ (idem) | — |

**Limitação aceita do "Try it out"** (`openapi-spec/TD-06`): o cookie é `httpOnly`, então o botão *Authorize* do Swagger UI não consegue injetá-lo. O fluxo funcional é executar `POST /auth/login` pela própria UI com `withCredentials: true` — o navegador guarda o cookie e as chamadas seguintes já vão autenticadas. Nenhum segundo esquema de autenticação (bearer header) é introduzido para contornar isso.

**Exposição da UI** (`openapi-spec/TD-03`): o acesso ao Swagger UI é governado por ambiente, não por role — `swagger.enabled` `false` em produção remove a rota. Não há guard sobre `/{swagger.path}`; se um integrador externo exigir a UI em produção no futuro, a rota passa a existir com a flag ligada e um guard é adicionado então, sem desfazer nada.

### Error Catalog

Formato de resposta de erro **herdado** da fase 02 (`HttpExceptionFilter` global): `{ statusCode, error, message }`. Esta task não muda o formato — declara-o na spec.

`openapi-spec/TD-07` fixa três decoradores compostos (`applyDecorators` sobre os atalhos `@ApiUnauthorizedResponse`, `@ApiBadRequestResponse`, etc.) em `nestjs-project/src/common/decorators/`, aplicados por endpoint conforme a coluna "Erros a declarar" da matriz em `### API Contracts`. Repetir `@ApiResponse` cru em cada handler (Option A) fica descartado.

| error | HTTP | Trigger |
|---|---|---|
| `Bad Request` | 400 | Falha de `class-validator` no `ValidationPipe` global (`message` concatena as constraints com `; `) |
| `TOKEN_INVALIDO` | 400 | Token de confirmação ou de reset inválido/expirado |
| `CREDENCIAIS_INVALIDAS` | 401 | Login com e-mail inexistente ou senha incorreta |
| `SESSAO_INVALIDA` | 401 | Access/refresh token ausente, inválido ou expirado |
| `TOKEN_REUTILIZADO` | 401 | Refresh token já rotacionado apresentado novamente |
| `EMAIL_NAO_CONFIRMADO` | 403 | Login antes da confirmação de conta |
| `USUARIO_NAO_ENCONTRADO` | 404 | Usuário do payload do token não existe mais |
| `EMAIL_JA_EXISTE` | 409 | Cadastro com e-mail já em uso |
| `EMAIL_JA_CONFIRMADO` | 409 | Reapresentação de um token de confirmação já usado |
| `LIMITE_EXCEDIDO` | 429 | Estouro do rate limit da rota (`@nestjs/throttler`) |
| `INTERNAL_SERVER_ERROR` | 500 | Qualquer exceção não tratada |

O schema do envelope é declarado **uma vez** como DTO de erro reutilizável e referenciado por `type` nos três decoradores compostos — não redeclarado por endpoint.

### Frontend Runtime

#### openapi-spec/TD-05 — Consumo da spec pelo frontend: codegen de tipos e client

**Pattern:** dá a garantia essencial (mudança incompatível de contrato falha no `tsc` do frontend) com a menor superfície de dependência e sem antecipar a decisão de data fetching do frontend, que deve ser tomada quando as telas entrarem em escopo; a Option C carrega essa decisão junto e a Option B cobra custo de código gerado e instabilidade de `0.x` por uma DX marginalmente melhor. A adoção pode ficar **diferida** até as telas existirem — o que este TD fixa agora é a estratégia, para que a TD-04 gere o artefato no formato certo.

**Setup:** a adoção está **diferida** (ver `## Non-UI / Deferred Capabilities` em `context.md`) — nenhuma dependência é instalada no `next-frontend/` nesta task. O que esta task garante é o insumo: `nestjs-project/openapi.json` versionado, em OpenAPI 3.0, gerado por `npm run openapi:generate`. A forma canônica do consumo futuro, para referência da fase que trouxer as telas:

```typescript
// next-frontend/<api-client-entry>
npx openapi-typescript ../nestjs-project/openapi.json -o ./src/lib/api/schema.d.ts

const client = createClient<paths>({ baseUrl, credentials: 'include' });
```

`credentials: 'include'` é o que conecta o client ao esquema `addCookieAuth` fixado em `openapi-spec/TD-06`; `paths` é o tipo exportado pelo `openapi-typescript` e consumido pelo `openapi-fetch`.

**Aplicação:** não há superfície de UI nesta task (`ui_in_scope: logic-only`). A estratégia se aplica a **todo consumo futuro da API pelo `next-frontend/`** — nenhum componente pode chamar a API com `fetch` destipado uma vez que o codegen esteja em vigor. A fase que introduzir as telas herda esta restrição via `## Inherited Decisions Detail` e a materializa no seu próprio `### UI Contracts`.

**Migração:** _No existing files require refactor — a adoção está diferida e o `next-frontend/` ainda não consome a API._

**Verificação:** nesta task a verificação recai sobre o **insumo**, não sobre o consumo.

- **Unit:** não aplicável (nenhum código de frontend é escrito).
- **Integration:** `npm run openapi:generate` produz um `openapi.json` parseável, com `openapi: "3.0.0"`, e com todos os paths da matriz de `### API Contracts` presentes.
- **E2E:** com `swagger.enabled=true`, `GET /{swagger.path}-json` responde `200` e o documento servido é equivalente ao arquivo versionado.
- **Regression guards:** a suíte E2E existente da fase 02 deve continuar passando sem alteração — a introdução do `SwaggerModule` e dos decoradores de resposta não pode mudar status codes, bodies nem cookies de nenhum endpoint.

---

## Dependency Map

```
SI-1 (root — lib + CLI plugin)
├── SI-4 — depends on SI-1 (os decoradores precisam dos atalhos @Api*Response)
│   └── SI-5 — depends on SI-3 + SI-4 (anotar exige documento montável e decoradores prontos)
│       └── SI-6 — depends on SI-5 (o artefato só vale depois do contrato completo)
└── SI-3 — depends on SI-1 + SI-2 (lib + namespace de configuração)
SI-2 (root — namespace swagger + Joi)
└── SI-3 (ver acima)
```

---

## Deliverables

- [ ] SI-1 — Infra: instalar `@nestjs/swagger` e habilitar o CLI plugin
- [ ] SI-2 — Namespace de configuração `swagger` com validação Joi
- [ ] SI-3 — Documento OpenAPI e exposição condicional do Swagger UI
- [ ] SI-4 — Decoradores compostos de resposta de erro
- [ ] SI-5 — Anotar os controllers existentes com o contrato documentado
- [ ] SI-6 — Script `openapi:generate` e artefato `openapi.json` versionado

**Artefatos:**

- [ ] `nestjs-project/openapi.json` versionado e sincronizado com o código
- [ ] Swagger UI acessível em desenvolvimento e ausente em produção

**Full test suites:**

- [ ] Backend tests pass (`docker compose exec nestjs-api npm test`)
- [ ] E2E tests pass (`docker compose exec nestjs-api npm run test:e2e`)
- [ ] Type/compilation checks pass (`docker compose exec nestjs-api npm run build`)
- [ ] Lint passes (`docker compose exec nestjs-api npm run lint`)
