# Fase 02 — Cadastro, Login e Gerenciamento de Conta

## Objetivo

Entregar a API de autenticação do StreamTube (`nestjs-project/`): cadastro com e-mail/senha, criação automática do canal, confirmação de conta por e-mail, login/refresh/logout com JWT em cookies `httpOnly` e refresh com rotação, e recuperação de senha — protegidos por rate limiting. As telas (frontend) ficam adiadas para uma fase futura, pois o Next.js ainda não foi inicializado.

---

## Implementações de Etapa

### IE-02.1 — Fundação HTTP: validação, cookies e formato de erro

**Descrição:** Estabelecer os comportamentos transversais de toda requisição HTTP da API: validação de entrada, parsing de cookies e formato padronizado de resposta de erro. Primeira fase a expor endpoints HTTP no `nestjs-project`.

**Ações técnicas:**

- Instalar `class-validator@^0.14.0`, `class-transformer@^0.5.0` e `cookie-parser@^1.4.0` (+ `@types/cookie-parser`).
- Registrar `ValidationPipe` global em `main.ts` com `whitelist: true`, `forbidNonWhitelisted: true` e `transform: true`.
- Registrar o middleware `cookie-parser` em `main.ts` para leitura de cookies em strategies/handlers.
- Implementar um exception filter global que serializa erros no formato `{ statusCode, error, message }` — `error` carrega o código de domínio do Catálogo de Erros (ou um código genérico em falhas não mapeadas).

**Testes:**

| Arquivo | Camada | Verifica |
|---------|--------|----------|
| src/common/filters/http-exception.filter.spec.ts | Unitário | Filtro serializa exceções de domínio e genéricas no formato `{ statusCode, error, message }` |
| test/validation.e2e-spec.ts | E2E | Corpo inválido/com campos extras retorna 400 no formato de erro padrão |

**Dependências:** Nenhuma

**Critérios de aceitação:**

- Uma requisição com corpo contendo campo não declarado no DTO retorna 400 no formato `{ statusCode, error, message }`.
- Uma requisição a um endpoint inexistente retorna 404 no mesmo formato de erro.
- Cookies enviados pelo cliente ficam disponíveis para leitura nos handlers (parsing ativo).

---

### IE-02.2 — Configuração de autenticação e e-mail (namespaces tipados)

**Descrição:** Estender a configuração namespaced da Fase 01 com os parâmetros de JWT, tokens de e-mail, hashing, cookies e credenciais SMTP, mantendo acesso tipado via `ConfigType` e validação Joi no boot.

**Ações técnicas:**

- Criar `src/config/auth.config.ts` (`registerAs('auth', ...)`) com `JWT_SECRET`, `JWT_ACCESS_TTL` (default `15m`), `JWT_REFRESH_TTL` (default `7d`), `CONFIRM_TOKEN_TTL` (default `24h`), `RESET_TOKEN_TTL` (default `1h`), parâmetros argon2 e flags de cookie (`COOKIE_SECURE`, `COOKIE_SAMESITE=strict`).
- Estender `src/config/mail.config.ts` com `MAIL_USER`, `MAIL_PASS`, `MAIL_FROM` e `APP_BASE_URL` (origem usada para montar links de e-mail).
- Adicionar ao schema Joi (`env.validation.ts`) todas as novas variáveis, com defaults para os TTLs e `JWT_SECRET` obrigatório (boot falha se ausente).
- Registrar `authConfig` no `load: [...]` do `ConfigModule.forRoot` e documentar as novas variáveis em `.env.example` (`MAIL_HOST=mailpit`, `MAIL_PORT=1025`).

**Testes:**

| Arquivo | Camada | Verifica |
|---------|--------|----------|
| src/config/env.validation.spec.ts | Unitário | Schema rejeita `JWT_SECRET` ausente e aplica defaults dos TTLs |

**Dependências:** Nenhuma

**Critérios de aceitação:**

- A aplicação falha ao iniciar se `JWT_SECRET` estiver ausente.
- TTLs ausentes assumem os defaults (`15m`, `7d`, `24h`, `1h`) e ficam acessíveis de forma tipada via `ConfigType<typeof authConfig>`.
- `.env.example` lista as variáveis de auth/mail com `MAIL_HOST=mailpit` (nome de serviço, nunca `localhost`).

---

### IE-02.3 — Entidades User e Channel + migration

**Descrição:** Modelar o usuário e seu canal (relação um-para-um) e gerar a migration correspondente, sem lógica de negócio.

**Ações técnicas:**

