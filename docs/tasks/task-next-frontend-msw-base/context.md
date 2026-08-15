---
kind: task
name: task-next-frontend-msw-base
sources_mtime:
  docs/decisions/technical-decisions-next-frontend-msw-base.md: "2026-08-15 16:08:55.132346818 -0300"
  docs/tasks/task-next-frontend-msw-base/library-refs.md: "2026-08-15 16:10:49.680347168 -0300"
  docs/decisions/technical-decisions-next-frontend-api-typing.md: "2026-08-15 13:15:37.640315088 -0300"
  docs/decisions/technical-decisions-next-frontend-env-config.md: "2026-08-10 07:30:53.728007501 -0300"
  docs/phases/phase-02-auth/context.md: "2026-08-08 17:56:25.348038238 -0300"
  .claude/skills/testing-guide-next-frontend/SKILL.md: "2026-08-14 09:19:58.600008267 -0300"
---

# task-next-frontend-msw-base — Context

## Scope

> Base de testes do next-frontend com Vitest + MSW: separação de ambientes de execução por lane, biblioteca de DOM, tipagem dos handlers a partir do contrato OpenAPI e superfície de fake das rotas relativas do BFF. Inclui a materialização do contrato de teste diferido de lib/env.ts (seis casos devidos pela next-frontend-env-config), que passa a ser o primeiro teste da lane de node. Não inclui o bootstrap do Playwright nem a criação do primeiro route handler do BFF.

## Decisions Index

| Ref | Source | Scope | Topic | Status | Decision | Libraries | Renders in |
|-----|--------|-------|-------|--------|----------|-----------|------------|
| next-frontend-msw-base/TD-01 | ad-hoc | Frontend | Separação dos ambientes de execução do Vitest (`node` vs DOM) | decided | A | vitest | frontend-runtime |
| next-frontend-msw-base/TD-02 | ad-hoc | Frontend | Biblioteca de DOM da lane de browser — `jsdom` ou `happy-dom` | decided | A | jsdom | frontend-runtime |
| next-frontend-msw-base/TD-03 | ad-hoc | Cross-layer | Tipagem dos handlers MSW a partir do contrato OpenAPI (codegen) | decided | A | openapi-msw, msw | frontend-runtime |
| next-frontend-msw-base/TD-04 | ad-hoc | Frontend | Superfície de fake da lane de browser — rotas relativas do BFF | decided | B | — | frontend-runtime |

_Source files:_

- next-frontend-msw-base — `docs/decisions/technical-decisions-next-frontend-msw-base.md` (scope_type: ad-hoc, related_phases: [])

## Decisions Detail

### next-frontend-msw-base/TD-01

**Recommendation:** é o único caminho que dá `setupFiles` por lane, o que a TD-04 precisa para não misturar as duas superfícies de fake, e é o mecanismo que a documentação do Vitest 4 indica depois de remover `environmentMatchGlobs`. O custo é verbosidade num arquivo que se escreve uma vez; o custo das outras duas é uma classe de erro recorrente cuja mensagem não aponta para a causa.
**Renders in:** frontend-runtime
**Libraries:** vitest

### next-frontend-msw-base/TD-02

**Recommendation:** a diferença de velocidade só se paga com uma suíte grande, que este projeto não tem e não terá tão cedo, enquanto a diferença de cobertura cobra logo no primeiro teste de componente que abrir um overlay do Radix. Escolher `jsdom` também elimina a divergência com a documentação do Next.js. Se a decisão for esta, a skill `testing-guide-next-frontend` precisa ter o template de `vitest.config.ts` corrigido no mesmo commit — hoje ela diz `happy-dom`.
**Renders in:** frontend-runtime
**Libraries:** jsdom

### next-frontend-msw-base/TD-03

**Recommendation:** é a única que fecha o buraco que a `next-frontend-api-typing/TD-03` conscientemente deixou aberto, e ela o fecha no lugar mais barato (build do teste, não runtime de produção). Vale um efeito colateral concreto: com a verificação de status, o fixture de `POST /auth/login` vai acusar de imediato a imprecisão já confirmada na spec do backend, que declara `RegisterResponseDto` como resposta 200 do login. Se adotada, decidir junto como `mocks/` acessa `paths` — reexportar o tipo por `lib/api/contracts.ts` mantém a regra de importação vigente sem carve-out; abrir exceção para `mocks/` é a alternativa mais direta e mais frouxa. Verificar a compatibilidade da versão de `openapi-msw` com `msw` 2.x e `openapi-typescript` 7.13.0 no momento da instalação.
**Renders in:** frontend-runtime
**Libraries:** openapi-msw, msw

