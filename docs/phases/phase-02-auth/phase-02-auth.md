---
kind: phase
name: phase-02-auth
affected_subprojects: [nestjs-project]
sources_mtime:
  docs/decisions/technical-decisions-auth.md: "2026-08-08T20:43:00Z"
---

# Fase 02 — Cadastro, Login e Gerenciamento de Conta

## Objective

Entregar a API de autenticação do StreamTube (`nestjs-project/`): cadastro com e-mail/senha, criação automática do canal, confirmação de conta por e-mail, login/refresh/logout com JWT em cookies `httpOnly` e refresh com rotação, e recuperação de senha — protegidos por rate limiting. As telas (frontend) ficam adiadas para uma fase futura, pois o Next.js ainda não foi inicializado (per `auth/TD-09`).

---

## Contexto do ajuste de fronteiras

> Escopo dos SI-02.17 a SI-02.19, planejados **após** a entrega dos SI-02.1 a SI-02.16.

A revisão da implementação entregue encontrou quatro desvios entre o desenho pretendido e o código. Nenhum deles é um bug de comportamento — a API responde corretamente — mas todos comprometem a fronteira dos módulos e o princípio de Responsabilidade Única declarado no `CLAUDE.md`.

| # | Achado | Evidência |
|---|--------|-----------|
| A-1 | `ChannelsModule` declara um repositório que nunca usa. `ChannelService` não injeta `@InjectRepository(Channel)`; todo acesso ao banco depende de um `EntityManager` fornecido pelo chamador. O módulo não tem caminho autônomo de leitura/escrita. | `channels.module.ts:13`, `channel.service.ts:29` |
| A-2 | `ChannelsModule` e `UsersModule` vazam seus repositórios via `exports: [TypeOrmModule]`. `AuthModule` importa ambos e poderia injetar `Repository<Channel>`/`Repository<User>`, contornando os serviços. | `channels.module.ts:15`, `users.module.ts:13` |
| A-3 | `UsersModule` é uma casca vazia — não existe `UsersService`. Toda a persistência de `User` (`exists`, `create`, `save`, `findOne`, `update`) vive no `AuthService` via `dataSource.manager`. O domínio de usuários não tem dono. | `auth.service.ts:66-88`, `:113-128`, `:265` |
| A-4 | `AuthService` lê dados de canal diretamente com `relations: { channel: true }` em vez de pedir ao `ChannelService`. | `auth.service.ts:136-140`, `:243-247` |

**O que não é problema:** a passagem de `EntityManager` para manter `User` + `Channel` atômicos é o padrão correto do TypeORM e permanece. A documentação do TypeORM é explícita: dentro de uma transação é **obrigatório** resolver o repositório a partir do manager da transação (`manager.getRepository(Channel)`) — o repositório global injetado não participa dela. O ajuste preserva esse contrato (formalizado em `auth/TD-19`).

**Restrição transversal:** este é um refactor sem mudança de comportamento. Contratos de API, códigos do Error Catalog, schema do banco e migrations permanecem exatamente como estão. As 8 suítes e2e existentes são a rede de segurança e devem passar **sem edição** — qualquer necessidade de alterá-las indica que o comportamento mudou e o refactor saiu do escopo.

---

## Step Implementations

### SI-02.1 — Fundação HTTP: validação, cookies e formato de erro

**Description:** Estabelecer os comportamentos transversais de toda requisição HTTP da API: validação de entrada, parsing de cookies e formato padronizado de resposta de erro. Primeira fase a expor endpoints HTTP no `nestjs-project`.

**Technical actions:**

- Instalar `class-validator@^0.14.0`, `class-transformer@^0.5.0` e `cookie-parser@^1.4.0` (+ `@types/cookie-parser`).
- Registrar `ValidationPipe` global em `main.ts` com `whitelist: true`, `forbidNonWhitelisted: true` e `transform: true`.
- Registrar o middleware `cookie-parser` em `main.ts` para leitura de cookies em strategies/handlers.
- Implementar um exception filter global que serializa erros no formato `{ statusCode, error, message }` — `error` carrega o código de domínio do Catálogo de Erros (ou um código genérico em falhas não mapeadas).

**Tests:**

| Artifact | Layer | Test file |
|----------|-------|-----------|
| `HttpExceptionFilter` | Unit: Filtro serializa exceções de domínio e genéricas no formato `{ statusCode, error, message }` | `src/common/filters/http-exception.filter.spec.ts` |
| Global `ValidationPipe` | E2E: Corpo inválido/com campos extras retorna 400 no formato de erro padrão | `test/validation.e2e-spec.ts` |

**Dependencies:** none

**Acceptance criteria:**

- Uma requisição com corpo contendo campo não declarado no DTO retorna 400 no formato `{ statusCode, error, message }`.
- Uma requisição a um endpoint inexistente retorna 404 no mesmo formato de erro.
- Cookies enviados pelo cliente ficam disponíveis para leitura nos handlers (parsing ativo).

---

### SI-02.2 — Configuração de autenticação e e-mail (namespaces tipados)

**Description:** Estender a configuração namespaced da Fase 01 com os parâmetros de JWT, tokens de e-mail, hashing, cookies e credenciais SMTP, mantendo acesso tipado via `ConfigType` e validação Joi no boot.

**Technical actions:**

- Criar `src/config/auth.config.ts` (`registerAs('auth', ...)`) com `JWT_SECRET`, `JWT_ACCESS_TTL` (default `15m`), `JWT_REFRESH_TTL` (default `7d`), `CONFIRM_TOKEN_TTL` (default `24h`), `RESET_TOKEN_TTL` (default `1h`), parâmetros argon2 e flags de cookie (`COOKIE_SECURE`, `COOKIE_SAMESITE=strict`).
- Estender `src/config/mail.config.ts` com `MAIL_USER`, `MAIL_PASS`, `MAIL_FROM` e `APP_BASE_URL` (origem usada para montar links de e-mail).
- Adicionar ao schema Joi (`env.validation.ts`) todas as novas variáveis, com defaults para os TTLs e `JWT_SECRET` obrigatório (boot falha se ausente).
- Registrar `authConfig` no `load: [...]` do `ConfigModule.forRoot` e documentar as novas variáveis em `.env.example` (`MAIL_HOST=mailpit`, `MAIL_PORT=1025`).

**Tests:**

| Artifact | Layer | Test file |
|----------|-------|-----------|
| `env.validation` (schema Joi) | Unit: Schema rejeita `JWT_SECRET` ausente e aplica defaults dos TTLs | `src/config/env.validation.spec.ts` |

**Dependencies:** none

**Acceptance criteria:**

