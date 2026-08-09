---
kind: phase
name: phase-02-auth
sources_mtime:
  docs/project-plan.md: "2026-05-30T14:30:22Z"
  docs/decisions/technical-decisions-auth.md: "2026-08-08T20:43:00Z"
  docs/phases/phase-01-config/context.md: "2026-08-08T20:55:11Z"
  .claude/skills/testing-guide-nestjs-project/SKILL.md: "2026-08-08T20:01:09Z"
---

# phase-02-auth — Context

## Scope

**Phase name:** Cadastro, Login e Gerenciamento de Conta

**Capabilities** (literal, `docs/project-plan.md`):

- Serviço de envio de e-mails transacionais
- Cadastro de usuário com e-mail e senha
- Criação automática do canal do usuário a partir do prefixo do e-mail
- Confirmação de conta via e-mail com link de ativação
- Login e controle de sessão do usuário
- Logout
- Recuperação de senha: solicitação via e-mail → link com token → redefinição
- Telas de cadastro, login, confirmação de conta e recuperação de senha

**Out of scope:** não declarado em `docs/project-plan.md` para esta fase.

**Deliverables:** fluxo completo de cadastro → confirmação → login → recuperação de senha funcionando. Canal criado automaticamente para cada usuário.

**Affected subprojects:** `nestjs-project/`

**Deferred subprojects:** `next-frontend/` — a capability "Telas de cadastro, login, confirmação de conta e recuperação de senha" foi adiada por `auth/TD-09` (backend-only); o Next.js não estava inicializado quando a fase foi planejada.

**Sequencing notes:** depende da Fase 01 (config namespaced tipada e fundação TypeORM). Primeira fase a expor endpoints HTTP no `nestjs-project` — define o formato de resposta de erro herdado pelas fases seguintes.

**Neighbors (for boundary detection only):**

- **Phase 01:** Configuração Base do Projeto — fornece config namespaced (`registerAs`/`ConfigType`), validação Joi e a fundação de TypeORM/migrations que esta fase estende.
- **Phase 03:** Upload e Processamento de Vídeos — depende das Fases 01 e 02; consome a sessão autenticada estabelecida aqui.

## Decisions Index

| Ref | Source | Scope | Topic | Status | Decision | Libraries |
|-----|--------|-------|-------|--------|----------|-----------|
| auth/TD-01 | phase | Backend | Estratégia de autenticação (stateless vs stateful) | decided | A | @nestjs/jwt |
| auth/TD-02 | phase | Backend | Biblioteca / abordagem de implementação | decided | A | @nestjs/passport, passport-jwt, passport-local, @nestjs/jwt |
| auth/TD-03 | phase | Cross-layer | Armazenamento do token no cliente | decided | A | cookie-parser |
| auth/TD-04 | phase | Backend | Controle de sessão, refresh e logout | decided | A | @nestjs/jwt, typeorm |
|     └─ Last revision: 2026-06-27 — Refresh token passa de string opaca a JWT assinado, mantendo… | | | | | | |
| auth/TD-05 | phase | Backend | Algoritmo de hashing de senha | decided | B | argon2 |
| auth/TD-06 | phase | Cross-layer | Tokens de confirmação de conta e de redefinição de senha | decided | A | @nestjs/jwt |
|     └─ Last revision: 2026-06-27 — Decisão dividida por fluxo: confirmação de conta migra para… | | | | | | |
| auth/TD-07 | phase | Backend | Serviço de envio de e-mails transacionais | decided | A | @nestjs-modules/mailer, nodemailer, handlebars |
| auth/TD-08 | phase | Backend | Proteção contra força bruta nos endpoints de auth | decided | A | @nestjs/throttler |
| auth/TD-09 | phase | Cross-layer | Escopo de frontend da fase | decided | A | — |
|     └─ Last revision: 2026-07-18 — Confirmação de conta convertida para `GET /auth/confirm?token=…`… | | | | | | |
| auth/TD-10 | phase | Backend | Política de colisão de nickname do canal | decided | B | — |
| auth/TD-11 | phase | Backend | Política de senha | decided | A | class-validator |
| auth/TD-12 | phase | Backend | TTLs (expirações) dos tokens | decided | A | — |
| auth/TD-13 | phase | Backend | Valores de rate limit (`@nestjs/throttler`) | decided | A | @nestjs/throttler |
| auth/TD-14 | phase | Backend | Escopo do logout | decided | A | — |
| auth/TD-15 | phase | Backend | Proteção CSRF dos cookies | decided | A | — |
| auth/TD-16 | phase | Backend | Tratamento de falha no envio de e-mail durante o cadastro | decided | A | — |
| auth/TD-17 | phase | Backend | Revogação de sessões na redefinição de senha | decided | A | — |
| auth/TD-18 | phase | Backend | Dono da persistência de `User` | decided | A | typeorm |
| auth/TD-19 | phase | Backend | Padrão de participação em transação dos serviços de domínio | decided | A | typeorm |
|     └─ Last revision: 2026-07-17 — Decisões formalizadas a partir do ajuste de fronteiras de domínio… | | | | | | |