### next-frontend-msw-base/TD-04

**Recommendation:** preserva o padrão de default + override que o projeto já adotou e evita o efeito mais nocivo da Option A, que é embaralhar duas fronteiras com garantias de tipagem diferentes logo no arquivo onde a TD-03 quer precisão. Com uma única rota de BFF hoje, B e C custam quase o mesmo; a diferença aparece na terceira rota, e B é a que não precisa ser refeita lá. Se a TD-01 não for decidida como Option A, esta TD deve cair para a Option C, não para a A — sem `setupFiles` por lane, a composição da Option B não tem onde acontecer.
**Renders in:** frontend-runtime
**Libraries:** —

## Inherited Decisions Detail

### next-frontend-api-typing/TD-01

**Recommendation:** Option A — é a única que entrega a garantia de type-check **sem** tocar no isolamento do Compose, que a restrição de `build.context` torna caro nas outras duas; o custo real (tipos defasados) é exatamente o que o check de drift no CI elimina, e o diff visível do `.d.ts` no PR é um efeito colateral desejável quando o backend muda um DTO. A Option C é a resposta certa para o dia em que houver um segundo consumidor da spec, não hoje.
**Libraries:** openapi-typescript

### next-frontend-api-typing/TD-02

**Recommendation:** Option B — dado que o `openapi.json` e os DTOs já são a fonte de verdade upstream, derivar por utility types entrega a honestidade da Option C com o custo da Option A, e é a única que mantém o vínculo de build sem inventar infraestrutura; a Option D é sedutora mas paga engenharia de tipos própria para resolver a metade fácil do problema, e a Option A já nasce errada no primeiro endpoint do projeto que é `auth`.
**Renders in:** frontend-runtime
**Libraries:** —

### next-frontend-api-typing/TD-03

**Recommendation:** Option A por ora — o risco que as Options B e C endereçam é o de spec defasada, e esse risco tem uma correção mais barata e mais a montante (o check de drift do TD-01, mais a conferência da resposta de `/auth/login` no backend); introduzir schemas Zod à mão agora recria a segunda fonte de verdade que a `openapi-spec/TD-05` foi escolhida para eliminar. Reavaliar quando existir codegen de schemas Zod **a partir da spec** — aí a Option C passa a custar quase nada e a recomendação muda.
**Renders in:** frontend-runtime
**Libraries:** —

### next-frontend-env-config/TD-01

**Recommendation:** Option C — a diferença material entre B e C não é tipagem (as duas entregam), é **onde mora o enforcement da fronteira**: em B ele depende de o autor lembrar do `import "server-only"` a cada arquivo novo; em C ele é estrutural, e a exigência de destructuração literal em `experimental__runtimeEnv` neutraliza de graça o modo de falha mais caro do Next (uma `NEXT_PUBLIC_*` que silenciosamente vira `undefined` no bundle). Com 2 variáveis hoje o custo parece desproporcional, mas as fases 03–07 acrescentam base URL de storage, chaves de player e provavelmente analytics — todas atravessando essa fronteira. Option B é a escolha defensável se a preferência for não adicionar dependência: entrega o mesmo resultado com mais disciplina exigida. Option A está descartada — reabre por omissão a decisão que `config/TD-01` fechou.
**Renders in:** frontend-runtime
**Libraries:** @t3-oss/env-nextjs

### next-frontend-env-config/TD-02

**Recommendation:** Option A (Zod v4) — a decisão real não é "o que valida 2 variáveis melhor" (as quatro validam), é qual biblioteca o front vai carregar quando as telas de formulário chegarem, e aí Zod é a que tem integração pronta com React Hook Form e com o `openapi-fetch` de `openapi-spec/TD-05`, evitando uma segunda lib depois. Option B é a escolha certa se o peso do bundle do cliente for tratado como restrição dura — o ganho é real, o custo é ecossistema menor. Option D é simetria aparente que não se sustenta tecnicamente: Joi não gera tipos nem compõe com a TD-01 Option C.
**Libraries:** zod