- Criar a entidade `User` (`src/users/entities/user.entity.ts`) com `id` (uuid), `email` (único, citext ou varchar normalizado em minúsculas), `passwordHash`, `isConfirmed` (default `false`) e timestamps.
- Criar a entidade `Channel` (`src/channels/entities/channel.entity.ts`) com `id` (uuid), `userId` (FK único — um-para-um), `nickname` (único), `name`, `description` (nullable) e timestamps.
- Definir a relação `User` 1—1 `Channel` (FK em `Channel.userId`, `onDelete: CASCADE`).
- Gerar a migration via TypeORM CLI (`npm run migration:generate`) criando ambas as tabelas com as restrições de unicidade.

**Testes:**

| Arquivo | Camada | Verifica |
|---------|--------|----------|
| src/database/users-channels.migration.integration.spec.ts | Integração | Migration cria tabelas `users`/`channels` com unicidade de `email` e `nickname` e FK `channels.user_id` |

**Dependências:** Nenhuma

**Critérios de aceitação:**

- `npm run migration:run` cria as tabelas `users` e `channels` com colunas e restrições especificadas.
- Inserir dois usuários com o mesmo `email` falha com violação de unicidade.
- Inserir dois canais com o mesmo `nickname` falha com violação de unicidade.
- Remover um usuário remove em cascata seu canal.

---

### IE-02.4 — Entidades RefreshToken e PasswordResetToken + migration

**Descrição:** Modelar as tabelas de persistência de tokens: refresh tokens (JWT rastreados por `jti`, com família para rotação/detecção de reuso) e tokens de reset de senha (opacos e hasheados). A confirmação de conta é um JWT stateless e não tem tabela.

**Ações técnicas:**

- Criar a entidade `RefreshToken` (`src/auth/entities/refresh-token.entity.ts`) com `id` (uuid), `userId` (FK), `jti` (uuid — id do refresh JWT), `familyId` (uuid), `expiresAt`, `revokedAt` (nullable), `replacedById` (nullable) e `createdAt`. (O refresh é um JWT assinado; persiste-se o `jti`, nunca o token.)
- Criar a entidade `PasswordResetToken` (`src/auth/entities/password-reset-token.entity.ts`) com `id` (uuid), `userId` (FK), `tokenHash` (SHA-256 do token opaco), `expiresAt`, `usedAt` (nullable) e `createdAt`.
- Definir FKs para `User` com `onDelete: CASCADE` em ambas as entidades.
- Adicionar índices: `RefreshToken(jti)` único, `RefreshToken(familyId)`, `PasswordResetToken(tokenHash)`, `PasswordResetToken(userId)`.
- Gerar a migration via TypeORM CLI criando ambas as tabelas e índices.

**Testes:**

| Arquivo | Camada | Verifica |
|---------|--------|----------|
| src/database/auth-tokens.migration.integration.spec.ts | Integração | Migration cria `refresh_tokens`/`password_reset_tokens` com FKs e índices (`jti` único, `token_hash`) |

**Dependências:** IE-02.3

**Critérios de aceitação:**

- `npm run migration:run` cria as tabelas `refresh_tokens` e `password_reset_tokens` com as colunas e índices especificados.
- Inserir dois `RefreshToken` com o mesmo `jti` falha por violação de unicidade.
- Remover um usuário remove em cascata seus refresh tokens e password reset tokens.

---

### IE-02.5 — PasswordService (hashing argon2id)

**Descrição:** Encapsular o hashing e a verificação de senha com argon2id, fonte única para cadastro, login e redefinição.

**Ações técnicas:**

- Instalar `argon2@^0.41.0` (binding nativo — garantir toolchain de compilação na imagem Docker).
- Criar `PasswordService` (`src/auth/password.service.ts`) com `hash(plain)` usando `argon2.hash` com `type: argon2.argon2id` e parâmetros vindos do namespace `auth`.
- Implementar `verify(hash, plain)` com `argon2.verify` (comparação timing-safe), retornando booleano sem lançar em mismatch.

**Testes:**

| Arquivo | Camada | Verifica |
|---------|--------|----------|
| src/auth/password.service.spec.ts | Unitário | `hash` produz digest argon2id; `verify` retorna `true` para senha correta e `false` para incorreta |

**Dependências:** IE-02.2

**Critérios de aceitação:**

- `hash` de uma senha produz um digest no formato `$argon2id$...` diferente a cada chamada (salt aleatório).
- `verify` retorna `true` para a senha original e `false` para qualquer outra, sem lançar exceção em mismatch.

---

### IE-02.6 — PasswordResetTokenService (tokens opacos de reset)

**Descrição:** Gerar, persistir (hasheados), validar e consumir tokens opacos de uso único para a redefinição de senha (DT-06). A confirmação de conta usa JWT (não passa por aqui).

