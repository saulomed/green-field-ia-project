# Phase 02 — Cadastro, Login e Gerenciamento de Conta — Progress

**Status:** in_progress
**SIs:** 11/16 completed

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
- **Status:** completed
- **Tests:** 7 testes unitários em auth.service.spec.ts (confirmAccount: ativa conta pendente com token válido; rejeita JWT expirado/inválido; rejeita purpose diferente de "confirm"; rejeita conta já confirmada — resendConfirmation: reenvia e-mail com novo JWT para conta pendente; não reenvia para conta já confirmada; resolve neutro sem lançar quando e-mail não existe) + 5 testes E2E em auth-confirm.e2e-spec.ts (204 e isConfirmed=true com token válido; 400 TOKEN_INVALIDO para JWT inválido; 409 EMAIL_JA_CONFIRMADO em replay; 204 neutro com reenvio efetivo para conta pendente; 204 neutro para e-mail inexistente) — todos passando
- **Observations:** EmailAlreadyConfirmedException criada reaproveitando o padrão DomainException; InvalidTokenException (já existente desde SI-02.6) reaproveitada tanto para JWT inválido/expirado quanto para purpose incorreto. Extraído test/support/mailpit.ts com helpers de polling (awaitMessageTo, awaitMessageCountTo) compartilhados entre auth-register.e2e-spec.ts e auth-confirm.e2e-spec.ts, evitando duplicação agora que duas specs precisam consultar o Mailpit.

### SI-02.11 — Infraestrutura Passport/JWT (strategies e guards)
- **Status:** completed
- **Tests:** 5 testes unitários em jwt.strategy.spec.ts (cookieExtractor lê o token do cookie access_token; retorna null sem cookie/sem access_token; validate retorna o payload como está) + 2 testes unitários em local.strategy.spec.ts (validate retorna o usuário em credenciais válidas; lança UnauthorizedException em credenciais inválidas) — todos passando
- **Observations:** Instalados @nestjs/passport, passport, passport-local, passport-jwt (+ @types/passport-local, @types/passport-jwt). PassportModule registrado em AuthModule; JwtModule.registerAsync já existia desde SI-02.9. Adicionado AuthService.validateCredentials (busca usuário por e-mail + PasswordService.verify) para o LocalStrategy reaproveitar. JwtStrategy extrai o access token do cookie `access_token` via extractor customizado (não há suporte nativo a cookie no passport-jwt) e apenas repassa o payload decodificado — a resolução do usuário completo fica para quando SI-02.13/02.14 precisarem dele. A instalação de @types/passport-jwt trouxe uma versão mais nova de @types/jsonwebtoken cujo `expiresIn` mudou de `string` para `StringValue` (do pacote `ms`); corrigido tipando apenas `jwtAccessTtl` e `confirmTokenTtl` como `StringValue` em `auth.config.ts` — os únicos dois campos realmente consumidos por `JwtService.signAsync`/`registerAsync` — mantendo `jwtRefreshTtl` (ainda não usado) e `resetTokenTtl` (consumido por `parseTtlToMs`, que espera `string` puro) com o tipo original. Extraída constante `AUTH_COOKIES.ACCESS_TOKEN` em `auth.constants.ts` para o nome do cookie, reaproveitada pelo `cookieExtractor`, evitando o literal `'access_token'` solto. Avaliada e descartada a sugestão de unificar `AccessTokenPayload` (JwtStrategy) com `ConfirmTokenPayload` (AuthService) num tipo compartilhado — o formato real do access token só será definido quando SI-02.12 implementar `SessionService.issuePair`, seguindo o mesmo princípio já aplicado em SI-02.10 de não desenhar para requisitos futuros ainda não concretizados.

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