- A aplicação falha ao iniciar se `JWT_SECRET` estiver ausente.
- TTLs ausentes assumem os defaults (`15m`, `7d`, `24h`, `1h`) e ficam acessíveis de forma tipada via `ConfigType<typeof authConfig>`.
- `.env.example` lista as variáveis de auth/mail com `MAIL_HOST=mailpit` (nome de serviço, nunca `localhost`).

---

### SI-02.3 — Entidades User e Channel + migration

**Description:** Modelar o usuário e seu canal (relação um-para-um) e gerar a migration correspondente, sem lógica de negócio.

**Technical actions:**

- Criar a entidade `User` (`src/users/entities/user.entity.ts`) com `id` (uuid), `email` (único, citext ou varchar normalizado em minúsculas), `passwordHash`, `isConfirmed` (default `false`) e timestamps.
- Criar a entidade `Channel` (`src/channels/entities/channel.entity.ts`) com `id` (uuid), `userId` (FK único — um-para-um), `nickname` (único), `name`, `description` (nullable) e timestamps.
- Definir a relação `User` 1—1 `Channel` (FK em `Channel.userId`, `onDelete: CASCADE`).
- Gerar a migration via TypeORM CLI (`npm run migration:generate`) criando ambas as tabelas com as restrições de unicidade.

**Tests:**

| Artifact | Layer | Test file |
|----------|-------|-----------|
| Migration `CreateUsersAndChannels` | Integration: Migration cria tabelas `users`/`channels` com unicidade de `email` e `nickname` e FK `channels.user_id` | `src/database/users-channels.migration.integration.spec.ts` |

**Dependencies:** none

**Acceptance criteria:**

- `npm run migration:run` cria as tabelas `users` e `channels` com colunas e restrições especificadas.
- Inserir dois usuários com o mesmo `email` falha com violação de unicidade.
- Inserir dois canais com o mesmo `nickname` falha com violação de unicidade.
- Remover um usuário remove em cascata seu canal.

---

### SI-02.4 — Entidades RefreshToken e PasswordResetToken + migration

**Description:** Modelar as tabelas de persistência de tokens: refresh tokens (JWT rastreados por `jti`, com família para rotação/detecção de reuso) e tokens de reset de senha (opacos e hasheados). A confirmação de conta é um JWT stateless e não tem tabela.

**Technical actions:**

- Criar a entidade `RefreshToken` (`src/auth/entities/refresh-token.entity.ts`) com `id` (uuid), `userId` (FK), `jti` (uuid — id do refresh JWT), `familyId` (uuid), `expiresAt`, `revokedAt` (nullable), `replacedById` (nullable) e `createdAt`. (O refresh é um JWT assinado; persiste-se o `jti`, nunca o token.)
- Criar a entidade `PasswordResetToken` (`src/auth/entities/password-reset-token.entity.ts`) com `id` (uuid), `userId` (FK), `tokenHash` (SHA-256 do token opaco), `expiresAt`, `usedAt` (nullable) e `createdAt`.
- Definir FKs para `User` com `onDelete: CASCADE` em ambas as entidades.
- Adicionar índices: `RefreshToken(jti)` único, `RefreshToken(familyId)`, `PasswordResetToken(tokenHash)`, `PasswordResetToken(userId)`.
- Gerar a migration via TypeORM CLI criando ambas as tabelas e índices.

**Tests:**

| Artifact | Layer | Test file |
|----------|-------|-----------|
| Migration `CreateAuthTokens` | Integration: Migration cria `refresh_tokens`/`password_reset_tokens` com FKs e índices (`jti` único, `token_hash`) | `src/database/auth-tokens.migration.integration.spec.ts` |

**Dependencies:** SI-02.3

**Acceptance criteria:**

- `npm run migration:run` cria as tabelas `refresh_tokens` e `password_reset_tokens` com as colunas e índices especificados.
- Inserir dois `RefreshToken` com o mesmo `jti` falha por violação de unicidade.
- Remover um usuário remove em cascata seus refresh tokens e password reset tokens.

---

### SI-02.5 — PasswordService (hashing argon2id)

**Description:** Encapsular o hashing e a verificação de senha com argon2id, fonte única para cadastro, login e redefinição.

**Technical actions:**

- Instalar `argon2@^0.41.0` (binding nativo — garantir toolchain de compilação na imagem Docker).
- Criar `PasswordService` (`src/auth/password.service.ts`) com `hash(plain)` usando `argon2.hash` com `type: argon2.argon2id` e parâmetros vindos do namespace `auth`.
- Implementar `verify(hash, plain)` com `argon2.verify` (comparação timing-safe), retornando booleano sem lançar em mismatch.

**Tests:**

| Artifact | Layer | Test file |
|----------|-------|-----------|
| `PasswordService` | Unit: `hash` produz digest argon2id; `verify` retorna `true` para senha correta e `false` para incorreta | `src/auth/password.service.spec.ts` |

**Dependencies:** SI-02.2

**Acceptance criteria:**

- `hash` de uma senha produz um digest no formato `$argon2id$...` diferente a cada chamada (salt aleatório).
- `verify` retorna `true` para a senha original e `false` para qualquer outra, sem lançar exceção em mismatch.

---

### SI-02.6 — PasswordResetTokenService (tokens opacos de reset)

**Description:** Gerar, persistir (hasheados), validar e consumir tokens opacos de uso único para a redefinição de senha (`auth/TD-06`). A confirmação de conta usa JWT (não passa por aqui).

**Technical actions:**

- Criar `PasswordResetTokenService` (`src/auth/password-reset-token.service.ts`) com `issue(userId)`: gera 32 bytes aleatórios (`crypto.randomBytes`), persiste apenas o hash (SHA-256) + `expiresAt` (TTL `reset` do namespace `auth`) e retorna o token em claro.
- Implementar `consume(rawToken)`: localiza por hash, rejeita se ausente/expirado/já usado, marca `usedAt` e retorna o `userId`.
- Implementar `invalidateAll(userId)`: invalida tokens de reset pendentes (usado ao reemitir e ao concluir a redefinição).

**Tests:**

| Artifact | Layer | Test file |
|----------|-------|-----------|
| `PasswordResetTokenService` | Unit: `issue` persiste hash (não o valor); `consume` aceita token válido uma vez e rejeita expirado/usado; `invalidateAll` derruba pendentes | `src/auth/password-reset-token.service.spec.ts` |

**Dependencies:** SI-02.4

**Acceptance criteria:**

- `issue` armazena apenas o hash do token (o valor em claro nunca é persistido) e retorna o valor em claro uma única vez.
- `consume` de um token válido retorna o `userId` e o marca como usado; uma segunda chamada com o mesmo token é rejeitada.
- `consume` de um token expirado é rejeitado.
- Após `invalidateAll(userId)`, tokens de reset pendentes deixam de ser aceitos por `consume`.

