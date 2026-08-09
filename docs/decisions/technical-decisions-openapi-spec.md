---
scope_type: ad-hoc
related_phases: []
status: decided
date: 2026-08-08
scope_description: "Documentação OpenAPI da API NestJS: geração da spec, metadados dos DTOs, exposição do Swagger UI, emissão do artefato openapi.json e consumo pelo frontend"
---

# Technical Decisions — Documentação OpenAPI da API

_Subprojects in scope:_

- `nestjs-project/` — produtor da spec: setup do módulo OpenAPI, metadados dos DTOs, exposição da UI, emissão do arquivo `openapi.json` (TD-01 a TD-07)
- `next-frontend/` — consumidor da spec: os TDs `Cross-layer` (TD-01, TD-04, TD-05, TD-07) fixam o contrato que o frontend passa a consumir; não há TD exclusivo de frontend aqui

## Contexto e restrições

A API NestJS já expõe endpoints de autenticação e perfil (`src/auth/auth.controller.ts`, `src/users/users.controller.ts`) com DTOs decorados por `class-validator`, `ValidationPipe` global (`whitelist` + `forbidNonWhitelisted` + `transform`) e um `HttpExceptionFilter` global que normaliza toda resposta de erro para `{ statusCode, error, message }`. Hoje **não existe nenhuma documentação de API publicada** — o contrato só existe implicitamente no código dos controllers.

Restrições herdadas (não reabrir):

- NestJS 11 + TypeScript + Express (`@nestjs/common@^11.0.1`, `@nestjs/platform-express@^11.0.1`). O par compatível é `@nestjs/swagger@11.x` (peer `^11.0.1`).
- Validação de DTO por `class-validator@^0.14.4` + `class-transformer@^0.5.1` — já instalados e em uso.
- Config tipada por namespace com `registerAs` + `ConfigType`, validada por Joi; **leitura direta de `process.env` fora dos scripts CLI é proibida** (`config/TD-01`, `config/TD-02`, `config/TD-03`).
- Transporte do token de sessão é **cookie `httpOnly` + `Secure` + `SameSite=Strict`** (`auth/TD-03`, `auth/TD-15`) — a spec precisa declarar esse esquema, não `Bearer`.
- O `next-frontend/` existe (Next.js 16.2.12 + React 19.2.4) mas ainda não consome a API: `auth/TD-09` decidiu backend-only e adiou as telas.
- Docker Compose com host por nome de serviço, nunca `localhost`.

Nenhuma capacidade do `docs/project-plan.md` menciona documentação de API — por isso este documento é ad-hoc global (`related_phases: []`) e cada TD carrega `Trigger:` em vez de `Capability:`.

---

## TD-01: Origem da verdade do contrato — code-first vs spec-first

**Scope:** Cross-layer

**Trigger:** O usuário quer "implementar a doc OpenAPI no projeto nest.js"; antes de escolher ferramenta é preciso decidir quem é dono do contrato — o código TypeScript ou um arquivo de spec autoral.

**Context:** Esta decisão condiciona todas as demais: define se a spec é derivada do código (e portanto sempre reflete o que está implementado) ou se é um artefato autoral que o código precisa honrar. Como o backend já está parcialmente implementado (auth + users) e o frontend ainda não consome a API, a escolha determina se o contrato passa a ser gerado a partir do que existe ou reescrito à mão. É cross-layer porque o artefato resultante é a fronteira entre `nestjs-project/` e `next-frontend/`.

**Options:**

### Option A: Code-first com `@nestjs/swagger`
- Decorators e metadados nos controllers/DTOs alimentam `SwaggerModule.createDocument()`, que monta o documento OpenAPI 3 a partir do grafo de módulos em runtime.
- **Pros:** spec nunca diverge do código implementado; zero duplicação de definição de tipos; é o caminho oficial do NestJS 11 e integra direto com o `class-validator` já em uso; funciona sobre o código atual sem refatoração.
- **Cons:** a spec só existe depois de o código existir — não dá para desenhar o contrato antes de implementar; o que não é decorado simplesmente não aparece (omissão silenciosa).

