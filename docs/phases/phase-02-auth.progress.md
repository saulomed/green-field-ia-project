# Phase 02 — Cadastro, Login e Gerenciamento de Conta — Progress

**Status:** in_progress
**SIs:** 2/16 completed

### SI-02.1 — Fundação HTTP: validação, cookies e formato de erro
- **Status:** completed
- **Tests:** 4 unit (HttpExceptionFilter) + 4 E2E (validation) — all passed
- **Observations:** none

### SI-02.2 — Configuração de autenticação e e-mail (namespaces tipados)
- **Status:** completed
- **Tests:** 8 novos testes em env.validation.spec.ts (JWT_SECRET obrigatório, TTL defaults, cookie defaults) — 32 total passando
- **Observations:** database.integration.spec.ts removido da dependência do schema Joi completo (desacoplamento correto — o teste é de DatabaseModule, não de validação de env)

### SI-02.3 — Entidades User e Channel + migration
- **Status:** pending
- **Tests:** pending
- **Observations:** none

### SI-02.4 — Entidades RefreshToken e PasswordResetToken + migration
- **Status:** pending
- **Tests:** pending
- **Observations:** none

### SI-02.5 — PasswordService (hashing argon2id)
- **Status:** pending
- **Tests:** pending
- **Observations:** none

### SI-02.6 — PasswordResetTokenService (tokens opacos de reset)
- **Status:** pending
- **Tests:** pending
- **Observations:** none

### SI-02.7 — MailModule e templates transacionais
- **Status:** pending
- **Tests:** pending
- **Observations:** none

### SI-02.8 — ChannelService (derivação de nickname a partir do e-mail)
- **Status:** pending
- **Tests:** pending
- **Observations:** none

### SI-02.9 — Cadastro de usuário (POST /auth/register)
- **Status:** pending
- **Tests:** pending
- **Observations:** none

### SI-02.10 — Confirmação de conta e reenvio
- **Status:** pending
- **Tests:** pending
- **Observations:** none

### SI-02.11 — Infraestrutura Passport/JWT (strategies e guards)
- **Status:** pending
- **Tests:** pending
- **Observations:** none

### SI-02.12 — SessionService (refresh com rotação e detecção de reuso)
- **Status:** pending
- **Tests:** pending
- **Observations:** none

### SI-02.13 — Login (POST /auth/login)
- **Status:** pending
- **Tests:** pending
- **Observations:** none

### SI-02.14 — Refresh e Logout
- **Status:** pending
- **Tests:** pending
- **Observations:** none

### SI-02.15 — Recuperação de senha
- **Status:** pending
- **Tests:** pending
- **Observations:** none

### SI-02.16 — Rate limiting nos endpoints de auth
- **Status:** pending
- **Tests:** pending
- **Observations:** none