---

### SI-02.7 — MailModule e templates transacionais

**Description:** Configurar o envio de e-mail via SMTP (Mailpit no dev) com templates Handlebars e expor um `MailService` com métodos de alto nível (`auth/TD-07`).

**Technical actions:**

- Instalar `@nestjs-modules/mailer@^2.0.0` e `nodemailer@^6.9.0` (+ `handlebars`).
- Configurar `MailerModule.forRootAsync` injetando `mailConfig` (`ConfigType`): transport SMTP (`host`, `port`, `auth`), `defaults.from` e `HandlebarsAdapter` apontando para `src/mail/templates/`.
- Criar os templates `confirm-account.hbs` e `reset-password.hbs` (nome do usuário + link com token montado a partir de `APP_BASE_URL`). O link de **reset** aponta para um path de página do frontend (`/reset-password` — placeholder até a fase de frontend existir), nunca para o path da API (`POST /auth/reset-password`), que exige o token no body e um formulário para a nova senha; a página lê o token da query string e dispara o POST real. O link de **confirmação** aponta direto para `GET /auth/confirm?token=…` na API, já que a operação não exige nenhum dado além do token (per `auth/TD-09`, revisão de 2026-07-18).
- Criar `MailService` (`src/mail/mail.service.ts`) com `sendConfirmation(email, name, token)` e `sendPasswordReset(email, name, token)` via `mailerService.sendMail`.

**Tests:**

| Artifact | Layer | Test file |
|----------|-------|-----------|
| `MailService` | Unit: `sendConfirmation`/`sendPasswordReset` chamam `MailerService.sendMail` com `template`, `to` e `context` (token/link) corretos | `src/mail/mail.service.spec.ts` |

**Dependencies:** SI-02.2

**Acceptance criteria:**

- `sendConfirmation` dispara um e-mail para o endereço informado usando o template de confirmação, com contexto contendo o nome e um link com o token.
- `sendPasswordReset` dispara um e-mail usando o template de reset, com contexto contendo o nome e um link com o token.
- No ambiente de desenvolvimento, os e-mails enviados são capturados pelo Mailpit (visíveis na UI 8025).

---

### SI-02.8 — ChannelService (derivação de nickname a partir do e-mail)

**Description:** Criar o canal do usuário a partir do prefixo do e-mail, normalizando o prefixo e resolvendo colisões com sufixo aleatório curto.

**Technical actions:**

- Criar `ChannelService` (`src/channels/channel.service.ts`) com `createForUser(user, manager)`: deriva o prefixo do e-mail, normaliza (minúsculas, remove caracteres fora de `[a-z0-9]`).
- Implementar resolução de colisão: se o nickname normalizado já existir, anexar `-` + 4 caracteres alfanuméricos aleatórios e repetir até obter um livre.
- Persistir o canal com `nickname`, `name` (= prefixo normalizado) e `description` nula, usando o `EntityManager` recebido (para participar da transação do cadastro).

**Tests:**

| Artifact | Layer | Test file |
|----------|-------|-----------|
| `ChannelService` | Unit: Normalização do prefixo; geração de sufixo aleatório quando o nickname-base já existe | `src/channels/channel.service.spec.ts` |

**Dependencies:** SI-02.3

**Acceptance criteria:**

- Para `john.doe@gmail.com` sem colisão, o canal é criado com nickname `johndoe` (prefixo normalizado).
- Quando o nickname-base já existe, o canal recebe um sufixo aleatório curto (ex.: `johndoe-a1b2`) e a unicidade é preservada.
- A criação participa da transação do chamador (recebe o `EntityManager`), não abrindo conexão própria.

---

### SI-02.9 — Cadastro de usuário (POST /auth/register)

**Description:** Cadastrar usuário com e-mail/senha, criando o canal automaticamente de forma atômica, emitindo token de confirmação e disparando o e-mail (best-effort).

**Technical actions:**

- Criar `RegisterDto` com `email` (formato válido, ≤ 254 chars) e `password` (8–128 chars), validados por class-validator.
- Implementar `AuthService.register`: dentro de uma transação, verificar unicidade do e-mail, hashear a senha (`PasswordService`), persistir o `User` e criar o canal (`ChannelService`) — tudo atômico.
- Após o commit, emitir um **JWT de confirmação** (`JwtService.signAsync({ sub, purpose: 'confirm' }, { expiresIn: CONFIRM_TOKEN_TTL })`) e disparar `MailService.sendConfirmation` de forma best-effort (falha de e-mail não desfaz o cadastro; logar o erro).
- Criar `AuthController` com `POST /auth/register` retornando 201 com `{ id, email, channel: { nickname } }`.

**Tests:**

| Artifact | Layer | Test file |
|----------|-------|-----------|
| `AuthService.register` | Unit: Registro atômico (canal falha → usuário não persiste); e-mail duplicado rejeitado; senha é hasheada | `src/auth/auth.service.spec.ts` |
| `POST /auth/register` | E2E: 201 com canal criado; 409 e-mail duplicado; 400 validação; e-mail de confirmação capturado | `test/auth-register.e2e-spec.ts` |

**Dependencies:** SI-02.1, SI-02.3, SI-02.5, SI-02.7, SI-02.8, SI-02.11

**Acceptance criteria:**

- `POST /auth/register` com e-mail e senha válidos retorna 201 com `{ id, email, channel: { nickname } }`; um canal é criado com nickname derivado do prefixo do e-mail.
- `POST /auth/register` com e-mail já cadastrado retorna 409 com `EMAIL_JA_EXISTE`.
- `POST /auth/register` com senha menor que 8 caracteres retorna 400 (erro de validação).
- O cadastro é atômico — se a criação do canal falhar, nenhuma linha de usuário é persistida.
- Cadastrar um novo usuário causa o envio de um e-mail de confirmação ao endereço cadastrado, contendo o nome e um link com o token; falha no envio não impede o cadastro (usuário criado como não confirmado).

---

### SI-02.10 — Confirmação de conta e reenvio (GET /auth/confirm, /auth/resend-confirmation)

**Description:** Ativar a conta a partir do token de confirmação e permitir reenvio do e-mail de confirmação, sem vazar a existência/estado da conta.

**Technical actions:**

- Criar `ConfirmDto` (`token`) e `ResendConfirmationDto` (`email`).
- Implementar `AuthService.confirmAccount`: validar o **JWT de confirmação** (`JwtService.verifyAsync` + checar `purpose === 'confirm'`); se o usuário já estiver confirmado, retornar `EMAIL_JA_CONFIRMADO`; caso contrário marcar `isConfirmed = true`.
- Implementar `AuthService.resendConfirmation`: se existir usuário não confirmado para o e-mail, emitir um novo JWT de confirmação e reenviar; sempre responder de forma neutra (sem revelar existência/estado). JWTs de confirmação anteriores permanecem válidos até expirar (stateless — sem invalidação).
- Adicionar `GET /auth/confirm?token=…` (204) e `POST /auth/resend-confirmation` (204 neutro) ao `AuthController`.