### Option B: Spec-first — `openapi.yaml` autoral como fonte da verdade
- Um arquivo OpenAPI escrito à mão define o contrato; o backend é implementado para honrá-lo e um validador de request/response checa a conformidade em runtime ou em teste.
- **Pros:** o contrato pode ser desenhado e revisado antes da implementação; permite ao frontend trabalhar contra o contrato antes de o endpoint existir; a spec é um documento de design, não um subproduto.
- **Cons:** duas fontes de verdade (YAML + DTOs TS) que divergem silenciosamente sem um teste de conformidade dedicado; retrabalho imediato — os endpoints de auth já estão implementados e precisariam ser retro-documentados à mão; custo alto para um projeto de um desenvolvedor.

### Option C: Schema-first com Zod + geração de OpenAPI
- Substituir `class-validator` por schemas Zod (via `nestjs-zod` ou similar), que servem simultaneamente como validação de runtime, tipo TS inferido e fonte do schema OpenAPI.
- **Pros:** uma única definição gera validação, tipos e documentação; o schema é compartilhável literalmente com o frontend (mesmo pacote npm).
- **Cons:** exige migrar todos os DTOs de `class-validator` para Zod, contrariando `config/TD-03` (que manteve o ecossistema já instalado) e reabrindo uma decisão de validação já tomada; introduz dependências novas em todo o backend por um ganho que é secundário ao objetivo (documentar a API).

**Recommendation:** Option A (code-first com `@nestjs/swagger`) — o backend de auth já está implementado e validado por `class-validator`, então o code-first documenta o que existe hoje sem retrabalho e sem risco de divergência; a Option B só se paga quando o contrato precisa preceder a implementação em times paralelos, o que não é o caso, e a Option C reabre a decisão de validação de `config/TD-03` por um benefício tangencial.

**Decision:** Option A — code-first com `@nestjs/swagger`; a spec é derivada do código via `SwaggerModule.createDocument()`.

**Renders in:** ui-contracts

**Libraries:** @nestjs/swagger

---

## TD-02: Fonte dos metadados dos DTOs — CLI plugin vs decorators explícitos

**Scope:** Backend

**Trigger:** Escolhido o code-first, é preciso decidir de onde `@nestjs/swagger` extrai o tipo, a obrigatoriedade e o formato de cada campo dos DTOs — o TypeScript não emite essa informação em runtime por conta própria.

**Context:** O `@nestjs/swagger` só enxerga o que estiver em metadata de runtime. Sem ajuda, cada campo de cada DTO precisa de um `@ApiProperty()` manual. O CLI plugin (`@nestjs/swagger/plugin`, ativado em `nest-cli.json`) resolve isso em tempo de compilação, inclusive traduzindo decorators de `class-validator` para restrições OpenAPI (`classValidatorShim`) e comentários JSDoc para descrições (`introspectComments`). O ponto de acoplamento crítico: **o plugin roda no pipeline de compilação do `nest build`** — qualquer caminho de geração que não passe pelo compilador do Nest (um script `ts-node`, por exemplo) perde os metadados, o que amarra esta decisão à TD-04. _(Depende de TD-01.)_

**Options:**

### Option A: CLI plugin `@nestjs/swagger/plugin` em `nest-cli.json`
- Ativar o plugin com `classValidatorShim: true` e `introspectComments: true`; os DTOs existentes ganham schema OpenAPI completo sem alteração de código.
- **Pros:** zero boilerplate nos 10 DTOs atuais e nos futuros; as restrições já escritas (`@IsEmail`, `@Length(8, 128)`, `@MaxLength(254)`) viram `format`, `minLength` e `maxLength` na spec automaticamente; os JSDoc obrigatórios pela convenção do projeto viram descrições; impossível esquecer de documentar um campo novo.
- **Cons:** o schema passa a depender de uma transformação em build-time, invisível ao ler o DTO; exige que toda emissão da spec passe pelo `nest build` (ou pelo `swagger-metadata.json` + `SwaggerModule.loadPluginMetadata`), restringindo as opções da TD-04.

### Option B: `@ApiProperty()` explícito em cada campo
- Cada propriedade de DTO recebe `@ApiProperty({ description, example, required })` escrito à mão.
- **Pros:** o schema é literal e legível no próprio arquivo; nenhuma dependência de build-time; funciona igual sob `nest build`, `ts-node` ou Jest.
- **Cons:** duplica no decorator o que `class-validator` já declara ao lado (`@Length(8, 128)` + `@ApiProperty({ minLength: 8, maxLength: 128 })`), com risco permanente de divergirem; campo novo sem decorator sai da spec silenciosamente; ~40 decorators a manter só nos DTOs atuais.

