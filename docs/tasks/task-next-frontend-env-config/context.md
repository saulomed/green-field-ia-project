---
kind: task
name: task-next-frontend-env-config
sources_mtime:
  docs/decisions/technical-decisions-next-frontend-env-config.md: "2026-08-10T10:30:53Z"
  docs/decisions/technical-decisions-config.md: "2026-08-10T10:31:59Z"
  docs/decisions/technical-decisions-openapi-spec.md: "2026-08-08T21:32:44Z"
  docs/phases/phase-02-auth/context.md: "2026-08-08T20:56:25Z"
  .claude/skills/testing-guide-next-frontend/SKILL.md: "2026-08-09T18:07:37Z"
---

# task-next-frontend-env-config — Context

## Scope

> Base de configuração de variáveis de ambiente do next-frontend: acesso tipado, validação, organização e fronteira server/client. Inclui também a convenção de carregamento de env no ambiente de teste, cuja implementação é delegada à task de MSW (que materializa o ferramental Vitest).

## Decisions Index

| Ref | Source | Scope | Topic | Status | Decision | Libraries | Renders in |
|-----|--------|-------|-------|--------|----------|-----------|------------|
| next-frontend-env-config/TD-01 | ad-hoc | Frontend | Estratégia de acesso à configuração e enforcement da f… | decided | C | @t3-oss/env-nextjs | frontend-runtime |
| next-frontend-env-config/TD-02 | ad-hoc | Frontend | Biblioteca de validação do schema de ambiente | decided | A | zod | — |
| next-frontend-env-config/TD-03 | ad-hoc | Frontend | Organização das variáveis — arquivo único vs namespaces | decided | C | — | — |
| next-frontend-env-config/TD-04 | ad-hoc | Repo-wide | Momento de resolução das variáveis públicas — build vs r… | decided | C | — | — |
| next-frontend-env-config/TD-05 | ad-hoc | Frontend | Carregamento da configuração no ambiente de teste | decided | A | @next/env | — |

_Source files:_

- next-frontend-env-config — `docs/decisions/technical-decisions-next-frontend-env-config.md` (scope_type: ad-hoc, related_phases: [])

## Decisions Detail

### next-frontend-env-config/TD-01

**Recommendation:** a diferença material entre B e C não é tipagem (as duas entregam), é **onde mora o enforcement da fronteira**: em B ele depende de o autor lembrar do `import "server-only"` a cada arquivo novo; em C ele é estrutural, e a exigência de destructuração literal em `experimental__runtimeEnv` neutraliza de graça o modo de falha mais caro do Next (uma `NEXT_PUBLIC_*` que silenciosamente vira `undefined` no bundle). Com 2 variáveis hoje o custo parece desproporcional, mas as fases 03–07 acrescentam base URL de storage, chaves de player e provavelmente analytics — todas atravessando essa fronteira. Option B é a escolha defensável se a preferência for não adicionar dependência: entrega o mesmo resultado com mais disciplina exigida. Option A está descartada — reabre por omissão a decisão que `config/TD-01` fechou.
**Renders in:** frontend-runtime
**Libraries:** @t3-oss/env-nextjs

### next-frontend-env-config/TD-02

**Recommendation:** a decisão real não é "o que valida 2 variáveis melhor" (as quatro validam), é qual biblioteca o front vai carregar quando as telas de formulário chegarem, e aí Zod é a que tem integração pronta com React Hook Form e com o `openapi-fetch` de `openapi-spec/TD-05`, evitando uma segunda lib depois. Option B é a escolha certa se o peso do bundle do cliente for tratado como restrição dura — o ganho é real, o custo é ecossistema menor. Option D é simetria aparente que não se sustenta tecnicamente: Joi não gera tipos nem compõe com a TD-01 Option C.
**Libraries:** zod

### next-frontend-env-config/TD-03

**Recommendation:** preserva o que a Revision de `config/TD-02` de fato exige (fronteiras de domínio visíveis no ponto de consumo) sem pagar por três arquivos para duas variáveis, e mantém a validação atômica que a TD-01 Option C torna desejável. Option B é a resposta certa se a simetria estrutural literal com `src/config/` for o objetivo declarado — é defensável, custa organização antecipada. Option A é suficiente e honesta se a expectativa for que o front nunca passe de ~5 variáveis.
**Libraries:** —

### next-frontend-env-config/TD-04