**Tests:**

| Artifact | Layer | Test file |
|----------|-------|-----------|
| `GET /auth/confirm` · `POST /auth/resend-confirmation` | E2E: Confirmação 204 e `isConfirmed=true`; JWT inválido/expirado 400; já confirmada 409; reenvio 204 neutro | `test/auth-confirm.e2e-spec.ts` |

**Dependencies:** SI-02.7, SI-02.9, SI-02.11

**Acceptance criteria:**

- `GET /auth/confirm` com JWT de confirmação válido retorna 204 sem corpo — a conta passa a `isConfirmed = true`.
- `GET /auth/confirm` com JWT inválido, expirado ou com `purpose` diferente de `confirm` retorna 400 com `TOKEN_INVALIDO`.
- `GET /auth/confirm` para conta já confirmada retorna 409 com `EMAIL_JA_CONFIRMADO` (replay de um JWT já consumido cai neste caso, garantindo idempotência).
- `POST /auth/resend-confirmation` retorna 204 sem corpo tanto para e-mail existente quanto inexistente (resposta neutra, sem revelar a existência da conta); para conta não confirmada, um novo e-mail é enviado (JWTs de confirmação anteriores seguem válidos até expirar).

---

### SI-02.11 — Infraestrutura Passport/JWT (strategies e guards)

**Description:** Configurar o `JwtModule`, as estratégias Passport (local e jwt com extração do access token via cookie) e os guards declarativos (`auth/TD-01`, `auth/TD-02`, `auth/TD-03`).

**Technical actions:**

- Instalar `@nestjs/passport@^11.0.0`, `@nestjs/jwt@^11.0.0`, `passport@^0.7.0`, `passport-local@^1.0.0`, `passport-jwt@^4.0.0` (+ `@types/passport-local`, `@types/passport-jwt`).
- Registrar `JwtModule.registerAsync` injetando `authConfig` (secret + `expiresIn` do access token).
- Implementar `LocalStrategy` (valida `email`/`password` via `AuthService`) e `JwtStrategy` com `jwtFromRequest` lendo o access token do cookie `access_token` (extractor custom), `ignoreExpiration: false`.
- Criar `LocalAuthGuard` (`AuthGuard('local')`) e `JwtAuthGuard` (`AuthGuard('jwt')`).

**Tests:**

| Artifact | Layer | Test file |
|----------|-------|-----------|
| `JwtStrategy` | Unit: Extractor lê o token do cookie `access_token`; `validate` retorna o payload do usuário | `src/auth/strategies/jwt.strategy.spec.ts` |
| `LocalStrategy` | Unit: `validate` retorna o usuário em credenciais válidas e lança em inválidas | `src/auth/strategies/local.strategy.spec.ts` |

**Dependencies:** SI-02.2

**Acceptance criteria:**

- Uma requisição a uma rota protegida por `JwtAuthGuard` sem o cookie `access_token` retorna 401.
- Uma requisição com cookie `access_token` válido passa pelo `JwtAuthGuard` e expõe o usuário autenticado no request.
- Um access token expirado é rejeitado com 401 (sem `ignoreExpiration`).

---

### SI-02.12 — SessionService (refresh com rotação e detecção de reuso)

**Description:** Emitir o par access/refresh (ambos JWT), persistir o refresh pelo seu `jti` com família de rotação, rotacionar a cada uso e detectar reuso de token revogado (`auth/TD-04`, RFC 9700). Inclui helpers de cookie.

**Technical actions:**

- Criar `SessionService` (`src/auth/session.service.ts`) com `issuePair(user)`: gera access JWT e **refresh JWT** (claim `jti` + `familyId`) via `JwtService`; persiste o `jti` do refresh com `familyId` novo e `expiresAt` (TTL refresh).
- Implementar `rotate(rawRefresh)`: valida a assinatura do refresh JWT e localiza seu `jti`; se válido e não revogado, revoga o atual, emite novo par na mesma família e encadeia `replacedById`; se o `jti` já estiver revogado (reuso), revoga toda a família e sinaliza reuso.
- Implementar `revokeFamily(familyId)` (logout/reset) e `revokeAllForUser(userId)` (reset de senha).
- Criar helpers `setAuthCookies(res, pair)` e `clearAuthCookies(res)` — cookies `httpOnly`, `Secure`, `SameSite=Strict`; `refresh_token` com `Path=/auth`.

**Tests:**

| Artifact | Layer | Test file |
|----------|-------|-----------|
| `SessionService` | Unit: `issuePair` persiste o `jti` do refresh; `rotate` invalida o anterior e emite novo; reuso de `jti` revogado derruba a família | `src/auth/session.service.spec.ts` |

**Dependencies:** SI-02.4, SI-02.11

**Acceptance criteria:**

- `issuePair` persiste apenas o `jti` do refresh JWT (o token assinado nunca é armazenado) e o associa a uma `familyId`.
- `rotate` com um refresh válido revoga o token usado e emite um novo par na mesma família.
- `rotate` com um refresh já revogado (reuso) revoga todos os tokens da família e sinaliza reuso.
- `setAuthCookies` emite `access_token` e `refresh_token` como `httpOnly`+`Secure`+`SameSite=Strict`, com o refresh restrito a `Path=/auth`.

---

### SI-02.13 — Login (POST /auth/login)

**Description:** Autenticar por credenciais, bloquear contas não confirmadas e emitir o par de tokens em cookies `httpOnly`.

**Technical actions:**

- Criar `LoginDto` (`email`, `password`).
- Adicionar `POST /auth/login` protegido por `LocalAuthGuard`; após validar credenciais, recusar com `EMAIL_NAO_CONFIRMADO` se `isConfirmed = false`.
- Em sucesso, chamar `SessionService.issuePair` + `setAuthCookies` e retornar 200 com `{ id, email, channel: { nickname } }` (tokens vão nos cookies, não no corpo).

**Tests:**

| Artifact | Layer | Test file |
|----------|-------|-----------|
| `POST /auth/login` | E2E: 200 + Set-Cookie em credenciais válidas; 401 credenciais inválidas; 403 conta não confirmada | `test/auth-login.e2e-spec.ts` |

**Dependencies:** SI-02.1, SI-02.5, SI-02.11, SI-02.12

**Acceptance criteria:**