### Option C: Plugin + `@ApiProperty()` pontual como override
- Plugin ativado como base; `@ApiProperty()` usado apenas onde o inferido não basta (exemplos concretos, `oneOf`, campos com semântica não expressa pelo tipo).
- **Pros:** cobertura automática por padrão com escape hatch onde importa; o decorator explícito passa a sinalizar intenção em vez de repetir o óbvio.
- **Cons:** convenção mista exige disciplina — sem critério escrito de "quando anotar", o override vira ruído aleatório.

**Recommendation:** Option C (plugin + override pontual) — o plugin elimina o boilerplate e mantém a spec sincronizada com as regras de `class-validator` já escritas, enquanto o `@ApiProperty()` reservado para exemplos e casos ambíguos evita a duplicação sistemática da Option B; o critério de override deve ficar registrado no `nestjs-project/CLAUDE.md`.

**Decision:** Option C — CLI plugin `@nestjs/swagger/plugin` (com `classValidatorShim` e `introspectComments`) como base, `@ApiProperty()` apenas como override pontual.

**Libraries:** @nestjs/swagger

---

## TD-03: Exposição do Swagger UI e política por ambiente

**Scope:** Backend

**Trigger:** A API precisa decidir se serve o Swagger UI como endpoint HTTP, em qual rota e sob quais ambientes — a UI expõe publicamente a superfície completa da API, incluindo os endpoints de auth.

**Context:** `SwaggerModule.setup()` registra rotas HTTP servindo a UI e o JSON da spec. A API é internet-facing em produção (Fase 07 prevê deploy) e a superfície documentada inclui `POST /auth/login`, `POST /auth/forgot-password` e demais endpoints sensíveis já protegidos por `@nestjs/throttler`. A rota e a condição de habilitação são configuração, e por `config/TD-01`/`config/TD-02` precisam entrar num namespace tipado validado por Joi — não podem ser `process.env` solto no `main.ts`.

**Options:**

### Option A: UI sempre habilitada, em qualquer ambiente
- `SwaggerModule.setup('docs', app, document)` incondicional no `main.ts`.
- **Pros:** setup trivial; a documentação vive junto do serviço e está sempre disponível para quem integra.
- **Cons:** expõe o mapa completo da API em produção, facilitando enumeração de endpoints por quem sonda o serviço; adiciona a UI ao bundle servido em produção sem necessidade.

### Option B: UI habilitada por flag de config, desligada em produção por padrão
- Um namespace `swagger` (`registerAs`) expõe `enabled` e `path`; `enabled` default `true` fora de produção e `false` em produção, validado no schema Joi; o `main.ts` chama `setup()` condicionalmente.
- **Pros:** dev e staging ganham a UI sem esforço e produção não expõe nada por padrão; a flag continua permitindo ligar a UI em produção deliberadamente; alinha com o padrão de config namespaced de `config/TD-01`/`config/TD-02`.
- **Cons:** duas variáveis novas no `.env.example` e no schema Joi; um consumidor externo em produção não tem UI para explorar (mitigado pelo artefato da TD-04).

### Option C: UI sempre habilitada, protegida por Basic Auth em produção
- A rota da UI fica atrás de um middleware de autenticação HTTP básica com credenciais vindas de config.
- **Pros:** documentação acessível em produção para integradores autorizados sem expor publicamente.
- **Cons:** introduz um segundo mecanismo de autenticação no projeto, paralelo ao JWT+cookie de `auth/TD-01`; mais um par de segredos para gerenciar; não há hoje nenhum consumidor externo que justifique o custo.

**Recommendation:** Option B (flag de config, desligada em produção) — entrega o valor real da UI (explorar a API em desenvolvimento) sem ampliar a superfície exposta em produção nem introduzir um segundo esquema de autenticação; se um integrador externo surgir, a Option C continua alcançável ligando a flag e adicionando o guard, sem desfazer nada.

**Decision:** Option B — Swagger UI habilitado por flag num namespace `swagger` (`enabled` + `path`) via `registerAs`, validado no Joi; desligado em produção por padrão.

**Libraries:** @nestjs/swagger, @nestjs/config

---

## TD-04: Emissão do `openapi.json` como artefato — se, como e onde

**Scope:** Cross-layer