### next-frontend-env-config/TD-03

**Recommendation:** Option C — preserva o que a Revision de `config/TD-02` de fato exige (fronteiras de domínio visíveis no ponto de consumo) sem pagar por três arquivos para duas variáveis, e mantém a validação atômica que a TD-01 Option C torna desejável. Option B é a resposta certa se a simetria estrutural literal com `src/config/` for o objetivo declarado — é defensável, custa organização antecipada. Option A é suficiente e honesta se a expectativa for que o front nunca passe de ~5 variáveis.
**Libraries:** —

### next-frontend-env-config/TD-04

**Recommendation:** Option C para o tráfego de API, com a ressalva explícita de que ela **não** cobre streaming e download de vídeo (Fases 03 e 05), que continuarão exigindo URL pública e devem ser decididos quando o object storage entrar em escopo. A justificativa é que o projeto já escolheu o BFF como a superfície testável do front (`CLAUDE.md` § Testing fixou route handlers + MSW como o lane de integração) e já escolheu cookie `httpOnly` + `SameSite=Strict` (`auth/TD-03`, `auth/TD-15`) — manter browser e API na mesma origem é o que faz esse cookie funcionar sem exceção. Option A é a escolha pragmática se a intenção for aceitar imagens por ambiente; Option B é a mais correta conceitualmente para uma imagem promovível, mas cobra prerender estático justamente na home da Fase 07, que é onde o estático mais vale.
**Libraries:** —

### next-frontend-env-config/TD-05

**Recommendation:** Option A, com um `.env.test` versionado no repositório apontando para hosts fictícios (`http://nestjs-api.test:3000`) — reusa a mesma precedência do runtime do Next, mantém uma fonte de verdade só para as chaves, e o host fictício garante que qualquer request não interceptado pelo MSW falhe de forma óbvia em vez de vazar para o serviço real. Option B é a escolha certa se determinismo absoluto do suite valer mais que a duplicação das chaves. Option C deve ser descartada por incompatibilidade de ordem de execução com a validação-no-import da TD-01, não por preferência.
**Libraries:** @next/env

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
- 2026-07-17 — Links de e-mail passam a apontar para paths de página dedicados (`/confirm-account`, `/reset-password`), distintos dos paths da API. Rationale: a implementação inicial apontava para `/auth/confirm` e `/auth/reset-password`, que só aceitam POST com o token no body — um link de e-mail sempre abre via GET no navegador, então o clique nunca alcançaria a rota. A página lê o `token` da query string e então chama o POST real da API.
- 2026-07-18 — Confirmação de conta convertida para `GET /auth/confirm?token=…`, com o link do e-mail voltando a apontar direto para a API; o reset de senha permanece apontando para a página `/reset-password`. Rationale: a confirmação não exige nenhum dado do usuário além do token, dispensando tela intermediária; o reset exige formulário para a nova senha. Trade-off aceito: `GET` é pré-buscável por scanners/proxies de e-mail, podendo disparar a confirmação automaticamente — risco baixo dado o token assinado e expirável (24h).

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
- 2026-07-17 — Decisões formalizadas a partir do ajuste de fronteiras de domínio (antes registradas inline como `DT-A`/`DT-B` em `docs/phases/phase-02-auth-refactor.md`). Rationale: mantinham um terceiro namespace de IDs fora de `docs/decisions/`, invisível para o pipeline; promovidas a TD-18/TD-19 na migração de formato.

## Inherited Conventions

- Configuração acessada exclusivamente via namespaces tipados (`registerAs` + `ConfigType`) — sem magic strings e sem `process.env` no código da aplicação _(from phase 01)_
- Entrypoints fora do container DI (CLI TypeORM, seeds) reusam a função pura `buildDatabaseOptions` em vez de remontar opções de conexão _(from phase 01)_
- Validação de ambiente com Joi no boot: variável obrigatória ausente derruba a aplicação _(from phase 01)_
- Hosts de serviço sempre pelo nome do serviço Compose (`db`, `mailpit`), nunca `localhost` _(from phase 01)_
- `synchronize: false` no TypeORM — mudanças de schema só via migrations versionadas _(from phase 01)_
- Prosa em português, identificadores e rótulos estruturais em inglês _(from phase 01)_

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
| Middleware / error / loading / not-found / metadata | See `artifacts/future-types.md` — depends on type |