- `POST /auth/login` com credenciais válidas de conta confirmada retorna 200 com `{ id, email, channel }` e cabeçalhos `Set-Cookie` para `access_token` e `refresh_token` (`httpOnly`).
- `POST /auth/login` com e-mail inexistente retorna 401 com `CREDENCIAIS_INVALIDAS` — mesmo código e status que senha incorreta, sem revelar a existência do e-mail.
- `POST /auth/login` de conta com `isConfirmed = false` retorna 403 com `EMAIL_NAO_CONFIRMADO`.

---

### SI-02.14 — Refresh e Logout (POST /auth/refresh, /auth/logout)

**Description:** Renovar a sessão por rotação do refresh token e encerrar a sessão atual revogando sua família.

**Technical actions:**

- Adicionar `POST /auth/refresh`: ler o `refresh_token` do cookie, chamar `SessionService.rotate`; em sucesso, emitir novos cookies e retornar 200 com `{ id, email }`; em reuso, retornar `TOKEN_REUTILIZADO`.
- Adicionar `POST /auth/logout` protegido por `JwtAuthGuard`: revogar a família do refresh atual (`revokeFamily`) e limpar os cookies; retornar 204.
- Garantir resposta 401 (`SESSAO_INVALIDA`) quando o cookie de refresh estiver ausente, inválido ou expirado.

**Tests:**

| Artifact | Layer | Test file |
|----------|-------|-----------|
| `POST /auth/refresh` · `POST /auth/logout` | E2E: Refresh 200 rotaciona cookies; reuso 401 + família revogada; logout 204 limpa cookies e revoga sessão | `test/auth-session.e2e-spec.ts` |

**Dependencies:** SI-02.11, SI-02.12

**Acceptance criteria:**

- `POST /auth/refresh` com refresh token válido retorna 200, emite novos cookies `access_token`/`refresh_token` e invalida o refresh anterior.
- `POST /auth/refresh` com refresh token já utilizado retorna 401 com `TOKEN_REUTILIZADO` e todos os refresh tokens da mesma família são revogados.
- `POST /auth/refresh` sem cookie de refresh (ou expirado) retorna 401 com `SESSAO_INVALIDA`.
- `POST /auth/logout` com sessão válida retorna 204 sem corpo — os cookies são limpos e a família do refresh atual é revogada; outras sessões do usuário permanecem ativas.

---

### SI-02.15 — Recuperação de senha (POST /auth/forgot-password, /auth/reset-password)

**Description:** Solicitar redefinição por e-mail (resposta neutra) e redefinir a senha via token, encerrando todas as sessões ativas.

**Technical actions:**

- Criar `ForgotPasswordDto` (`email`) e `ResetPasswordDto` (`token`, `password` 8–128).
- Implementar `AuthService.forgotPassword`: se houver usuário para o e-mail, `PasswordResetTokenService.invalidateAll(userId)`, emitir token de reset opaco e enviar e-mail; responder sempre 204 neutro.
- Implementar `AuthService.resetPassword`: `PasswordResetTokenService.consume(token)`, hashear e gravar a nova senha, invalidar tokens de reset pendentes e revogar todas as sessões (`SessionService.revokeAllForUser`).
- Adicionar `POST /auth/forgot-password` (204 neutro) e `POST /auth/reset-password` (204) ao `AuthController`.

**Tests:**

| Artifact | Layer | Test file |
|----------|-------|-----------|
| `POST /auth/forgot-password` · `POST /auth/reset-password` | E2E: Forgot 204 neutro (existente/inexistente); reset 204 troca senha; token inválido 400; sessões revogadas após reset | `test/auth-password-recovery.e2e-spec.ts` |

**Dependencies:** SI-02.1, SI-02.5, SI-02.6, SI-02.7, SI-02.12

**Acceptance criteria:**

- `POST /auth/forgot-password` retorna 204 sem corpo para e-mail existente e inexistente (resposta neutra); para e-mail existente, um e-mail de reset é enviado com um link contendo o token.
- Uma nova solicitação de reset invalida os tokens de reset pendentes anteriores do usuário.
- `POST /auth/reset-password` com token válido retorna 204 sem corpo — a senha é atualizada e o token não pode ser reutilizado.
- `POST /auth/reset-password` com token inválido, expirado ou já usado retorna 400 com `TOKEN_INVALIDO`.
- Após uma redefinição bem-sucedida, todas as sessões ativas do usuário são revogadas (refresh tokens anteriores deixam de renovar).

---

### SI-02.16 — Rate limiting nos endpoints de auth (@nestjs/throttler)

**Description:** Aplicar limites de requisição globais e estritos nos endpoints sensíveis para mitigar brute-force e abuso de e-mail (`auth/TD-08`).

**Technical actions:**

- Instalar `@nestjs/throttler@^6.0.0` e configurar `ThrottlerModule.forRoot` com throttlers nomeados: `global` (100/min) e janelas auxiliares para endpoints sensíveis.
- Registrar `ThrottlerGuard` como `APP_GUARD` global.
- Aplicar `@Throttle` por rota: `login` 5/min; `forgot-password` 3/hora; `resend-confirmation` 3/hora.
- Garantir que respostas de limite excedido retornem 429 no formato de erro padrão.

**Tests:**

| Artifact | Layer | Test file |
|----------|-------|-----------|
| Throttler guards nos endpoints de auth | E2E: Exceder o limite de `login` retorna 429; endpoints não sensíveis seguem o limite global | `test/auth-throttle.e2e-spec.ts` |

**Dependencies:** SI-02.9, SI-02.10, SI-02.13, SI-02.14, SI-02.15

**Acceptance criteria:**

- Exceder 5 requisições por minuto em `POST /auth/login` retorna 429.
- Exceder 3 requisições por hora em `POST /auth/forgot-password` e `POST /auth/resend-confirmation` retorna 429.
- O limite global de 100/min aplica-se aos demais endpoints; respostas 429 seguem o formato de erro padrão.

---

### SI-02.17 — ChannelService com repositório próprio e módulo encapsulado

> Ajuste de fronteiras de domínio, planejado após a entrega dos SI-02.1 a SI-02.16 — ver `## Contexto do ajuste de fronteiras`.

**Description:** Dar ao `ChannelsModule` controle autônomo sobre o canal — repositório injetado, criação transacional híbrida e leitura própria — e fechar o vazamento do repositório para outros módulos.

**Technical actions:**