**Trigger:** Para o frontend consumir o contrato (e para versioná-lo/diffá-lo em review), a spec precisa existir como arquivo, não apenas como resposta HTTP de um servidor rodando.

**Context:** A spec gerada em runtime só é acessível com a API no ar. Um arquivo em disco permite: revisar mudanças de contrato no diff do PR, rodar codegen no frontend sem subir o backend e detectar quebras de contrato acidentais. O ponto crítico de acoplamento é a TD-02: se o CLI plugin estiver ativo, os metadados só existem após a compilação do Nest — um script `ts-node` avulso geraria uma spec silenciosamente incompleta. Também é preciso decidir onde o arquivo mora; por ownership, o artefato pertence ao subprojeto que o produz. _(Depende de TD-01 e TD-02.)_

**Options:**

### Option A: Sem arquivo — apenas a rota `/docs-json` em runtime
- O contrato só existe enquanto a API está no ar; o frontend aponta o codegen para a URL do serviço.
- **Pros:** nada para gerar, versionar ou manter sincronizado; impossível o arquivo ficar desatualizado, porque não existe.
- **Cons:** mudança de contrato não aparece em diff de PR; o frontend precisa do backend rodando para gerar tipos, quebrando o build do frontend isolado e no CI; nenhum histórico de evolução do contrato.

### Option B: Script `openapi:generate` que compila, faz bootstrap sem `listen()` e escreve `nestjs-project/openapi.json` versionado
- Um entrypoint dedicado roda sobre o build (`nest build` → `node dist/...`), cria a app via `NestFactory.create`, chama `SwaggerModule.createDocument()`, serializa com `JSON.stringify(document, null, 2)`, escreve o arquivo e encerra sem abrir porta. O arquivo é commitado.
- **Pros:** contrato versionado — toda mudança aparece no diff do PR e vira histórico auditável; o frontend gera tipos sem subir o backend; compatível com o CLI plugin porque passa pelo `nest build`; o artefato fica no subprojeto que o produz.
- **Cons:** exige disciplina de regerar (ou um check no CI que falha se o arquivo estiver defasado); acrescenta um entrypoint e um script npm ao backend; o `NestFactory.create` executa os providers, então dependências de boot precisam estar disponíveis no ambiente de geração.

### Option C: Gerar apenas no CI como artefato de pipeline, sem commitar
- O mesmo script roda no CI e publica `openapi.json` como artefato de build consumido pelo job do frontend.
- **Pros:** sem arquivo gerado no repositório e sem risco de defasagem; a spec é sempre fresca.
- **Cons:** não há pipeline de CI no projeto ainda (Fase 07); o contrato deixa de ser revisável no PR, que é justamente o maior ganho de tê-lo em arquivo; desenvolvimento local do frontend volta a depender de subir o backend.

**Recommendation:** Option B (`nestjs-project/openapi.json` versionado, gerado por script sobre o build) — versionar o contrato é o que torna uma quebra de compatibilidade visível no code review, e é o único caminho compatível tanto com o CLI plugin da TD-02 quanto com codegen de frontend offline; o custo de defasagem se resolve depois com um check no CI da Fase 07 (`git diff --exit-code openapi.json` após regerar). O arquivo mora em `nestjs-project/` porque `docs/` é reservado a documentação autoral, não a artefato gerado.

**Decision:** Option B — script `openapi:generate` roda sobre o `nest build`, faz bootstrap sem `listen()` e escreve `nestjs-project/openapi.json`, que é versionado no repositório.

**Renders in:** ui-contracts

**Libraries:** @nestjs/swagger

**Revisions:**
- 2026-08-08 — Geração do `openapi.json` é **sob demanda**, não acoplada ao build: `openapi:generate` é um script standalone invocado manualmente (dentro do container, ex.: `docker compose run --rm nestjs-api npm run openapi:generate`), nunca um hook de `postbuild` nem etapa obrigatória do pipeline. Rationale: o bootstrap do `AppModule` inicializa `TypeOrmModule` e valida todo o schema Joi, exigindo Postgres, Mailpit e todas as variáveis obrigatórias no ar — e o host `db` só resolve dentro da rede do Compose (convenção herdada da fase 02). Como o contrato muda com pouca frequência, rodar sob demanda paga esse custo apenas quando a spec realmente precisa ser regerada, em vez de tornar todo `nest build` dependente da infraestrutura.

---