**Recommendation:** Option C para o tráfego de API, com a ressalva explícita de que ela **não** cobre streaming e download de vídeo (Fases 03 e 05), que continuarão exigindo URL pública e devem ser decididos quando o object storage entrar em escopo. A justificativa é que o projeto já escolheu o BFF como a superfície testável do front (`CLAUDE.md` § Testing fixou route handlers + MSW como o lane de integração) e já escolheu cookie `httpOnly` + `SameSite=Strict` (`auth/TD-03`, `auth/TD-15`) — manter browser e API na mesma origem é o que faz esse cookie funcionar sem exceção. Option A é a escolha pragmática se a intenção for aceitar imagens por ambiente; Option B é a mais correta conceitualmente para uma imagem promovível, mas cobra prerender estático justamente na home da Fase 07, que é onde o estático mais vale.
**Libraries:** —

### next-frontend-env-config/TD-05

**Recommendation:** Option A, com um `.env.test` versionado no repositório apontando para hosts fictícios (`http://nestjs-api.test:3000`) — reusa a mesma precedência do runtime do Next, mantém uma fonte de verdade só para as chaves, e o host fictício garante que qualquer request não interceptado pelo MSW falhe de forma óbvia em vez de vazar para o serviço real. Option B é a escolha certa se determinismo absoluto do suite valer mais que a duplicação das chaves. Option C deve ser descartada por incompatibilidade de ordem de execução com a validação-no-import da TD-01, não por preferência.
**Libraries:** @next/env

## Inherited Decisions Detail

### config/TD-01

**Recommendation:** é o padrão oficial do NestJS 11, dá tipagem forte sem manutenção manual de getters e já resolve a organização por domínio (TD-02).
**Libraries:** @nestjs/config
**Revisions:**
- 2026-08-10 — A decisão passa a ter duas metades com alcances distintos: o **mecanismo** (`registerAs` + `ConfigType`) fica restrito ao `nestjs-project/`; o **princípio** ("sem magic strings e sem `process.env` no código da aplicação, concentrado num loader único") é promovido a transversal do monorepo. Rationale: `registerAs` e `ConfigType` são API de `@nestjs/config` e não existem no Next.js, mas o TD era herdado literalmente como convenção pelo `next-frontend/`, gerando um conflito (`ICC-2`) contra `next-frontend-env-config/TD-01`, que adotou `@t3-oss/env-nextjs` + `createEnv`. A adoção honra integralmente o princípio — toda leitura de `process.env` fica num módulo único, validado na importação — e diverge apenas na API, que é intransportável entre as stacks.

### config/TD-02

**Recommendation:** agrupar por domínio (`app` com `PORT`/`NODE_ENV`, `database`, `mail`) prepara o terreno para as próximas fases sem refatorar depois; é o complemento natural da TD-01 B. _(Depende de TD-01.)_
**Libraries:** @nestjs/config
**Revisions:**
- 2026-08-09 — O namespacing por domínio passa a reger também o `next-frontend/`, que ganha base própria de configuração de ambiente. Rationale: o TD-02 nasceu com `Scope: Backend` porque `auth/TD-09` adiara o frontend; com o Next.js entrando em escopo, o princípio de "um arquivo de config por domínio, sem leitura direta de `process.env` fora do loader" é reafirmado como transversal ao monorepo. A mecânica permanece específica de cada stack.

### config/TD-03

**Recommendation:** já está instalado, validando o boot e cobrindo defaults/coerção; trocar agora adiciona dependência e retrabalho sem ganho proporcional. A tipagem forte vem da TD-01 (B), não da lib de validação.
**Libraries:** joi
**Revisions:**
- 2026-08-10 — A escolha de **Joi** fica delimitada ao `nestjs-project/`. O que rege o monorepo é o **comportamento** — validação de schema no boot, com variável obrigatória ausente derrubando a aplicação —, não a biblioteca que o implementa. Rationale: o TD era herdado literalmente como convenção pelo `next-frontend/`, gerando um conflito (`ICC-1`) contra `next-frontend-env-config/TD-02`, que adotou Zod v4. Joi não implementa Standard Schema (logo não compõe com o `createEnv` da TD-01), não deriva tipos TypeScript do schema, e não é tree-shakeable no browser. O comportamento exigido é preservado: `createEnv` valida na importação do módulo.

### config/TD-04

**Recommendation:** uma função pura compartilhada elimina a duplicação atual de `DB_*` entre `database.module.ts`, `data-source.ts` e `seed.ts`, mantendo CLI e app sempre alinhados.
**Libraries:** typeorm