**Ações técnicas:**

- Criar `PasswordResetTokenService` (`src/auth/password-reset-token.service.ts`) com `issue(userId)`: gera 32 bytes aleatórios (`crypto.randomBytes`), persiste apenas o hash (SHA-256) + `expiresAt` (TTL `reset` do namespace `auth`) e retorna o token em claro.
- Implementar `consume(rawToken)`: localiza por hash, rejeita se ausente/expirado/já usado, marca `usedAt` e retorna o `userId`.
- Implementar `invalidateAll(userId)`: invalida tokens de reset pendentes (usado ao reemitir e ao concluir a redefinição).

**Testes:**

| Arquivo | Camada | Verifica |
|---------|--------|----------|
| src/auth/password-reset-token.service.spec.ts | Unitário | `issue` persiste hash (não o valor); `consume` aceita token válido uma vez e rejeita expirado/usado; `invalidateAll` derruba pendentes |

**Dependências:** IE-02.4

**Critérios de aceitação:**

- `issue` armazena apenas o hash do token (o valor em claro nunca é persistido) e retorna o valor em claro uma única vez.
- `consume` de um token válido retorna o `userId` e o marca como usado; uma segunda chamada com o mesmo token é rejeitada.
- `consume` de um token expirado é rejeitado.
- Após `invalidateAll(userId)`, tokens de reset pendentes deixam de ser aceitos por `consume`.

---

### IE-02.7 — MailModule e templates transacionais

**Descrição:** Configurar o envio de e-mail via SMTP (Mailpit no dev) com templates Handlebars e expor um `MailService` com métodos de alto nível (DT-07).

**Ações técnicas:**

- Instalar `@nestjs-modules/mailer@^2.0.0` e `nodemailer@^6.9.0` (+ `handlebars`).
- Configurar `MailerModule.forRootAsync` injetando `mailConfig` (`ConfigType`): transport SMTP (`host`, `port`, `auth`), `defaults.from` e `HandlebarsAdapter` apontando para `src/mail/templates/`.
- Criar os templates `confirm-account.hbs` e `reset-password.hbs` (nome do usuário + link com token montado a partir de `APP_BASE_URL`). O link aponta para um path de **página do frontend** (`/confirm-account`, `/reset-password` — placeholder até a fase de frontend existir), nunca para o path da própria API (`/auth/confirm`, `/auth/reset-password`), já que estes só aceitam POST com o token no body; a página é quem lerá o token da query string (GET) e disparará o POST real.
- Criar `MailService` (`src/mail/mail.service.ts`) com `sendConfirmation(email, name, token)` e `sendPasswordReset(email, name, token)` via `mailerService.sendMail`.

**Testes:**

| Arquivo | Camada | Verifica |
|---------|--------|----------|
| src/mail/mail.service.spec.ts | Unitário | `sendConfirmation`/`sendPasswordReset` chamam `MailerService.sendMail` com `template`, `to` e `context` (token/link) corretos |

**Dependências:** IE-02.2

**Critérios de aceitação:**

- `sendConfirmation` dispara um e-mail para o endereço informado usando o template de confirmação, com contexto contendo o nome e um link com o token.
- `sendPasswordReset` dispara um e-mail usando o template de reset, com contexto contendo o nome e um link com o token.
- No ambiente de desenvolvimento, os e-mails enviados são capturados pelo Mailpit (visíveis na UI 8025).

---

### IE-02.8 — ChannelService (derivação de nickname a partir do e-mail)

**Descrição:** Criar o canal do usuário a partir do prefixo do e-mail, normalizando o prefixo e resolvendo colisões com sufixo aleatório curto.

**Ações técnicas:**

- Criar `ChannelService` (`src/channels/channel.service.ts`) com `createForUser(user, manager)`: deriva o prefixo do e-mail, normaliza (minúsculas, remove caracteres fora de `[a-z0-9]`).
- Implementar resolução de colisão: se o nickname normalizado já existir, anexar `-` + 4 caracteres alfanuméricos aleatórios e repetir até obter um livre.
- Persistir o canal com `nickname`, `name` (= prefixo normalizado) e `description` nula, usando o `EntityManager` recebido (para participar da transação do cadastro).

**Testes:**

| Arquivo | Camada | Verifica |
|---------|--------|----------|
| src/channels/channel.service.spec.ts | Unitário | Normalização do prefixo; geração de sufixo aleatório quando o nickname-base já existe |

**Dependências:** IE-02.3

**Critérios de aceitação:**