## TD-05: Consumo da spec pelo frontend — estratégia de codegen dos tipos e do client

**Scope:** Cross-layer

**Trigger:** Com a spec disponível, é preciso decidir como o `next-frontend/` deriva tipos e chamadas HTTP a partir dela — ou se transcreve o contrato à mão.

**Context:** Este é o TD que fixa a estratégia de **shared types / sincronização de contrato** entre backend e frontend. Hoje o `next-frontend/` (Next.js 16 + React 19, sem lib de data fetching instalada) não consome a API. A escolha determina se uma mudança incompatível no backend quebra o **type-check** do frontend (falha em build) ou apenas o **runtime** (falha em produção). Cada opção tem peso muito diferente em dependências e em opinião imposta sobre o data fetching. _(Depende de TD-04 — sem artefato em arquivo, o codegen exige o backend no ar.)_

**Options:**

### Option A: `openapi-typescript` + `openapi-fetch`
- `openapi-typescript` gera um único `.d.ts` de tipos puros a partir do `openapi.json`; `openapi-fetch` é um wrapper fino sobre `fetch` tipado por esses tipos (`client.POST('/auth/login', { body })`).
- **Pros:** custo de runtime praticamente zero (os tipos somem na compilação; o client é um wrapper mínimo); não impõe biblioteca de data fetching, preservando o uso nativo de `fetch` + cache do App Router do Next 16; contrato incompatível quebra o `tsc`, não a produção; superfície de dependência mínima.
- **Cons:** não gera funções nomeadas por operação — as chamadas são por path + método literal; nenhum helper de cache, retry ou estado de carregamento (fica por conta do App Router / RSC).

### Option B: `@hey-api/openapi-ts` — SDK completo gerado
- Gera um SDK com uma função por operação (`login({ body })`), modelos, e opcionalmente validadores e plugins de integração.
- **Pros:** DX mais alta — autocomplete por nome de operação em vez de path string; cobre validação de runtime e integrações via plugins.
- **Cons:** volume de código gerado bem maior no repositório do frontend; versão ainda `0.x` (0.99.0), com histórico de mudanças de API entre minors; traz opinião sobre estrutura de client que compete com o modelo de fetch/cache nativo do Next 16.

### Option C: `orval` — gera hooks de data fetching
- Gera client e hooks já integrados a TanStack Query / SWR a partir da spec.
- **Pros:** entrega a camada de data fetching pronta, com cache e estados de carregamento.
- **Cons:** obriga a adotar uma lib de client-side data fetching que o projeto ainda não escolheu — decisão de arquitetura de frontend maior que este documento, e em tensão com o modelo server-first do Next 16 (RSC + Server Actions), onde grande parte das chamadas nem passa pelo cliente.

### Option D: Sem codegen — tipos transcritos à mão no frontend
- Interfaces TS escritas manualmente no `next-frontend/`, espelhando os DTOs do backend.
- **Pros:** nenhuma dependência nem passo de build novo; controle total sobre a forma dos tipos no frontend.
- **Cons:** o contrato passa a ter duas fontes de verdade que divergem em silêncio — exatamente o problema que a spec existe para resolver; toda mudança no backend exige edição manual coordenada, sem nenhuma rede de segurança em build.

**Recommendation:** Option A (`openapi-typescript` + `openapi-fetch`) — dá a garantia essencial (mudança incompatível de contrato falha no `tsc` do frontend) com a menor superfície de dependência e sem antecipar a decisão de data fetching do frontend, que deve ser tomada quando as telas entrarem em escopo; a Option C carrega essa decisão junto e a Option B cobra custo de código gerado e instabilidade de `0.x` por uma DX marginalmente melhor. A adoção pode ficar **diferida** até as telas existirem — o que este TD fixa agora é a estratégia, para que a TD-04 gere o artefato no formato certo.

**Decision:** Option A — `openapi-typescript` (tipos) + `openapi-fetch` (client tipado). A **estratégia** fica fixada aqui; a **adoção** no `next-frontend/` está diferida até as telas entrarem em escopo (ver `## Non-UI / Deferred Capabilities` em `docs/tasks/task-openapi-spec/context.md`).

**Libraries:** openapi-typescript, openapi-fetch

---

## TD-06: Declaração do esquema de segurança na spec e ergonomia do "Try it out"

**Scope:** Cross-layer