### openapi-spec/TD-01

**Recommendation:** o backend de auth já está implementado e validado por `class-validator`, então o code-first documenta o que existe hoje sem retrabalho e sem risco de divergência; a Option B só se paga quando o contrato precisa preceder a implementação em times paralelos, o que não é o caso, e a Option C reabre a decisão de validação de `config/TD-03` por um benefício tangencial.
**Renders in:** ui-contracts
**Libraries:** @nestjs/swagger

### openapi-spec/TD-02

**Recommendation:** o plugin elimina o boilerplate e mantém a spec sincronizada com as regras de `class-validator` já escritas, enquanto o `@ApiProperty()` reservado para exemplos e casos ambíguos evita a duplicação sistemática da Option B; o critério de override deve ficar registrado no `nestjs-project/CLAUDE.md`.
**Libraries:** @nestjs/swagger

### openapi-spec/TD-03

**Recommendation:** entrega o valor real da UI (explorar a API em desenvolvimento) sem ampliar a superfície exposta em produção nem introduzir um segundo esquema de autenticação; se um integrador externo surgir, a Option C continua alcançável ligando a flag e adicionando o guard, sem desfazer nada.
**Libraries:** @nestjs/swagger, @nestjs/config

### openapi-spec/TD-04

**Recommendation:** versionar o contrato é o que torna uma quebra de compatibilidade visível no code review, e é o único caminho compatível tanto com o CLI plugin da TD-02 quanto com codegen de frontend offline; o custo de defasagem se resolve depois com um check no CI da Fase 07 (`git diff --exit-code openapi.json` após regerar). O arquivo mora em `nestjs-project/` porque `docs/` é reservado a documentação autoral, não a artefato gerado.
**Renders in:** ui-contracts
**Libraries:** @nestjs/swagger
**Revisions:**
- 2026-08-08 — Geração do `openapi.json` é **sob demanda**, não acoplada ao build: `openapi:generate` é um script standalone invocado manualmente (dentro do container), nunca um hook de `postbuild` nem etapa obrigatória do pipeline. Rationale: o bootstrap do `AppModule` inicializa `TypeOrmModule` e valida todo o schema Joi, exigindo Postgres, Mailpit e todas as variáveis obrigatórias no ar — e o host `db` só resolve dentro da rede do Compose. Como o contrato muda com pouca frequência, rodar sob demanda paga esse custo apenas quando a spec realmente precisa ser regerada.

### openapi-spec/TD-05

**Recommendation:** dá a garantia essencial (mudança incompatível de contrato falha no `tsc` do frontend) com a menor superfície de dependência e sem antecipar a decisão de data fetching do frontend, que deve ser tomada quando as telas entrarem em escopo; a Option C carrega essa decisão junto e a Option B cobra custo de código gerado e instabilidade de `0.x` por uma DX marginalmente melhor. A adoção pode ficar **diferida** até as telas existirem — o que este TD fixa agora é a estratégia, para que a TD-04 gere o artefato no formato certo.
**Libraries:** openapi-typescript, openapi-fetch

### openapi-spec/TD-06

**Recommendation:** é a única que descreve fielmente o contrato já decidido em `auth/TD-03` sem alterar a implementação de autenticação; a Option B compra conveniência de teste ao preço de reabrir uma decisão de segurança fechada, o que não se justifica.
**Renders in:** ui-contracts
**Libraries:** @nestjs/swagger

### openapi-spec/TD-07

**Recommendation:** é o único caminho que mantém a spec fiel por endpoint sem o custo de repetição da Option A nem a imprecisão da Option C; com poucos endpoints hoje, criar os três decoradores agora é barato e evita que a convenção se degrade quando vídeos e comentários multiplicarem os controllers.
**Renders in:** ui-contracts
**Libraries:** @nestjs/swagger

### auth/TD-01

**Recommendation:** o PostgreSQL já está na stack e viabiliza revogação/refresh via tabela (TD-04) sem introduzir Redis, que não está previsto na arquitetura desta fase. Alinha com o suporte de primeira classe do NestJS.
**Libraries:** @nestjs/jwt

### auth/TD-02

**Recommendation:** é o padrão oficial do NestJS 11, cobre `local` + `jwt` com guards declarativos e deixa a porta aberta para OAuth sem retrabalho. A Option B é defensável se o objetivo for minimizar dependências.
**Libraries:** @nestjs/passport, passport-jwt, passport-local, @nestjs/jwt