- Para `john.doe@gmail.com` sem colisão, o canal é criado com nickname `johndoe` (prefixo normalizado).
- Quando o nickname-base já existe, o canal recebe um sufixo aleatório curto (ex.: `johndoe-a1b2`) e a unicidade é preservada.
- A criação participa da transação do chamador (recebe o `EntityManager`), não abrindo conexão própria.

---

### IE-02.9 — Cadastro de usuário (POST /auth/register)

**Descrição:** Cadastrar usuário com e-mail/senha, criando o canal automaticamente de forma atômica, emitindo token de confirmação e disparando o e-mail (best-effort).

**Ações técnicas:**

- Criar `RegisterDto` com `email` (formato válido, ≤ 254 chars) e `password` (8–128 chars), validados por class-validator.
- Implementar `AuthService.register`: dentro de uma transação, verificar unicidade do e-mail, hashear a senha (`PasswordService`), persistir o `User` e criar o canal (`ChannelService`) — tudo atômico.
- Após o commit, emitir um **JWT de confirmação** (`JwtService.signAsync({ sub, purpose: 'confirm' }, { expiresIn: CONFIRM_TOKEN_TTL })`) e disparar `MailService.sendConfirmation` de forma best-effort (falha de e-mail não desfaz o cadastro; logar o erro).
- Criar `AuthController` com `POST /auth/register` retornando 201 com `{ id, email, channel: { nickname } }`.

**Testes:**

| Arquivo | Camada | Verifica |
|---------|--------|----------|
| src/auth/auth.service.spec.ts | Unitário | Registro atômico (canal falha → usuário não persiste); e-mail duplicado rejeitado; senha é hasheada |
| test/auth-register.e2e-spec.ts | E2E | 201 com canal criado; 409 e-mail duplicado; 400 validação; e-mail de confirmação capturado |

**Dependências:** IE-02.1, IE-02.3, IE-02.5, IE-02.7, IE-02.8, IE-02.11

**Critérios de aceitação:**

- `POST /auth/register` com e-mail e senha válidos retorna 201 com `{ id, email, channel: { nickname } }`; um canal é criado com nickname derivado do prefixo do e-mail.
- `POST /auth/register` com e-mail já cadastrado retorna 409 com `EMAIL_JA_EXISTE`.
- `POST /auth/register` com senha menor que 8 caracteres retorna 400 (erro de validação).
- O cadastro é atômico — se a criação do canal falhar, nenhuma linha de usuário é persistida.
- Cadastrar um novo usuário causa o envio de um e-mail de confirmação ao endereço cadastrado, contendo o nome e um link com o token; falha no envio não impede o cadastro (usuário criado como não confirmado).

---

### IE-02.10 — Confirmação de conta e reenvio (POST /auth/confirm, /auth/resend-confirmation)

**Descrição:** Ativar a conta a partir do token de confirmação e permitir reenvio do e-mail de confirmação, sem vazar a existência/estado da conta.

**Ações técnicas:**

- Criar `ConfirmDto` (`token`) e `ResendConfirmationDto` (`email`).
- Implementar `AuthService.confirmAccount`: validar o **JWT de confirmação** (`JwtService.verifyAsync` + checar `purpose === 'confirm'`); se o usuário já estiver confirmado, retornar `EMAIL_JA_CONFIRMADO`; caso contrário marcar `isConfirmed = true`.
- Implementar `AuthService.resendConfirmation`: se existir usuário não confirmado para o e-mail, emitir um novo JWT de confirmação e reenviar; sempre responder de forma neutra (sem revelar existência/estado). JWTs de confirmação anteriores permanecem válidos até expirar (stateless — sem invalidação).
- Adicionar `POST /auth/confirm` (204) e `POST /auth/resend-confirmation` (204 neutro) ao `AuthController`.

**Testes:**

| Arquivo | Camada | Verifica |
|---------|--------|----------|
| test/auth-confirm.e2e-spec.ts | E2E | Confirmação 204 e `isConfirmed=true`; JWT inválido/expirado 400; já confirmada 409; reenvio 204 neutro |

**Dependências:** IE-02.7, IE-02.9, IE-02.11

**Critérios de aceitação:**

- `POST /auth/confirm` com JWT de confirmação válido retorna 204 sem corpo — a conta passa a `isConfirmed = true`.
- `POST /auth/confirm` com JWT inválido, expirado ou com `purpose` diferente de `confirm` retorna 400 com `TOKEN_INVALIDO`.
- `POST /auth/confirm` para conta já confirmada retorna 409 com `EMAIL_JA_CONFIRMADO` (replay de um JWT já consumido cai neste caso, garantindo idempotência).
- `POST /auth/resend-confirmation` retorna 204 sem corpo tanto para e-mail existente quanto inexistente (resposta neutra, sem revelar a existência da conta); para conta não confirmada, um novo e-mail é enviado (JWTs de confirmação anteriores seguem válidos até expirar).

