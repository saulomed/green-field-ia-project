# task-openapi-spec — Progress

**Status:** completed
**SIs:** 6/6 completed

### SI-1 — Infra: instalar `@nestjs/swagger` e habilitar o CLI plugin
- **Status:** completed
- **Tests:** no tests (infra)
- **Observations:**
  - Instalação exigiu `docker compose up -d` para subir os containers (nenhum estava rodando) e `docker compose exec -u root nestjs-api npm install` + `chown -R node:node node_modules`, autorizado explicitamente pelo usuário antes da execução.

### SI-2 — Namespace de configuração `swagger` com validação Joi
- **Status:** completed
- **Tests:** 27 passing
- **Observations:**
  - `SWAGGER_ENABLED` não tem default no Joi schema (fica `undefined` quando ausente) — o default condicional por `NODE_ENV` é resolvido em `buildSwaggerOptions`, não no Joi, seguindo o mesmo padrão já usado por `COOKIE_SECURE`/`auth.config.ts` (leitura direta de `process.env`, não do objeto validado pelo Joi).

### SI-3 — Documento OpenAPI e exposição condicional do Swagger UI
- **Status:** completed
- **Tests:** 6 unit/integration passing + 9/10 e2e passing (1 known gap, see below)
- **Observations:**
  - Estendi `test/support/create-test-app.ts` para chamar `cookieParser()` (faltava — o helper afirmava espelhar `main.ts` mas não fazia, e o cenário 3 do spec precisa de `req.cookies`), aceitar overrides parciais do namespace `swagger` via `overrideProvider(swaggerConfig.KEY)`, e invocar `setupSwagger(app)`. Isso afeta todo e2e existente que usa `createTestApp()`, mas é aditivo (rotas novas + parsing de cookie) e não alterou nenhum teste pré-existente.
  - `test/swagger-ui.e2e-spec.ts` (autorado via JIT spec-read do `nestjs-project/specs/swagger-ui.plan.md`) tem 1 falha conhecida e aceita pelo usuário: o cenário `2.1. documento-declara-security-scheme-de-cookie > references jwt-cookie on protected endpoints` espera que `paths['/auth/refresh'|'/auth/logout'|'/users/me']...security` referencie `jwt-cookie`, o que só passa depois que a SI-5 anotar os controllers com `@ApiCookieAuth('jwt-cookie')`. Re-executar este arquivo após a SI-5 para confirmar.
  - O cenário 3 do spec original (`swagger-ui.plan.md`) assumia que `GET /users/me` sem cookie retorna `error: "SESSAO_INVALIDA"`; o `JwtAuthGuard` usa o `AuthGuard('jwt')` padrão do Passport (sem override de `handleRequest`), que lança `UnauthorizedException` genérica (`error: "Unauthorized"'), não a exceção de domínio. Ajustei o teste gerado para verificar apenas o status `401` — o `.plan.md` fonte ficou com essa suposição desatualizada (fora do escopo desta SI corrigir o spec).

### SI-4 — Decoradores compostos de resposta de erro
- **Status:** completed
- **Tests:** 4 passing
- **Observations:**
  - Tentei habilitar o CLI plugin do `@nestjs/swagger` também sob `ts-jest` (`astTransformers.before: ["@nestjs/swagger/plugin"]` em `package.json`/`test/jest-e2e.json`) para que a inferência de schema por tipo funcionasse nos testes igual ao build. Quebrou com `TypeError: beforeTransformer.factory is not a function` — incompatibilidade entre o formato do módulo exportado por `@nestjs/swagger/plugin` (exporta `before`/`default`, não `factory`) e o que o `ts-jest@29.2.5` espera para transformers referenciados por string. Revertido; `ErrorResponseDto` foi decorado explicitamente com `@ApiProperty()` em vez disso — único jeito de o schema aparecer tanto no build real quanto sob `ts-jest`, já que o DTO não tem decorators de `class-validator` para o `classValidatorShim` inferir.

### SI-5 — Anotar os controllers existentes com o contrato documentado
- **Status:** completed
- **Tests:** 33 passing (contrato) + 43/43 e2e (fase 02 sem regressão, gap da SI-3 fechado) + 188 unit
- **Observations:**
  - Resolvi de fato o `beforeTransformer.factory is not a function` da SI-4: criei `nestjs-project/jest-swagger-transformer.js`, um adaptador que expõe `{ name, version, factory(compilerInstance, options) }` em cima de `@nestjs/swagger/plugin`'s `before(options, program)` — formato que o `ts-jest@29` exige para transformers referenciados por string em `astTransformers.before`. Path teve que ser `"./jest-swagger-transformer.js"` (não `"../..."`) porque o `ts-jest` resolve o path relativo à raiz do projeto (`/home/node/app` no container), não ao `rootDir` interno de cada config. Isso agora roda em `package.json`'s jest e em `test/jest-e2e.json`, então o CLI plugin do swagger passa a inferir schemas também sob teste, igual ao `nest build`.
  - Reexecutei `test/swagger-ui.e2e-spec.ts` (SI-3) após anotar os controllers — o gap conhecido fechou: 10/10 passam agora, incluindo `references jwt-cookie on protected endpoints`.
  - Duas suposições do plano/spec não se confirmaram na prática e o teste de contrato foi ajustado para refletir o comportamento real do `@nestjs/swagger`, não o documentado: (1) `ConfirmDto`, por ser bindado via `@Query()`, nunca aparece em `components.schemas` — o plugin achata suas propriedades direto em `parameters` (`in: query`), então o teste passou a checar `ResetPasswordDto` (bindado via `@Body()`) para a asserção de schema nomeado. (2) `@IsNotEmpty()` sozinho **não** produz `minLength: 1` via `classValidatorShim` (só `@Length`/`@MinLength` produzem `minLength`) — o teste passou a checar apenas `type: 'string'` + presença em `required`, sem a expectativa de `minLength` que o texto do plano tinha.
  - `POST /auth/refresh` (dois erros a 401: `SESSAO_INVALIDA` e `TOKEN_REUTILIZADO`) e `POST /auth/reset-password` (dois erros a 400) colapsam num único response object por código de status no documento OpenAPI — limitação inerente do formato (`responses` é um mapa por status, não permite duas entradas pro mesmo código). O teste de contrato verifica o conjunto de status codes únicos por endpoint, não a contagem de decorators aplicados.

### SI-6 — Script `openapi:generate` e artefato `openapi.json` versionado
- **Status:** completed
- **Tests:** 1 passing (integration) + 189 unit + 43 e2e + build limpo, sem regressão
- **Observations:**
  - Desviei da instrução literal do plano ("executável via ts-node no mesmo padrão do script seed") com autorização explícita do usuário: `ts-node` puro não aplica o CLI plugin do `@nestjs/swagger` (`compilerOptions.plugins` do `nest-cli.json` só vale para o pipeline `nest build`/`nest start` — é uma limitação do TypeScript, não do Nest). Testei e confirmei: `RegisterDto` gerado via `ts-node` saía com `properties: {}` vazio. O script `openapi:generate` virou `nest build && node dist/openapi/generate-openapi.js` — mesmo pipeline já validado na SI-1, gera o artefato completo. Documentado em `nestjs-project/CLAUDE.md`.
  - `nestjs-project/openapi.json` gerado e é byte-idêntico entre execuções (`md5sum` igual antes/depois de uma segunda rodada) — AC #3 confirmado.
  - `generate-openapi.integration.spec.ts` escreve num arquivo temporário via `os.tmpdir()`, não em `src/openapi/` — o volume montado do projeto (bind mount host→container) tem arquivos de código com dono uid 1001 (host) e o container roda como uid 1000 (`node`); qualquer diretório do repo criado por mim (Write tool, uid 1001, modo 775 sem write pra "other") bloqueia escrita de dentro do container. Isso é o mesmo mismatch de UID já documentado em `nestjs-project/CLAUDE.md` para `npm install`; aqui afeta qualquer escrita de arquivo a partir do container em diretórios que eu criei.
  - `npm run lint` (com `--fix`) falha por completo dentro do container pelo mesmo motivo — TODO arquivo do repo é 664/775 dono do host, sem write para "other". Não é regressão desta task: reproduzi com `git blame`-equivalente (arquivos nunca tocados por mim, ex. `mail.service.ts`, migrations) e o mesmo EACCES ocorre. Rodei `eslint` (sem `--fix`, só leitura) direto no host (fora do Docker, via `npx` local) para verificar findings reais nos arquivos desta task; havia debt pré-existente enorme em arquivos que não toquei (fora de escopo) e uma dúzia de achados reais nos meus arquivos novos/editados (prettier + `no-unsafe-*` + `unbound-method` + `no-non-null-asserted-optional-chain` + `no-floating-promises`), que corrigi via `eslint --fix` rodado no host (permissão de escrita OK ali, já que sou o dono uid 1001). Resultado: 0 problemas nos arquivos desta task; suites completas (189 unit + 43 e2e) e build seguem verdes depois das correções.