- Injetar `@InjectRepository(Channel)` no `ChannelService` (construtor, `private readonly`), mantendo `TypeOrmModule.forFeature([Channel])` no módulo — que passa a ter uso real.
- Alterar `createForUser(user, manager?)` para manager opcional: quando recebido, resolver o repositório via `manager.getRepository(Channel)` (obrigatório para participar da transação do chamador); quando ausente, usar o repositório injetado (per `auth/TD-19`). Aplicar a mesma resolução em `resolveNickname`/`nicknameExists`.
- Adicionar `findByUserId(userId)` ao `ChannelService`, retornando o `Channel` do usuário (ou `null`), para que outros módulos obtenham dados de canal sem carregar a relação por conta própria.
- Trocar `exports: [TypeOrmModule, ChannelService]` por `exports: [ChannelService]` em `channels.module.ts`, encerrando o acesso externo ao `Repository<Channel>`.
- Manter `normalizePrefix`, `resolveNickname` e `randomSuffix` como responsabilidade exclusiva do `ChannelService` — nenhum outro módulo deriva ou valida nickname.

**Tests:**

| Artifact | Layer | Test file |
|----------|-------|-----------|
| `ChannelService` | Unit: `createForUser` sem manager usa o repositório injetado; com manager resolve via `getRepository`; normalização do prefixo e sufixo em colisão preservados; `findByUserId` retorna o canal ou `null` | `src/channels/channel.service.spec.ts` |

**Dependencies:** none

**Acceptance criteria:**

- Criar um canal sem passar `EntityManager` persiste a linha em `channels` — o `ChannelService` opera de forma autônoma, sem depender de transação do chamador.
- Criar um canal passando o `EntityManager` de uma transação em curso participa dessa transação — um rollback do chamador não deixa canal órfão.
- Para `john.doe@gmail.com` sem colisão, o canal é criado com nickname `johndoe`; havendo colisão, recebe sufixo aleatório curto e a unicidade é preservada (comportamento inalterado).
- `findByUserId` retorna o canal do usuário informado e `null` quando o usuário não tem canal.
- Um módulo que importe `ChannelsModule` e tente injetar `Repository<Channel>` falha no boot da aplicação — o repositório deixou de ser exportado.

---

### SI-02.18 — UsersService como dono da persistência de User

**Description:** Criar o serviço que passa a concentrar todo acesso à tabela `users`, com o mesmo padrão híbrido de transação, e encapsular o repositório dentro do `UsersModule` (per `auth/TD-18`).

**Technical actions:**

- Criar `UsersService` (`src/users/users.service.ts`) injetando `@InjectRepository(User)`, expondo: `existsByEmail(email, manager?)`, `create({ email, passwordHash }, manager?)`, `findByEmail(email)`, `findById(id)`, `markConfirmed(userId)` e `updatePassword(userId, passwordHash)`.
- Aplicar o padrão híbrido de `auth/TD-19` em `existsByEmail` e `create` (os únicos usados dentro da transação de `register`): resolver o repositório via `manager.getRepository(User)` quando um manager for recebido, senão usar o injetado.
- Registrar `UsersService` em `providers` e trocar `exports: [TypeOrmModule]` por `exports: [UsersService]` em `users.module.ts`, encerrando o acesso externo ao `Repository<User>`.
- Manter a entidade `User` com a relação `@OneToOne` para `Channel` inalterada — a relação é bidirecional no schema e não muda; o que muda é quem a consulta (ver SI-02.19).
- Não expor `passwordHash` em nenhum retorno agregado novo — os métodos retornam a entidade `User` como hoje, e a serialização de resposta segue sendo responsabilidade dos DTOs do `AuthModule`.

**Tests:**

| Artifact | Layer | Test file |
|----------|-------|-----------|
| `UsersService` | Unit: `existsByEmail`/`create` usam o repositório injetado sem manager e `getRepository` com manager; `findByEmail`/`findById` retornam usuário ou `null`; `markConfirmed` e `updatePassword` persistem a alteração | `src/users/users.service.spec.ts` |

**Dependencies:** none

**Acceptance criteria:**

- `create` sem `EntityManager` persiste a linha em `users`; com `EntityManager` de uma transação em curso, participa dela — rollback do chamador não deixa usuário persistido.
- `existsByEmail` retorna `true` para e-mail cadastrado e `false` para desconhecido.
- `findByEmail` e `findById` retornam `null` para e-mail/id inexistente, sem lançar exceção.
- `markConfirmed(userId)` faz o usuário passar a `is_confirmed = true`; `updatePassword(userId, hash)` grava o novo hash.
- Um módulo que importe `UsersModule` e tente injetar `Repository<User>` falha no boot da aplicação — o repositório deixou de ser exportado.

---

### SI-02.19 — AuthService delega persistência a UsersService e ChannelService

**Description:** Remover todo acesso direto ao banco do `AuthService`, que passa a orquestrar os serviços de domínio, mantendo a transação de cadastro e o comportamento externo idênticos.

**Technical actions:**

- Substituir em `register` as chamadas `manager.exists/create/save(User, ...)` por `usersService.existsByEmail(..., manager)` e `usersService.create(..., manager)`, preservando a transação `dataSource.transaction` e repassando o mesmo `manager` a `usersService.create` e `channelService.createForUser`.
- Substituir os acessos diretos de `confirmAccount`, `refresh` e `resetPassword` (`findOneBy`, `findOneByOrFail`, `update`) pelos métodos equivalentes do `UsersService` (`findById`, `markConfirmed`, `updatePassword`).
- Substituir em `resendConfirmation`, `validateCredentials` e `forgotPassword` o carregamento de `relations: { channel: true }` por `usersService.findByEmail` + `channelService.findByUserId`, eliminando o acesso do auth a colunas de canal.
- Ajustar `login` para obter o nickname via `channelService.findByUserId(user.id)` em vez de `user.channel.nickname`, e a `LocalStrategy`/`validateCredentials` para não depender mais da relação carregada.
- Manter `@InjectDataSource` no `AuthService` **exclusivamente** para abrir a transação de `register` (fronteira transacional que cruza os dois domínios); nenhuma outra operação pode usar `dataSource.manager`.

**Tests:**

| Artifact | Layer | Test file |
|----------|-------|-----------|
| `AuthService` (orquestração) | Unit: mocks de `UsersService`/`ChannelService` no lugar dos mocks de `EntityManager`; registro atômico repassa o mesmo manager aos dois serviços; e-mail duplicado rejeitado; senha hasheada; confirmação/reset/refresh delegam ao `UsersService` | `src/auth/auth.service.spec.ts` |

**Dependencies:** SI-02.17, SI-02.18

**Acceptance criteria:**