**Trigger:** A sessão trafega em cookie `httpOnly` (`auth/TD-03`), não em header `Authorization` — a spec precisa declarar isso corretamente, e o Swagger UI precisa conseguir exercitar endpoints protegidos.

**Context:** O default dos exemplos de NestJS é `addBearerAuth()`, que descreveria um contrato que a API **não** implementa: o `JwtAuthGuard` lê o access token do cookie definido em `AUTH_COOKIES`, e `auth/TD-15` fixou `SameSite=Strict`. Declarar o esquema errado propaga o erro para o codegen do frontend (TD-05), que geraria um client mandando header. Há ainda a questão prática de o "Try it out" da UI conseguir enviar cookies — o que exige `withCredentials` no cliente da UI e, com `SameSite=Strict`, só funciona quando UI e API estão na mesma origem. _(Depende de TD-03 e TD-05.)_

**Options:**

### Option A: `addCookieAuth` com o nome real do cookie + `swaggerOptions.withCredentials`
- `DocumentBuilder().addCookieAuth(AUTH_COOKIES.ACCESS_TOKEN, { type: 'apiKey', in: 'cookie' }, 'cookie-auth')`, com os endpoints protegidos marcados por `@ApiCookieAuth('cookie-auth')` e a UI configurada com `withCredentials: true`.
- **Pros:** a spec descreve exatamente o que a API implementa; o codegen do frontend deriva o comportamento correto (enviar credenciais, não header); o "Try it out" funciona porque a UI é servida pela própria API (mesma origem, compatível com `SameSite=Strict`).
- **Cons:** o fluxo de login pela UI depende de o browser aceitar e reenviar o cookie — exige `withCredentials` configurado corretamente e não funciona se a UI for servida de outra origem.

### Option B: Declarar `addCookieAuth` e adicionalmente `addBearerAuth` para facilitar testes
- Além do cookie, a spec declara Bearer, e a API passa a aceitar também o header `Authorization` como fallback.
- **Pros:** "Try it out" trivial (colar o token no campo Bearer); ferramentas externas de teste de API ficam mais simples de usar.
- **Cons:** altera a **implementação** da autenticação para acomodar a documentação, reabrindo `auth/TD-03` — aceitar Bearer reintroduz a superfície de XSS que a decisão do cookie `httpOnly` existia para fechar; dois caminhos de autenticação a manter e testar.

### Option C: Apenas marcar os endpoints como protegidos, sem esquema formal
- Documentar em prosa que a rota exige sessão, sem `securityScheme` na spec.
- **Pros:** setup mínimo.
- **Cons:** a spec deixa de ser processável nesse ponto — o codegen não sabe que a chamada precisa de credenciais e a UI não tem como exercitar rota protegida; desperdiça o principal valor de ter OpenAPI.

**Recommendation:** Option A (`addCookieAuth` + `withCredentials`) — é a única que descreve fielmente o contrato já decidido em `auth/TD-03` sem alterar a implementação de autenticação; a Option B compra conveniência de teste ao preço de reabrir uma decisão de segurança fechada, o que não se justifica.

**Decision:** Option A — `addCookieAuth` com o nome real do cookie de access token, endpoints protegidos marcados com `@ApiCookieAuth`, e a UI configurada com `swaggerOptions.withCredentials: true`.

**Renders in:** ui-contracts

**Libraries:** @nestjs/swagger

---

## TD-07: Documentação das respostas de erro na spec

**Scope:** Cross-layer

**Trigger:** Todo erro da API sai pelo `HttpExceptionFilter` global no formato `{ statusCode, error, message }`, mas esse envelope não está documentado em lugar nenhum — a spec precisa expressá-lo para o frontend poder tipá-lo.

**Context:** O envelope de erro é um contrato cross-layer de fato: o `HttpExceptionFilter` o produz e o frontend vai consumi-lo em todo tratamento de falha. Sem documentação, o codegen da TD-05 tipa o caminho de erro como `unknown` e cada tela reinventa o parsing. Além do formato, há a questão de quanto documentar por endpoint: o `ValidationPipe` global produz `400` em qualquer rota com body, o `JwtAuthGuard` produz `401` nas protegidas e o `ThrottlerGuard` produz `429` nas rotas com `@Throttle` — respostas que nenhum controller declara explicitamente. _(Depende de TD-01 e TD-05.)_

**Options:**