---

### IE-02.11 — Infraestrutura Passport/JWT (strategies e guards)

**Descrição:** Configurar o `JwtModule`, as estratégias Passport (local e jwt com extração do access token via cookie) e os guards declarativos (DT-01, DT-02, DT-03).

**Ações técnicas:**

- Instalar `@nestjs/passport@^11.0.0`, `@nestjs/jwt@^11.0.0`, `passport@^0.7.0`, `passport-local@^1.0.0`, `passport-jwt@^4.0.0` (+ `@types/passport-local`, `@types/passport-jwt`).
- Registrar `JwtModule.registerAsync` injetando `authConfig` (secret + `expiresIn` do access token).
- Implementar `LocalStrategy` (valida `email`/`password` via `AuthService`) e `JwtStrategy` com `jwtFromRequest` lendo o access token do cookie `access_token` (extractor custom), `ignoreExpiration: false`.
- Criar `LocalAuthGuard` (`AuthGuard('local')`) e `JwtAuthGuard` (`AuthGuard('jwt')`).

**Testes:**

| Arquivo | Camada | Verifica |
|---------|--------|----------|
| src/auth/strategies/jwt.strategy.spec.ts | Unitário | Extractor lê o token do cookie `access_token`; `validate` retorna o payload do usuário |
| src/auth/strategies/local.strategy.spec.ts | Unitário | `validate` retorna o usuário em credenciais válidas e lança em inválidas |

**Dependências:** IE-02.2

**Critérios de aceitação:**

- Uma requisição a uma rota protegida por `JwtAuthGuard` sem o cookie `access_token` retorna 401.
- Uma requisição com cookie `access_token` válido passa pelo `JwtAuthGuard` e expõe o usuário autenticado no request.
- Um access token expirado é rejeitado com 401 (sem `ignoreExpiration`).

---

### IE-02.12 — SessionService (refresh com rotação e detecção de reuso)

**Descrição:** Emitir o par access/refresh (ambos JWT), persistir o refresh pelo seu `jti` com família de rotação, rotacionar a cada uso e detectar reuso de token revogado (DT-04, RFC 9700). Inclui helpers de cookie.

**Ações técnicas:**

- Criar `SessionService` (`src/auth/session.service.ts`) com `issuePair(user)`: gera access JWT e **refresh JWT** (claim `jti` + `familyId`) via `JwtService`; persiste o `jti` do refresh com `familyId` novo e `expiresAt` (TTL refresh).
- Implementar `rotate(rawRefresh)`: valida a assinatura do refresh JWT e localiza seu `jti`; se válido e não revogado, revoga o atual, emite novo par na mesma família e encadeia `replacedById`; se o `jti` já estiver revogado (reuso), revoga toda a família e sinaliza reuso.
- Implementar `revokeFamily(familyId)` (logout/reset) e `revokeAllForUser(userId)` (reset de senha).
- Criar helpers `setAuthCookies(res, pair)` e `clearAuthCookies(res)` — cookies `httpOnly`, `Secure`, `SameSite=Strict`; `refresh_token` com `Path=/auth`.

**Testes:**

| Arquivo | Camada | Verifica |
|---------|--------|----------|
| src/auth/session.service.spec.ts | Unitário | `issuePair` persiste o `jti` do refresh; `rotate` invalida o anterior e emite novo; reuso de `jti` revogado derruba a família |

**Dependências:** IE-02.4, IE-02.11

**Critérios de aceitação:**

- `issuePair` persiste apenas o `jti` do refresh JWT (o token assinado nunca é armazenado) e o associa a uma `familyId`.
- `rotate` com um refresh válido revoga o token usado e emite um novo par na mesma família.
- `rotate` com um refresh já revogado (reuso) revoga todos os tokens da família e sinaliza reuso.
- `setAuthCookies` emite `access_token` e `refresh_token` como `httpOnly`+`Secure`+`SameSite=Strict`, com o refresh restrito a `Path=/auth`.

---

### IE-02.13 — Login (POST /auth/login)

**Descrição:** Autenticar por credenciais, bloquear contas não confirmadas e emitir o par de tokens em cookies `httpOnly`.

**Ações técnicas:**

- Criar `LoginDto` (`email`, `password`).
- Adicionar `POST /auth/login` protegido por `LocalAuthGuard`; após validar credenciais, recusar com `EMAIL_NAO_CONFIRMADO` se `isConfirmed = false`.
- Em sucesso, chamar `SessionService.issuePair` + `setAuthCookies` e retornar 200 com `{ id, email, channel: { nickname } }` (tokens vão nos cookies, não no corpo).