- `POST /auth/register` com e-mail e senha válidos retorna 201 com `{ id, email, channel: { nickname } }` e o cadastro segue atômico — se a criação do canal falhar, nenhuma linha de usuário é persistida.
- `POST /auth/register` com e-mail já cadastrado retorna 409 com `EMAIL_JA_EXISTE`.
- `POST /auth/login` com credenciais válidas de conta confirmada retorna 200 com o nickname do canal no corpo; conta não confirmada retorna 403 com `EMAIL_NAO_CONFIRMADO`; credenciais inválidas retornam 401 com `CREDENCIAIS_INVALIDAS`.
- `GET /auth/confirm`, `POST /auth/refresh`, `/auth/logout`, `/auth/forgot-password` e `/auth/reset-password` mantêm exatamente os mesmos status e códigos de erro da entrega original desta fase.
- As 8 suítes e2e existentes passam sem nenhuma edição — nenhum comportamento externo mudou.

---

## Technical Specifications

### Data Model

#### User

| Coluna | Tipo | Restrições | Notas |
|--------|------|------------|-------|
| id | uuid | PK, gerado | |
| email | varchar(254) | único, not null | normalizado em minúsculas |
| password_hash | varchar | not null | digest argon2id |
| is_confirmed | boolean | not null, default false | ativado pela confirmação |
| created_at | timestamptz | not null, default now | |
| updated_at | timestamptz | not null, default now | |

**Relações:** User → Channel (one-to-one, FK em Channel.user_id)
**Índices:** (email) — único

#### Channel

| Coluna | Tipo | Restrições | Notas |
|--------|------|------------|-------|
| id | uuid | PK, gerado | |
| user_id | uuid | FK → users.id, único, not null, on delete cascade | um-para-um |
| nickname | varchar | único, not null | derivado do prefixo do e-mail |
| name | varchar | not null | inicialmente = prefixo normalizado |
| description | text | nullable | |
| created_at | timestamptz | not null, default now | |
| updated_at | timestamptz | not null, default now | |

**Índices:** (nickname) — único; (user_id) — único

#### RefreshToken

| Coluna | Tipo | Restrições | Notas |
|--------|------|------------|-------|
| id | uuid | PK, gerado | |
| user_id | uuid | FK → users.id, not null, on delete cascade | |
| jti | uuid | único, not null | id do refresh JWT (o token assinado não é persistido) |
| family_id | uuid | not null | linhagem de rotação |
| expires_at | timestamptz | not null | TTL refresh (7d) |
| revoked_at | timestamptz | nullable | preenchido na rotação/revogação |
| replaced_by_id | uuid | nullable | encadeamento da rotação |
| created_at | timestamptz | not null, default now | |

**Índices:** (jti) — único; (family_id)

#### PasswordResetToken

| Coluna | Tipo | Restrições | Notas |
|--------|------|------------|-------|
| id | uuid | PK, gerado | |
| user_id | uuid | FK → users.id, not null, on delete cascade | |
| token_hash | varchar | not null | hash SHA-256 do token opaco |
| expires_at | timestamptz | not null | TTL reset (1h) |
| used_at | timestamptz | nullable | uso único |
| created_at | timestamptz | not null, default now | |

**Índices:** (token_hash); (user_id)

_(A confirmação de conta usa JWT stateless — não há tabela de tokens de confirmação.)_

---

### API Contracts

Todos os endpoints estão sob o prefixo `/auth`. Cookies emitidos: `access_token` e `refresh_token` — ambos `httpOnly`, `Secure`, `SameSite=Strict`; `refresh_token` com `Path=/auth`.

#### POST /auth/register (SI-02.9)

**Corpo da requisição:**
- email: string, obrigatório — formato de e-mail, ≤ 254 chars
- password: string, obrigatório — 8–128 chars

**Resposta 201:**
- id: uuid
- email: string
- channel: { nickname: string }

**Respostas de erro:**
- 409 EMAIL_JA_EXISTE: e-mail já cadastrado
- 400 erro de validação: corpo fora das regras

#### GET /auth/confirm (SI-02.10)

**Query string:**
- token: string, obrigatório (`?token=…`)

**Resposta 204:** sem corpo

**Respostas de erro:**
- 400 TOKEN_INVALIDO: token inválido, expirado ou já usado
- 409 EMAIL_JA_CONFIRMADO: conta já confirmada

#### POST /auth/resend-confirmation (SI-02.10)

**Corpo da requisição:**
- email: string, obrigatório — formato de e-mail

**Resposta 204:** sem corpo (resposta neutra — não revela existência/estado da conta)

#### POST /auth/login (SI-02.13)

**Corpo da requisição:**
- email: string, obrigatório
- password: string, obrigatório

**Resposta 200:**
- id: uuid
- email: string
- channel: { nickname: string }

**Cabeçalhos da resposta:**
- Set-Cookie: access_token (httpOnly, Secure, SameSite=Strict)
- Set-Cookie: refresh_token (httpOnly, Secure, SameSite=Strict, Path=/auth)

**Respostas de erro:**
- 401 CREDENCIAIS_INVALIDAS: e-mail desconhecido OU senha incorreta (mesmo código para ambos)
- 403 EMAIL_NAO_CONFIRMADO: conta com is_confirmed = false
- 400 erro de validação: corpo fora das regras

#### POST /auth/refresh (SI-02.14)

**Cabeçalhos da requisição:**
- Cookie: refresh_token

**Resposta 200:**
- id: uuid
- email: string

**Cabeçalhos da resposta:**
- Set-Cookie: access_token, refresh_token (novo par rotacionado)

**Respostas de erro:**
- 401 TOKEN_REUTILIZADO: refresh já utilizado (família revogada)
- 401 SESSAO_INVALIDA: refresh ausente, inválido ou expirado

#### POST /auth/logout (SI-02.14)

**Cabeçalhos da requisição:**
- Cookie: access_token (autenticado)

**Resposta 204:** sem corpo

**Cabeçalhos da resposta:**
- Set-Cookie: access_token e refresh_token expirados (limpeza)

**Respostas de erro:**
- 401: sem access token válido

#### POST /auth/forgot-password (SI-02.15)

**Corpo da requisição:**
- email: string, obrigatório — formato de e-mail

**Resposta 204:** sem corpo (resposta neutra — não revela existência da conta)

#### POST /auth/reset-password (SI-02.15)

**Corpo da requisição:**
- token: string, obrigatório
- password: string, obrigatório — 8–128 chars

**Resposta 204:** sem corpo

**Respostas de erro:**
- 400 TOKEN_INVALIDO: token inválido, expirado ou já usado
- 400 erro de validação: senha fora das regras

#### Validation Rules

| Campo | Regra | Mensagem de erro |
|-------|-------|------------------|
| password | 8 a 128 caracteres, sem regra de complexidade obrigatória | A senha deve ter entre 8 e 128 caracteres |
| email | formato de e-mail válido, ≤ 254 caracteres | E-mail inválido |

---

### Authorization Matrix