### auth/TD-03

**Recommendation:** cookie `httpOnly` para o **refresh token** e, idealmente, também para o access token — reduz a superfície de XSS, que é relevante numa plataforma com conteúdo gerado por usuário (comentários). Acompanha proteção CSRF via `SameSite`.
**Libraries:** cookie-parser

### auth/TD-04

**Recommendation:** refresh com rotação no PostgreSQL entrega logout real e revogação sem adicionar Redis, aproveitando o banco já previsto; é o padrão recomendado pela RFC 9700 para refresh tokens.
**Libraries:** @nestjs/jwt, typeorm
**Revisions:**
- 2026-06-27 — Refresh token passa de string opaca a JWT assinado, mantendo o rastreio no PostgreSQL pelo `jti` (família, rotação e detecção de reuso preservadas, RFC 9700). Rationale: a persistência continua obrigatória; muda apenas o formato do valor (opaco → JWT) e o que se persiste (o `jti`, não o hash do valor).

### auth/TD-05

**Recommendation:** argon2id é a recomendação atual do OWASP para senhas em aplicações novas e o projeto é greenfield; o único cuidado é garantir a compilação do binding nativo na imagem Docker. bcrypt permanece uma escolha segura e mais simples se quiser evitar dependência nativa.
**Libraries:** argon2

### auth/TD-06

**Recommendation:** token opaco hasheado no banco — confirmação e reset exigem **uso único e revogação** (após redefinir a senha, links pendentes devem morrer), o que o JWT stateless não garante sozinho. O PostgreSQL já está disponível para isso.
**Libraries:** @nestjs/jwt
**Revisions:**
- 2026-06-27 — Decisão dividida por fluxo: confirmação de conta migra para JWT assinado stateless (sem tabela); o reset de senha mantém a Option A original. Rationale: o reuso da confirmação já é neutralizado pela flag `is_confirmed` (replay → `EMAIL_JA_CONFIRMADO`), enquanto o reset exige uso único e revogação reais. Consequência aceita: ao reenviar a confirmação, JWTs anteriores seguem válidos até expirar.

### auth/TD-07

**Recommendation:** `@nestjs-modules/mailer` + Mailpit no dev respeita o transporte SMTP já definido na arquitetura, é idiomático no NestJS e permite desenvolver/testar todo o fluxo de e-mail localmente sem enviar mensagens reais.
**Libraries:** @nestjs-modules/mailer, nodemailer, handlebars

### auth/TD-08

**Recommendation:** `@nestjs/throttler` é barato adicionar junto com os endpoints de auth e protege diretamente os fluxos sensíveis desta fase. O limite em memória é aceitável agora; trocar por store compartilhado é um ajuste futuro.
**Libraries:** @nestjs/throttler

### auth/TD-09

**Recommendation:** backend-only mantém o escopo coeso e respeita o adiamento do Next.js da Fase 01.
**Libraries:** —
**Revisions:**
- 2026-07-17 — Links de e-mail passam a apontar para paths de página dedicados (`/confirm-account`, `/reset-password`), distintos dos paths da API. Rationale: a implementação inicial apontava para rotas que só aceitam POST com o token no body — um link de e-mail sempre abre via GET no navegador, então o clique nunca alcançaria a rota.
- 2026-07-18 — Confirmação de conta convertida para `GET /auth/confirm?token=…`, com o link do e-mail voltando a apontar direto para a API; o reset de senha permanece apontando para a página `/reset-password`. Rationale: a confirmação não exige nenhum dado do usuário além do token, dispensando tela intermediária; o reset exige formulário para a nova senha.

### auth/TD-10

**Recommendation:** sufixo numérico incremental é determinístico e previsível. _(O usuário decidiu pela Option B — sufixo aleatório curto — para evitar enumeração sequencial.)_
**Libraries:** —

### auth/TD-11

**Recommendation:** mínimo 8, sem complexidade obrigatória — alinhada à recomendação atual do OWASP.
**Libraries:** class-validator

### auth/TD-12

**Recommendation:** access 15min / refresh 7d / confirm 24h / reset 1h — equilíbrio padrão.
**Libraries:** —

### auth/TD-13

**Recommendation:** global 100/min; login 5/min; reset 3/h; reenvio 3/h — protege os fluxos sensíveis com folga para uso legítimo.
**Libraries:** @nestjs/throttler