**Testes:**

| Arquivo | Camada | Verifica |
|---------|--------|----------|
| test/auth-login.e2e-spec.ts | E2E | 200 + Set-Cookie em credenciais válidas; 401 credenciais inválidas; 403 conta não confirmada |

**Dependências:** IE-02.1, IE-02.5, IE-02.11, IE-02.12

**Critérios de aceitação:**

- `POST /auth/login` com credenciais válidas de conta confirmada retorna 200 com `{ id, email, channel }` e cabeçalhos `Set-Cookie` para `access_token` e `refresh_token` (`httpOnly`).
- `POST /auth/login` com e-mail inexistente retorna 401 com `CREDENCIAIS_INVALIDAS` — mesmo código e status que senha incorreta, sem revelar a existência do e-mail.
- `POST /auth/login` de conta com `isConfirmed = false` retorna 403 com `EMAIL_NAO_CONFIRMADO`.

---

### IE-02.14 — Refresh e Logout (POST /auth/refresh, /auth/logout)

**Descrição:** Renovar a sessão por rotação do refresh token e encerrar a sessão atual revogando sua família.

**Ações técnicas:**

- Adicionar `POST /auth/refresh`: ler o `refresh_token` do cookie, chamar `SessionService.rotate`; em sucesso, emitir novos cookies e retornar 200 com `{ id, email }`; em reuso, retornar `TOKEN_REUTILIZADO`.
- Adicionar `POST /auth/logout` protegido por `JwtAuthGuard`: revogar a família do refresh atual (`revokeFamily`) e limpar os cookies; retornar 204.
- Garantir resposta 401 (`SESSAO_INVALIDA`) quando o cookie de refresh estiver ausente, inválido ou expirado.

**Testes:**

| Arquivo | Camada | Verifica |
|---------|--------|----------|
| test/auth-session.e2e-spec.ts | E2E | Refresh 200 rotaciona cookies; reuso 401 + família revogada; logout 204 limpa cookies e revoga sessão |

**Dependências:** IE-02.11, IE-02.12

**Critérios de aceitação:**

- `POST /auth/refresh` com refresh token válido retorna 200, emite novos cookies `access_token`/`refresh_token` e invalida o refresh anterior.
- `POST /auth/refresh` com refresh token já utilizado retorna 401 com `TOKEN_REUTILIZADO` e todos os refresh tokens da mesma família são revogados.
- `POST /auth/refresh` sem cookie de refresh (ou expirado) retorna 401 com `SESSAO_INVALIDA`.
- `POST /auth/logout` com sessão válida retorna 204 sem corpo — os cookies são limpos e a família do refresh atual é revogada; outras sessões do usuário permanecem ativas.

---

### IE-02.15 — Recuperação de senha (POST /auth/forgot-password, /auth/reset-password)

**Descrição:** Solicitar redefinição por e-mail (resposta neutra) e redefinir a senha via token, encerrando todas as sessões ativas.

**Ações técnicas:**

- Criar `ForgotPasswordDto` (`email`) e `ResetPasswordDto` (`token`, `password` 8–128).
- Implementar `AuthService.forgotPassword`: se houver usuário para o e-mail, `PasswordResetTokenService.invalidateAll(userId)`, emitir token de reset opaco e enviar e-mail; responder sempre 204 neutro.
- Implementar `AuthService.resetPassword`: `PasswordResetTokenService.consume(token)`, hashear e gravar a nova senha, invalidar tokens de reset pendentes e revogar todas as sessões (`SessionService.revokeAllForUser`).
- Adicionar `POST /auth/forgot-password` (204 neutro) e `POST /auth/reset-password` (204) ao `AuthController`.

**Testes:**

| Arquivo | Camada | Verifica |
|---------|--------|----------|
| test/auth-password-recovery.e2e-spec.ts | E2E | Forgot 204 neutro (existente/inexistente); reset 204 troca senha; token inválido 400; sessões revogadas após reset |

**Dependências:** IE-02.1, IE-02.5, IE-02.6, IE-02.7, IE-02.12

**Critérios de aceitação:**

- `POST /auth/forgot-password` retorna 204 sem corpo para e-mail existente e inexistente (resposta neutra); para e-mail existente, um e-mail de reset é enviado com um link contendo o token.
- Uma nova solicitação de reset invalida os tokens de reset pendentes anteriores do usuário.
- `POST /auth/reset-password` com token válido retorna 204 sem corpo — a senha é atualizada e o token não pode ser reutilizado.
- `POST /auth/reset-password` com token inválido, expirado ou já usado retorna 400 com `TOKEN_INVALIDO`.
- Após uma redefinição bem-sucedida, todas as sessões ativas do usuário são revogadas (refresh tokens anteriores deixam de renovar).

