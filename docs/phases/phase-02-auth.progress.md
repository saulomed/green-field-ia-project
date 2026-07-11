# Phase 02 — Cadastro, Login e Gerenciamento de Conta — Progress

**Status:** in_progress
**SIs:** 9/16 completed

### SI-02.1 — Fundação HTTP: validação, cookies e formato de erro
- **Status:** completed
- **Tests:** 4 unit (HttpExceptionFilter) + 4 E2E (validation) — all passed
- **Observations:** none

### SI-02.2 — Configuração de autenticação e e-mail (namespaces tipados)
- **Status:** completed
- **Tests:** 8 novos testes em env.validation.spec.ts (JWT_SECRET obrigatório, TTL defaults, cookie defaults) — 32 total passando
- **Observations:** database.integration.spec.ts removido da dependência do schema Joi completo (desacoplamento correto — o teste é de DatabaseModule, não de validação de env)

### SI-02.3 — Entidades User e Channel + migration
- **Status:** completed
- **Tests:** 6 testes de integração em users-channels.migration.integration.spec.ts (colunas, unicidade email/nickname, FK cascade) — 38 total passando
- **Observations:** permissão do diretório de migrations ajustada no container (chmod 777) para geração via CLI

### SI-02.4 — Entidades RefreshToken e PasswordResetToken + migration
- **Status:** completed
- **Tests:** 7 testes de integração em auth-tokens.migration.integration.spec.ts (colunas, jti único, FK cascade para refresh_tokens e password_reset_tokens) — todos passando
- **Observations:** @JoinColumn({ name: 'user_id' }) necessário no @ManyToOne para evitar coluna duplicada userId/user_id na migration gerada; beforeAll de cleanup necessário para idempotência dos testes de integração

### SI-02.5 — PasswordService (hashing argon2id)
- **Status:** completed
- **Tests:** 5 testes unitários em password.service.spec.ts (digest argon2id, salt aleatório, verify true/false/invalid) — todos passando
- **Observations:** argon2 instalado com -u root devido a permissões em node_modules/@emnapi; try/catch em verify garante retorno false sem throw para digests inválidos

### SI-02.6 — PasswordResetTokenService (tokens opacos de reset)
- **Status:** completed
- **Tests:** 9 testes unitários em password-reset-token.service.spec.ts (issue persiste hash; consume aceita token válido e rejeita expirado/usado/ausente; invalidateAll derruba pendentes) — todos passando
- **Observations:** DomainException base criada em src/common/exceptions/domain.exception.ts; HttpExceptionFilter atualizado para mapear DomainException ao formato padrão (code → error, statusCode)

### SI-02.7 — MailModule e templates transacionais
- **Status:** completed
- **Tests:** 4 testes unitários em mail.service.spec.ts (sendConfirmation/sendPasswordReset chamam MailerService.sendMail com template, to e context corretos) — todos passando
- **Observations:** @nestjs-modules/mailer@2.1.19 usado (em vez de 2.x latest) pois 2.3.x exige nodemailer>=8 mas o projeto usa nodemailer@6.x; nest-cli.json atualizado com assets hbs para cópia na build

### SI-02.8 — ChannelService (derivação de nickname a partir do e-mail)
- **Status:** completed
- **Tests:** 7 testes unitários em channel.service.spec.ts (normalizePrefix para vários formatos de e-mail; createForUser cria canal sem colisão, com sufixo aleatório em colisão, com retentativas) — todos passando
- **Observations:** none

### SI-02.9 — Cadastro de usuário (POST /auth/register)
- **Status:** completed
- **Tests:** 6 testes unitários em auth.service.spec.ts (senha hasheada antes de persistir; e-mail duplicado rejeitado com EmailAlreadyExistsException; falha na criação do canal propaga e reverte a transação; retorno com id/email/nickname; e-mail de confirmação enviado com JWT assinado; falha no envio de e-mail não derruba o cadastro) + 4 testes E2E em auth-register.e2e-spec.ts (201 com canal criado; 409 e-mail duplicado; 400 validação de senha curta; e-mail de confirmação capturado no Mailpit) — todos passando
- **Observations:** IE-02.9 depende de IE-02.11 (JwtService) apesar da ordem sugerida no documento listar 02.9 antes de 02.11 — antecipado apenas o registro do JwtModule (JwtModule.registerAsync) em AuthModule; strategies/guards completos ficam para SI-02.11. Corrigidos três gaps pré-existentes descobertos ao rodar o primeiro teste que carrega o AppModule completo: (1) MailModule importava HandlebarsAdapter via caminho `dist/...` que viola o `exports` map do pacote `@nestjs-modules/mailer`, quebrando qualquer teste que importe AppModule; (2) `.env` não tinha JWT_SECRET, exigido pelo schema Joi desde SI-02.2; (3) `buildDatabaseOptions` apontava `entities` para `dist/**/*.entity.js`, inexistente fora de um build de produção — trocado por glob relativo a `__dirname` que funciona tanto em ts-jest/ts-node quanto em dist compilado.

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