### auth/TD-14

**Recommendation:** apenas a sessão/família atual — comportamento padrão esperado.
**Libraries:** —

### auth/TD-15

**Recommendation:** apenas `SameSite=Strict` — suficiente nesta fase; token anti-CSRF pode entrar num hardening futuro.
**Libraries:** —

### auth/TD-16

**Recommendation:** best-effort — o reenvio de confirmação (já previsto) cobre a falha sem acoplar o cadastro ao SMTP.
**Libraries:** —

### auth/TD-17

**Recommendation:** revogar todas as sessões — encerrar tudo é a postura segura e alinha com o uso único dos tokens (TD-06).
**Libraries:** —

### auth/TD-18

**Recommendation:** `UsersService` como dono — a Option B só se sustenta enquanto o auth for o único consumidor de `User`, o que deixa de valer já na fase de canal/vídeos.
**Libraries:** typeorm

### auth/TD-19

**Recommendation:** padrão híbrido preserva o contrato obrigatório do TypeORM dentro da transação sem tornar todo chamador refém de abrir uma.
**Libraries:** typeorm
**Revisions:**
- 2026-07-17 — Decisões formalizadas a partir do ajuste de fronteiras de domínio (antes registradas inline como `DT-A`/`DT-B`). Rationale: mantinham um terceiro namespace de IDs fora de `docs/decisions/`, invisível para o pipeline; promovidas a TD-18/TD-19 na migração de formato.

## Inherited Conventions

- Configuração acessada exclusivamente via namespaces tipados (`registerAs` + `ConfigType`) — sem magic strings e sem `process.env` no código da aplicação _(from phase 02)_
- Entrypoints fora do container DI (CLI TypeORM, seeds) reusam a função pura `buildDatabaseOptions` em vez de remontar opções de conexão _(from phase 02)_
- Validação de ambiente com Joi no boot: variável obrigatória ausente derruba a aplicação _(from phase 02)_
- Hosts de serviço sempre pelo nome do serviço Compose (`db`, `mailpit`), nunca `localhost` _(from phase 02)_
- `synchronize: false` no TypeORM — mudanças de schema só via migrations versionadas _(from phase 02)_
- Prosa em português, identificadores e rótulos estruturais em inglês _(from phase 02)_

## Inherited Deferred Capabilities

| Capability | Status | Origin phase | Rationale |
|-----------|--------|--------------|-----------|
| Telas de cadastro, login, confirmação de conta e recuperação de senha | deferred | phase-02-auth | Fase entregue backend-only; o Next.js não estava inicializado no planejamento |

## UI Inventory

_Frontend-runtime only — no screen inventory needed for this phase.
Run /screen-inventory <arg> if a UI surface is added in a future revision._

## Non-UI / Deferred Capabilities

_None._

## Testing Requirements

### next-frontend

| Artifact type | Required layers |
|---------------|-----------------|
| Page — sync RSC, no interaction | None at component level; cover only if part of a critical flow → `*.e2e-spec.ts` |
| Page — sync RSC composing client children | Test the client children directly; cover the rendered page via `*.e2e-spec.ts` |
| Page — async RSC (`async function Page()` with `await fetch`) | `*.e2e-spec.ts` only — Vitest cannot render it |
| Layout (`layout.tsx`) | None unless it adds logic (auth gate, conditional rendering); else covered via E2E |
| Client component (`"use client"`) with state/handlers | `*.test.ts` — render with RTL, mock `next/navigation` and `fetch` |
| Feature component (server, composes primitives, presentational) | Skip unit; cover via the page's E2E |
| shadcn UI primitive (`components/ui/*`) | None — trust the library; cover via consumers |
| Icon (`components/icons/*`) | None |
| `lib/` utility with branching | `*.test.ts` |
| Custom hook (`hooks/*`) | `*.test.ts` with `renderHook` from `@testing-library/react` |
| Route handler (`app/api/**/route.ts`) with branching | `*.test.ts` (pure logic) and/or `*.integration.test.ts` with MSW |
| Route handler (simple proxy to NestJS) | `*.integration.test.ts` with MSW only |
| Server action | `*.integration.test.ts` with MSW; E2E for the submit flow |
| Middleware / error / loading / not-found / metadata | See guide — depends on type |

### nestjs-project

_Not in scope for this task — no artifact in `nestjs-project/` is created or modified._