_Source files:_

- auth — `docs/decisions/technical-decisions-auth.md` (scope_type: phase, related_phases: [2])

## Capability Coverage

| Capability (from project-plan.md) | Covered by |
|-----------------------------------|------------|
| Serviço de envio de e-mails transacionais | auth/TD-07 |
| Cadastro de usuário com e-mail e senha | auth/TD-05, auth/TD-11, auth/TD-16, auth/TD-18 |
| Criação automática do canal do usuário a partir do prefixo do e-mail | auth/TD-10, auth/TD-19 |
| Confirmação de conta via e-mail com link de ativação | auth/TD-06, auth/TD-12 |
| Login e controle de sessão do usuário | auth/TD-01, auth/TD-02, auth/TD-03, auth/TD-04, auth/TD-08, auth/TD-12, auth/TD-13, auth/TD-15 |
| Logout | auth/TD-04, auth/TD-14 |
| Recuperação de senha: solicitação via e-mail → link com token → redefinição | auth/TD-06, auth/TD-08, auth/TD-12, auth/TD-13, auth/TD-17 |
| Telas de cadastro, login, confirmação de conta e recuperação de senha | auth/TD-09 |

## Decisions Detail

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

## Inherited Decisions Detail

### config/TD-01

**Recommendation:** `registerAs` + `ConfigType` é o padrão oficial do NestJS 11, dá tipagem forte sem manutenção manual de getters e já resolve a organização por domínio (TD-02).
**Libraries:** @nestjs/config

### config/TD-02

**Recommendation:** agrupar por domínio (`app` com `PORT`/`NODE_ENV`, `database`, `mail`) prepara o terreno para as próximas fases sem refatorar depois; é o complemento natural da TD-01 B.
**Libraries:** @nestjs/config

### config/TD-03

**Recommendation:** já está instalado, validando o boot e cobrindo defaults/coerção; trocar agora adiciona dependência e retrabalho sem ganho proporcional. A tipagem forte vem da TD-01 (B), não da lib de validação.
**Libraries:** joi

### config/TD-04

**Recommendation:** uma função pura compartilhada elimina a duplicação atual de `DB_*` entre `database.module.ts`, `data-source.ts` e `seed.ts`, mantendo CLI e app sempre alinhados.
**Libraries:** typeorm

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
| "Projeto Next.js (frontend) (será criado depois, não agora)" | deferred | phase-01-config | A própria capability declara o adiamento; o Next.js não é inicializado na Fase 01 |

## UI Inventory

_No screen inventory — UI↔API sync deferred. Run /screen-inventory 2 and then rerun /plan-context 2 to activate UI checks._

## Non-UI / Deferred Capabilities

| Capability | Status | Rationale | TD refs |
|-----------|--------|-----------|---------|
| Telas de cadastro, login, confirmação de conta e recuperação de senha | deferred | Fase entregue backend-only; o Next.js não estava inicializado no planejamento | auth/TD-09 |

## Testing Requirements

### nestjs-project

| Artifact type | Required layers |
|---------------|-----------------|
| Entities (`*.entity.ts`) | Integration (real DB) |
| Services (`*.service.ts`) | Unit and/or Integration |
| Modules (`*.module.ts`) | Unit (compilation) |
| Controllers (`*.controller.ts`) | E2E only |
| DTOs (`*.dto.ts`) | E2E (validation wiring) |
| Guards (`*.guard.ts`) | E2E or Unit+E2E |
| Strategies (`*.strategy.ts`) | E2E (via guard) |
| Pipes (`*.pipe.ts`) | Unit |
| Interceptors (`*.interceptor.ts`) | Unit and/or E2E |
| Filters (`*.filter.ts`) | Unit + E2E |
| Middleware (`*.middleware.ts`) | E2E |

### next-frontend

_Deferred subproject — sem escopo nesta fase por `auth/TD-09`. A skill `testing-guide-next-frontend` já existe e será consumida pela fase que trouxer as telas para o escopo._