---

### IE-02.16 — Rate limiting nos endpoints de auth (@nestjs/throttler)

**Descrição:** Aplicar limites de requisição globais e estritos nos endpoints sensíveis para mitigar brute-force e abuso de e-mail (DT-08).

**Ações técnicas:**

- Instalar `@nestjs/throttler@^6.0.0` e configurar `ThrottlerModule.forRoot` com throttlers nomeados: `global` (100/min) e janelas auxiliares para endpoints sensíveis.
- Registrar `ThrottlerGuard` como `APP_GUARD` global.
- Aplicar `@Throttle` por rota: `login` 5/min; `forgot-password` 3/hora; `resend-confirmation` 3/hora.
- Garantir que respostas de limite excedido retornem 429 no formato de erro padrão.

**Testes:**

| Arquivo | Camada | Verifica |
|---------|--------|----------|
| test/auth-throttle.e2e-spec.ts | E2E | Exceder o limite de `login` retorna 429; endpoints não sensíveis seguem o limite global |

**Dependências:** IE-02.9, IE-02.10, IE-02.13, IE-02.14, IE-02.15

**Critérios de aceitação:**

- Exceder 5 requisições por minuto em `POST /auth/login` retorna 429.
- Exceder 3 requisições por hora em `POST /auth/forgot-password` e `POST /auth/resend-confirmation` retorna 429.
- O limite global de 100/min aplica-se aos demais endpoints; respostas 429 seguem o formato de erro padrão.

---

## Especificações Técnicas

### Modelo de Dados

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

### Contratos de API

Todos os endpoints estão sob o prefixo `/auth`. Cookies emitidos: `access_token` e `refresh_token` — ambos `httpOnly`, `Secure`, `SameSite=Strict`; `refresh_token` com `Path=/auth`.

#### POST /auth/register (IE-02.9)

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

#### POST /auth/confirm (IE-02.10)

**Corpo da requisição:**
- token: string, obrigatório

**Resposta 204:** sem corpo

**Respostas de erro:**
- 400 TOKEN_INVALIDO: token inválido, expirado ou já usado
- 409 EMAIL_JA_CONFIRMADO: conta já confirmada

#### POST /auth/resend-confirmation (IE-02.10)

**Corpo da requisição:**
- email: string, obrigatório — formato de e-mail

**Resposta 204:** sem corpo (resposta neutra — não revela existência/estado da conta)

#### POST /auth/login (IE-02.13)

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

#### POST /auth/refresh (IE-02.14)

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

#### POST /auth/logout (IE-02.14)

**Cabeçalhos da requisição:**
- Cookie: access_token (autenticado)

**Resposta 204:** sem corpo

**Cabeçalhos da resposta:**
- Set-Cookie: access_token e refresh_token expirados (limpeza)

**Respostas de erro:**
- 401: sem access token válido

#### POST /auth/forgot-password (IE-02.15)

**Corpo da requisição:**
- email: string, obrigatório — formato de e-mail

**Resposta 204:** sem corpo (resposta neutra — não revela existência da conta)

#### POST /auth/reset-password (IE-02.15)

**Corpo da requisição:**
- token: string, obrigatório
- password: string, obrigatório — 8–128 chars

**Resposta 204:** sem corpo

**Respostas de erro:**
- 400 TOKEN_INVALIDO: token inválido, expirado ou já usado
- 400 erro de validação: senha fora das regras

#### Regras de Validação — senha

| Campo | Regra | Mensagem de erro |
|-------|-------|------------------|
| password | 8 a 128 caracteres, sem regra de complexidade obrigatória | A senha deve ter entre 8 e 128 caracteres |
| email | formato de e-mail válido, ≤ 254 caracteres | E-mail inválido |

---

### Matriz de Autorização

| Endpoint | Público | Autenticado | Papel |
|----------|---------|-------------|-------|
| POST /auth/register | ✓ | | |
| POST /auth/confirm | ✓ | | |
| POST /auth/resend-confirmation | ✓ | | |
| POST /auth/login | ✓ | | |
| POST /auth/refresh | ✓ (via cookie de refresh) | | |
| POST /auth/logout | | ✓ | |
| POST /auth/forgot-password | ✓ | | |
| POST /auth/reset-password | ✓ (via token) | | |

---

### Catálogo de Erros