### Option A: `ErrorResponseDto` + `@ApiResponse` declarado endpoint a endpoint
- Um DTO único descreve o envelope; cada handler declara os status que pode retornar com `@ApiResponse({ status, type: ErrorResponseDto, description })`.
- **Pros:** documentação precisa por endpoint — o consumidor sabe exatamente quais falhas esperar de cada rota; descrições específicas por caso de erro.
- **Cons:** verboso e repetitivo (`401` e `429` se repetem em quase todo handler); fácil esquecer de declarar num endpoint novo, produzindo documentação incompleta assimétrica.

### Option B: Decorator composto reutilizável por perfil de endpoint
- `applyDecorators` empacota conjuntos recorrentes (`@ApiAuthErrors()` = `401` + `403`, `@ApiValidationErrors()` = `400`, `@ApiThrottled()` = `429`), aplicados conforme os guards de cada rota, mais o `ErrorResponseDto` compartilhado.
- **Pros:** elimina a repetição mantendo precisão por endpoint; o decorator fica ao lado do guard correspondente, então adicionar `@UseGuards(JwtAuthGuard)` e `@ApiAuthErrors()` vira um par natural; extensível a novos perfis.
- **Cons:** exige criar e manter os decorators compostos; a correspondência decorator ↔ guard é convenção, não é garantida pelo compilador.

### Option C: Respostas de erro globais via `DocumentBuilder`/pós-processamento do documento
- Injetar as respostas de erro comuns em todas as operações de uma vez, manipulando o documento gerado antes de servi-lo.
- **Pros:** cobertura total automática, impossível esquecer.
- **Cons:** documenta `401` em rota pública e `429` em rota sem throttle — spec tecnicamente errada; o pós-processamento manual do documento é código frágil, acoplado à estrutura interna do objeto OpenAPI.

**Recommendation:** Option B (decoradores compostos por perfil) — é o único caminho que mantém a spec fiel por endpoint sem o custo de repetição da Option A nem a imprecisão da Option C; com poucos endpoints hoje, criar os três decoradores agora é barato e evita que a convenção se degrade quando vídeos e comentários multiplicarem os controllers.

**Decision:** Option B — decoradores compostos por perfil de erro (`@ApiAuthErrors`, `@ApiValidationErrors`, `@ApiThrottled`) via `applyDecorators`, sobre um `ErrorResponseDto` compartilhado que descreve `{ statusCode, error, message }`.

**Renders in:** ui-contracts

**Libraries:** @nestjs/swagger

---

## Notas de implementação

- O namespace de config do Swagger (TD-03) deve seguir `config/TD-01`/`config/TD-02`: arquivo `src/config/swagger.config.ts` com `registerAs('swagger', ...)` e as variáveis registradas no schema Joi de `env.validation.ts` e no `.env.example`.
- Se a TD-04 for aprovada, o entrypoint de geração roda **fora** do container DI apenas no sentido de não escutar porta — ele ainda instancia a app, então vale reusar o padrão de loader puro de `config/TD-04` para não duplicar montagem de opções.
- A convenção de override de `@ApiProperty()` (TD-02, Option C) precisa ficar escrita no `nestjs-project/CLAUDE.md` para não virar decisão caso a caso.

---

## Decisions Summary

| ID | Scope | Decision | Recommendation | Choice |
|----|-------|----------|---------------|--------|
| TD-01 | Cross-layer | Origem da verdade do contrato (code-first vs spec-first) | Code-first com `@nestjs/swagger` (Option A) | **Option A** |
| TD-02 | Backend | Fonte dos metadados dos DTOs | CLI plugin + `@ApiProperty` pontual (Option C) | **Option C** |
| TD-03 | Backend | Exposição do Swagger UI por ambiente | Flag de config, desligada em produção (Option B) | **Option B** |
| TD-04 | Cross-layer | Emissão do `openapi.json` como artefato | Script sobre o build, arquivo versionado em `nestjs-project/` (Option B) | **Option B** |
| TD-05 | Cross-layer | Codegen do contrato no frontend (shared types) | `openapi-typescript` + `openapi-fetch` (Option A) | **Option A** |
| TD-06 | Cross-layer | Esquema de segurança na spec (cookie auth) | `addCookieAuth` + `withCredentials` (Option A) | **Option A** |
| TD-07 | Cross-layer | Documentação das respostas de erro | Decoradores compostos por perfil (Option B) | **Option B** |