| Endpoint | Anonymous | Authenticated | Owner |
|----------|-----------|---------------|-------|
| POST /auth/register | ✓ | ✗ | ✗ |
| GET /auth/confirm | ✓ | ✗ | ✗ |
| POST /auth/resend-confirmation | ✓ | ✗ | ✗ |
| POST /auth/login | ✓ | ✗ | ✗ |
| POST /auth/refresh | ✓ (via cookie de refresh) | ✗ | ✗ |
| POST /auth/logout | ✗ | ✓ | ✗ |
| POST /auth/forgot-password | ✓ | ✗ | ✗ |
| POST /auth/reset-password | ✓ (via token) | ✗ | ✗ |

---

### Error Catalog

**Formato da resposta de erro** _(definido aqui — primeira fase com endpoints HTTP no `nestjs-project`; fases posteriores herdam):_
```
{ statusCode, error, message }
```
_O campo `error` carrega o código de erro de domínio (ex.: `"EMAIL_JA_EXISTE"`); erros genéricos de validação usam o código padrão do framework sem código de domínio._

| errorCode | HTTP | Trigger |
|-----------|------|---------|
| EMAIL_JA_EXISTE | 409 | POST /auth/register com e-mail existente na tabela de usuários (mensagem: "E-mail já está cadastrado") |
| EMAIL_JA_CONFIRMADO | 409 | GET /auth/confirm para usuário com is_confirmed = true (mensagem: "Conta já confirmada") |
| TOKEN_INVALIDO | 400 | GET /auth/confirm com JWT de confirmação inválido/expirado (ou `purpose` ≠ `confirm`); POST /auth/reset-password com token opaco inexistente, expirado ou já usado (mensagem: "Token inválido ou expirado") |
| CREDENCIAIS_INVALIDAS | 401 | POST /auth/login com e-mail desconhecido OU senha incorreta (mesmo código para ambos) (mensagem: "E-mail ou senha inválidos") |
| EMAIL_NAO_CONFIRMADO | 403 | POST /auth/login com usuário onde is_confirmed = false (mensagem: "E-mail não confirmado") |
| TOKEN_REUTILIZADO | 401 | POST /auth/refresh com refresh token já utilizado (revoga a família) (mensagem: "Sessão inválida — reuso detectado") |
| SESSAO_INVALIDA | 401 | POST /auth/refresh sem cookie de refresh, ou com refresh inválido/expirado (mensagem: "Sessão inválida ou expirada") |

---

## Dependency Map

```
SI-02.1 (root)
├── SI-02.9
├── SI-02.13
└── SI-02.15
SI-02.2 (root)
├── SI-02.5
│   ├── SI-02.9
│   ├── SI-02.13
│   └── SI-02.15
├── SI-02.7
│   ├── SI-02.9
│   ├── SI-02.10
│   └── SI-02.15
└── SI-02.11
    ├── SI-02.9
    ├── SI-02.10
    ├── SI-02.12
    │   ├── SI-02.13
    │   ├── SI-02.14
    │   └── SI-02.15
    ├── SI-02.13
    └── SI-02.14
SI-02.3 (root)
├── SI-02.4
│   ├── SI-02.6
│   │   └── SI-02.15
│   └── SI-02.12
└── SI-02.8
    └── SI-02.9
SI-02.9 ──┐
SI-02.10 ─┤
SI-02.13 ─┼── SI-02.16
SI-02.14 ─┤
SI-02.15 ─┘

SI-02.17 (root, ajuste de fronteiras) ──┐
                                        ├── SI-02.19
SI-02.18 (root, ajuste de fronteiras) ──┘
```

_(Ordem sugerida de implementação: 02.1, 02.2, 02.3, 02.4 → 02.5, 02.6, 02.7, 02.8 → 02.9, 02.10 → 02.11, 02.12 → 02.13, 02.14, 02.15 → 02.16. O ajuste de fronteiras vem depois: 02.17 e 02.18 são independentes entre si; 02.19 depende de ambos.)_

## Deliverables

- [x] Cadastro (`POST /auth/register`) cria usuário + canal de forma atômica, com nickname derivado do prefixo do e-mail e resolução de colisão por sufixo aleatório
- [x] Confirmação de conta (`GET /auth/confirm`) e reenvio (`POST /auth/resend-confirmation`) funcionando com JWT de confirmação stateless (`purpose: confirm`)
- [x] Login (`POST /auth/login`) emite access/refresh em cookies `httpOnly`+`Secure`+`SameSite=Strict`, bloqueando contas não confirmadas
- [x] Refresh (`POST /auth/refresh`) com rotação e detecção de reuso (revogação de família); logout (`POST /auth/logout`) revoga a sessão atual
- [x] Recuperação de senha (`POST /auth/forgot-password` → `POST /auth/reset-password`) com resposta neutra e revogação de todas as sessões na redefinição
- [x] Senhas hasheadas com argon2id; refresh JWT rastreado por `jti` no banco; token de reset opaco persistido apenas como hash
- [x] E-mails transacionais (confirmação e reset) enviados via SMTP e capturados pelo Mailpit no ambiente de dev
- [x] Rate limiting (`@nestjs/throttler`) ativo: global 100/min, login 5/min, forgot-password e resend-confirmation 3/hora
- [x] Migrations criam `users`, `channels`, `refresh_tokens` e `password_reset_tokens` com restrições e índices especificados
- [x] Todos os testes de SI passam (`docker compose -f nestjs-project/compose.yaml exec nestjs-api npm test`)
- [x] Testes E2E passam (`docker compose -f nestjs-project/compose.yaml exec nestjs-api npm run test:e2e`)
- [x] Verificação de tipos/compilação e build passam (`docker compose -f nestjs-project/compose.yaml exec nestjs-api npm run build`)

**Ajuste de fronteiras (SI-02.17 a SI-02.19):**

- [x] `ChannelService` injeta `Repository<Channel>` e opera com ou sem `EntityManager` do chamador (padrão híbrido de `auth/TD-19`)
- [x] `ChannelService` é o único ponto que deriva, normaliza e resolve colisão de nickname; expõe `findByUserId` para consumo externo
- [x] `UsersService` criado como dono exclusivo da persistência de `User`, com o mesmo padrão híbrido (per `auth/TD-18`)
- [x] `ChannelsModule` e `UsersModule` deixam de exportar `TypeOrmModule` — repositórios encapsulados, acessíveis apenas via os serviços
- [x] `AuthService` não executa nenhuma operação de banco direta, exceto abrir a transação de `register`
- [x] `AuthService` não carrega mais `relations: { channel: true }` — dados de canal vêm do `ChannelService`
- [x] Nenhuma migration, mudança de schema ou alteração de contrato de API no ajuste
- [x] Testes E2E passam sem edição após o ajuste — nenhum comportamento externo mudou