**Formato da resposta de erro** _(definido aqui — primeira fase com endpoints HTTP no `nestjs-project`; fases posteriores herdam):_
```
{ statusCode, error, message }
```
_O campo `error` carrega o código de erro de domínio (ex.: `"EMAIL_JA_EXISTE"`); erros genéricos de validação usam o código padrão do framework sem código de domínio._

| Código | HTTP | Mensagem | Gatilho |
|--------|------|----------|---------|
| EMAIL_JA_EXISTE | 409 | E-mail já está cadastrado | POST /auth/register com e-mail existente na tabela de usuários |
| EMAIL_JA_CONFIRMADO | 409 | Conta já confirmada | POST /auth/confirm para usuário com is_confirmed = true |
| TOKEN_INVALIDO | 400 | Token inválido ou expirado | POST /auth/confirm com JWT de confirmação inválido/expirado (ou `purpose` ≠ `confirm`); POST /auth/reset-password com token opaco inexistente, expirado ou já usado |
| CREDENCIAIS_INVALIDAS | 401 | E-mail ou senha inválidos | POST /auth/login com e-mail desconhecido OU senha incorreta (mesmo código para ambos) |
| EMAIL_NAO_CONFIRMADO | 403 | E-mail não confirmado | POST /auth/login com usuário onde is_confirmed = false |
| TOKEN_REUTILIZADO | 401 | Sessão inválida — reuso detectado | POST /auth/refresh com refresh token já utilizado (revoga a família) |
| SESSAO_INVALIDA | 401 | Sessão inválida ou expirada | POST /auth/refresh sem cookie de refresh, ou com refresh inválido/expirado |

---

## Mapa de Dependências

```
IE-02.1 (sem deps)
├── IE-02.9
├── IE-02.13
└── IE-02.15
IE-02.2 (sem deps)
├── IE-02.5
│   ├── IE-02.9
│   ├── IE-02.13
│   └── IE-02.15
├── IE-02.7
│   ├── IE-02.9
│   ├── IE-02.10
│   └── IE-02.15
└── IE-02.11
    ├── IE-02.9
    ├── IE-02.10
    ├── IE-02.12
    │   ├── IE-02.13
    │   ├── IE-02.14
    │   └── IE-02.15
    ├── IE-02.13
    └── IE-02.14
IE-02.3 (sem deps)
├── IE-02.4
│   ├── IE-02.6
│   │   └── IE-02.15
│   └── IE-02.12
└── IE-02.8
    └── IE-02.9
IE-02.9 ──┐
IE-02.10 ─┤
IE-02.13 ─┼── IE-02.16
IE-02.14 ─┤
IE-02.15 ─┘
```

_(Ordem sugerida de implementação: 02.1, 02.2, 02.3, 02.4 → 02.5, 02.6, 02.7, 02.8 → 02.9, 02.10 → 02.11, 02.12 → 02.13, 02.14, 02.15 → 02.16.)_

## Entregáveis

- [ ] Cadastro (`POST /auth/register`) cria usuário + canal de forma atômica, com nickname derivado do prefixo do e-mail e resolução de colisão por sufixo aleatório
- [ ] Confirmação de conta (`POST /auth/confirm`) e reenvio (`POST /auth/resend-confirmation`) funcionando com JWT de confirmação stateless (`purpose: confirm`)
- [ ] Login (`POST /auth/login`) emite access/refresh em cookies `httpOnly`+`Secure`+`SameSite=Strict`, bloqueando contas não confirmadas
- [ ] Refresh (`POST /auth/refresh`) com rotação e detecção de reuso (revogação de família); logout (`POST /auth/logout`) revoga a sessão atual
- [ ] Recuperação de senha (`POST /auth/forgot-password` → `POST /auth/reset-password`) com resposta neutra e revogação de todas as sessões na redefinição
- [ ] Senhas hasheadas com argon2id; refresh JWT rastreado por `jti` no banco; token de reset opaco persistido apenas como hash
- [ ] E-mails transacionais (confirmação e reset) enviados via SMTP e capturados pelo Mailpit no ambiente de dev
- [ ] Rate limiting (`@nestjs/throttler`) ativo: global 100/min, login 5/min, forgot-password e resend-confirmation 3/hora
- [ ] Migrations criam `users`, `channels`, `refresh_tokens` e `password_reset_tokens` com restrições e índices especificados
- [ ] Todos os testes de IE passam (`docker compose -f nestjs-project/compose.yaml exec nestjs-api npm test`)
- [ ] Testes E2E passam (`docker compose -f nestjs-project/compose.yaml exec nestjs-api npm run test:e2e`)
- [ ] Verificação de tipos/compilação e build passam (`docker compose -f nestjs-project/compose.yaml exec nestjs-api npm run build`)
</content>
</invoke>
