---
kind: task
name: task-openapi-spec
sources_mtime:
  docs/decisions/technical-decisions-openapi-spec.md: "2026-08-08T21:32:44Z"
  docs/decisions/technical-decisions-auth.md: "2026-08-08T20:43:00Z"
  docs/phases/phase-02-auth/context.md: "2026-08-08T20:56:25Z"
  .claude/skills/testing-guide-nestjs-project/SKILL.md: "2026-08-08T20:01:09Z"
---

# task-openapi-spec — Context

## Scope

> Documentação OpenAPI da API NestJS: geração da spec, metadados dos DTOs, exposição do Swagger UI, emissão do artefato openapi.json e consumo pelo frontend

## Decisions Index

| Ref | Source | Scope | Topic | Status | Decision | Libraries | Renders in |
|-----|--------|-------|-------|--------|----------|-----------|------------|
| openapi-spec/TD-01 | ad-hoc | Cross-layer | Origem da verdade do contrato — code-first vs spec-first | decided | A | @nestjs/swagger | ui-contracts |
| openapi-spec/TD-02 | ad-hoc | Backend | Fonte dos metadados dos DTOs — CLI plugin vs decorators | decided | C | @nestjs/swagger | — |
| openapi-spec/TD-03 | ad-hoc | Backend | Exposição do Swagger UI e política por ambiente | decided | B | @nestjs/swagger, @nestjs/config | — |
| openapi-spec/TD-04 | ad-hoc | Cross-layer | Emissão do `openapi.json` como artefato | decided | B | @nestjs/swagger | ui-contracts |
|     └─ Last revision: 2026-08-08 — Geração do `openapi.json` é **sob demanda**, não acopl… | | | | | | | |
| openapi-spec/TD-05 | ad-hoc | Cross-layer | Consumo da spec pelo frontend — codegen de tipos e client | decided | A | openapi-typescript, openapi-fetch | — |
| openapi-spec/TD-06 | ad-hoc | Cross-layer | Esquema de segurança na spec e ergonomia do "Try it out" | decided | A | @nestjs/swagger | ui-contracts |
| openapi-spec/TD-07 | ad-hoc | Cross-layer | Documentação das respostas de erro na spec | decided | B | @nestjs/swagger | ui-contracts |

_Source files:_

- openapi-spec — `docs/decisions/technical-decisions-openapi-spec.md` (scope_type: ad-hoc, related_phases: [])

## Decisions Detail

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
- 2026-08-08 — Geração do `openapi.json` é **sob demanda**, não acoplada ao build: `openapi:generate` é um script standalone invocado manualmente (dentro do container, ex.: `docker compose run --rm nestjs-api npm run openapi:generate`), nunca um hook de `postbuild` nem etapa obrigatória do pipeline. Rationale: o bootstrap do `AppModule` inicializa `TypeOrmModule` e valida todo o schema Joi, exigindo Postgres, Mailpit e todas as variáveis obrigatórias no ar — e o host `db` só resolve dentro da rede do Compose (convenção herdada da fase 02). Como o contrato muda com pouca frequência, rodar sob demanda paga esse custo apenas quando a spec realmente precisa ser regerada, em vez de tornar todo `nest build` dependente da infraestrutura.

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

## Inherited Decisions Detail

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

| Capability | Status | Rationale | TD refs |
|-----------|--------|-----------|---------|
| Consumo da spec pelo frontend via codegen (`openapi-typescript` + `openapi-fetch`) | deferred | A estratégia está fixada, mas a adoção no `next-frontend/` fica para quando as telas entrarem em escopo — esta task é backend-only (documentação da API + geração do JSON) | openapi-spec/TD-05 |

## Testing Requirements

### nestjs-project

| Artifact type | Required layers |
|---|---|
| Entity (`*.entity.ts`) | Integration: constraints, defaults, `select: false` |
| Service with branching + DB | Unit: branch logic (mock repo) + Integration: DB contract |
| Service with DB only (no branching) | Integration: DB contract |
| Service with configured lib (JWT, cache) | Unit: real lib com test config |
| Service with side-effect dep (email, storage) | Integration: real capture service (Mailpit) ou adapter local |
| Module with configured imports | Unit: compilation test |
| Controller | E2E only — não escrever unit tests |
| DTO | E2E: um teste de wiring de validação por endpoint |
| Guard (delegates to service for business logic) | E2E + Unit se houver lógica interna complexa |
| Guard (simple, delegates to Passport) | E2E only |
| Strategy (Passport) | E2E via guard |
| Pipe (custom transformation/validation) | Unit |
| Interceptor (response transform, logging) | Unit e/ou E2E |
| Exception Filter | Unit + E2E |
| Middleware | E2E |

### next-frontend

_Fora do escopo desta task: o usuário confirmou que a task é apenas documentação da API + geração do JSON, sem telas nem frontend. O TD-05 (codegen) fixa estratégia, não implementação._
