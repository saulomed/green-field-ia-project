---
libs:
  "@nestjs/jwt":
    version: "^11.0.2"
    context7_id: "/nestjs/docs.nestjs.com"
    fetched_at: "2026-08-22T13:01:14Z"
  "@nestjs/passport":
    version: "^11.0.5"
    context7_id: "/nestjs/docs.nestjs.com"
    fetched_at: "2026-08-22T13:01:14Z"
  "passport-jwt":
    version: "^4.0.1"
    context7_id: "/mikenicholson/passport-jwt"
    fetched_at: "2026-08-22T13:01:14Z"
  "passport-local":
    version: "^1.0.0"
    context7_id: "/nestjs/docs.nestjs.com"
    fetched_at: "2026-08-22T13:01:14Z"
  "cookie-parser":
    version: "^1.4.7"
    context7_id: "/nestjs/docs.nestjs.com"
    fetched_at: "2026-08-22T13:01:14Z"
  "typeorm":
    version: "^0.3.30"
    context7_id: "/nestjs/typeorm"
    fetched_at: "2026-08-22T13:01:14Z"
  "argon2":
    version: "^0.41.1"
    context7_id: "/ranisalt/node-argon2"
    fetched_at: "2026-08-22T13:01:14Z"
  "@nestjs-modules/mailer":
    version: "^2.1.19"
    context7_id: "/nest-modules/mailer"
    fetched_at: "2026-08-22T13:01:14Z"
  "nodemailer":
    version: "^6.10.1"
    context7_id: "/nodemailer/nodemailer-homepage"
    fetched_at: "2026-08-22T13:01:14Z"
  "handlebars":
    version: "^4.7.9"
    context7_id: "/handlebars-lang/handlebars.js"
    fetched_at: "2026-08-22T13:01:14Z"
  "@nestjs/throttler":
    version: "^6.5.0"
    context7_id: "/nestjs/docs.nestjs.com"
    fetched_at: "2026-08-22T13:01:14Z"
  "class-validator":
    version: "^0.14.4"
    context7_id: "/typestack/class-validator"
    fetched_at: "2026-08-22T13:01:14Z"
  "@nestjs/swagger":
    version: "^11.4.6"
    context7_id: "/nestjs/docs.nestjs.com"
    fetched_at: "2026-08-22T13:01:14Z"
  "openapi-typescript":
    version: "7.13.0"
    context7_id: "/websites/openapi-ts_dev"
    fetched_at: "2026-08-22T13:01:14Z"
sources_mtime:
  docs/decisions/technical-decisions-auth.md: "2026-08-22T12:55:20Z"
  docs/decisions/technical-decisions-http-error-contract.md: "2026-08-22T12:55:46Z"
---

# phase-02-auth — Library Reference Cache

_Docs buscadas via Context7 para as versões efetivamente instaladas em `nestjs-project/package.json` (e, para `openapi-typescript`, para a versão pinada em `scripts/generate-api-types.sh`). Cobre as 14 bibliotecas citadas pelas 22 TDs decididas no escopo da slice._

## Backend — autenticação e sessão

### @nestjs/jwt

Fonte da TD: `auth/TD-01` (JWT stateless), `auth/TD-04` (refresh com rotação), `auth/TD-06` (tokens de confirmação/reset).

`JwtModule.register({ global: true, secret, signOptions: { expiresIn } })` deixa o `JwtService` disponível em toda a aplicação sem import explícito nos módulos consumidores. Para segredo vindo de config tipada (exigido por `config/TD-01`), usar `registerAsync` com `inject: [authConfig.KEY]` em vez de um `constants.ts` literal — a doc oficial usa constante literal apenas por didática e marca explicitamente que ela não deve ir para produção.

Verificação: `await jwtService.verifyAsync(token)` lança quando a assinatura ou a expiração falham; o payload decodificado é o valor de retorno. `auth/TD-12` fixa os TTLs (15min access / 7d refresh / 24h confirmação / 1h reset), que entram como `expiresIn` por tipo de token.

### @nestjs/passport + passport-local

Fonte da TD: `auth/TD-02` (Passport como abordagem).

`LocalStrategy extends PassportStrategy(Strategy)` com `Strategy` importada de `passport-local`; o método `validate(username, password)` delega ao `AuthService` e lança `UnauthorizedException` quando não confere. O guard idiomático é uma classe nomeada — `class LocalAuthGuard extends AuthGuard('local') {}` — em vez de `@UseGuards(AuthGuard('local'))` com string mágica.

Nota para `auth/TD-16`/`auth/TD-11`: a `validate()` do local strategy é onde o retorno vira `request.user`; devolver o objeto de domínio inteiro expõe campos como o hash da senha, então retorne o shape mínimo.

### passport-jwt

Fonte da TD: `auth/TD-02` combinada com `auth/TD-03` (token em cookie httpOnly).

O default `ExtractJwt.fromAuthHeaderAsBearerToken()` **não serve** para esta fase: `auth/TD-03` decidiu cookie httpOnly. A doc oficial documenta o extractor customizado exatamente para esse caso:

```js
const cookieExtractor = (req) => (req && req.cookies) ? req.cookies['jwt'] : null;
opts.jwtFromRequest = cookieExtractor;
```

Extractors disponíveis: `fromHeader`, `fromBodyField`, `fromUrlQueryParameter`, `fromAuthHeaderWithScheme`, `fromAuthHeaderAsBearerToken`, `fromExtractors([...])` (tenta em ordem). Opções relevantes do `JwtStrategy`: `secretOrKey`, `jwtFromRequest` (obrigatória), `algorithms`, `ignoreExpiration`, `passReqToCallback`.

### cookie-parser

Fonte da TD: `auth/TD-03` (armazenamento do token no cliente), `auth/TD-15` (`SameSite=Strict`).

**Sem entrada própria no Context7** — não há doc indexada para o middleware do Express. O que está registrado aqui vem da doc de cookies do NestJS e do README do `passport-jwt`: o middleware popula `req.cookies`, que é a superfície de que o extractor customizado acima depende. Consequência prática: `app.use(cookieParser())` precisa vir antes de qualquer guard JWT, senão `req.cookies` é `undefined` e o extractor devolve `null` silenciosamente.

### argon2

Fonte da TD: `auth/TD-05` (argon2id).

`await argon2.hash(senha, { type: argon2.argon2id })` — o hash resultante é uma string PHC (`$argon2id$v=19$m=...,t=...,p=...$salt$hash`) que já embute os parâmetros, então **não é preciso persistir salt nem custo em colunas separadas**. Verificação: `await argon2.verify(hash, senha)` devolve booleano e lança só em falha interna.

Parâmetros recomendados pela própria doc: `hashLength: 32`, `timeCost: 3`, `memoryCost: 65536` (64 MiB), `parallelism: 4`, `type: argon2id`. O default da lib já é argon2id. Atenção ao alerta de `auth/TD-05`: é binding nativo, então a imagem Docker precisa das toolchains de build.

### @nestjs/throttler

Fonte da TD: `auth/TD-08` (rate limiting), `auth/TD-13` (valores).

`ThrottlerModule.forRoot([...])` aceita **array de configurações nomeadas** — exatamente o que `auth/TD-13` pede, com limites distintos por fluxo:

```ts
ThrottlerModule.forRoot([
  { name: 'short',  ttl: 1000,  limit: 3 },
  { name: 'medium', ttl: 10000, limit: 20 },
  { name: 'long',   ttl: 60000, limit: 100 },
])
```

Override por rota: `@Throttle({ default: { limit: 3, ttl: 60000 } })`. Para nomeadas, a chave do objeto é o `name`. `@SkipThrottle()` desliga por classe ou rota, e aceita objeto para pular apenas conjuntos específicos. Outras opções: `blockDuration`, `ignoreUserAgents`, `skipIf`.

## Backend — persistência

### typeorm

Fonte da TD: `auth/TD-04`, `auth/TD-18` (dono da persistência de `User`), `auth/TD-19` (participação em transação).

`TypeOrmModule.forRootAsync({ imports, inject, useFactory })` é o caminho para configuração vinda de config tipada — coerente com `config/TD-04` (`buildDatabaseOptions` compartilhada). **Atenção:** o exemplo oficial usa `synchronize: NODE_ENV !== 'production'`, que **contraria a convenção herdada da Fase 01** (`synchronize: false` sempre, mudanças só por migration). Seguir a convenção do projeto, não o exemplo.

Para `auth/TD-19` (padrão híbrido `metodo(args, manager?)`): `@InjectEntityManager()` injeta o `EntityManager`, e `entityManager.transaction(async (m) => { ... })` dá o manager transacional a repassar aos serviços de domínio. Repositório comum via `@InjectRepository(Entity)`.

## Backend — e-mail transacional

### @nestjs-modules/mailer

Fonte da TD: `auth/TD-07` (mailer sobre SMTP).

`MailerModule.forRootAsync` com `ConfigService`/config tipada:

```ts
MailerModule.forRootAsync({
  imports: [ConfigModule], inject: [ConfigService],
  useFactory: (config) => ({
    transport: { host: config.get('MAIL_HOST'), port: config.get('MAIL_PORT'),
                 auth: { user: ..., pass: ... } },
    defaults: { from: config.get('MAIL_FROM') },
    template: { dir: __dirname + '/templates', adapter: new HandlebarsAdapter(), options: { strict: true } },
  }),
})
```

Envio com template: `mailerService.sendMail({ to, subject, template: 'welcome', context: { name, code } })` — `template: 'welcome'` resolve para `templates/welcome.hbs`. O `subject` também aceita interpolação. Anexos e imagens inline via `attachments` com `cid`.

Lembrete do `CLAUDE.md`: o host é o nome do serviço Compose (`mailpit`), nunca `localhost`.

### nodemailer

Fonte da TD: `auth/TD-07` (transporte por baixo do mailer).

`nodemailer.createTransport({ host, port, secure, auth })`. `secure: true` usa TLS desde a conexão (porta 465); `secure: false` usa STARTTLS (porta 587). Para o Mailpit local, sem auth e sem TLS. `tls: { rejectUnauthorized: false }` cobre certificado self-signed em dev.

Pooling (`pool: true`, `maxConnections`, `maxMessages`) não é necessário no volume desta fase; relevante se o envio virar assíncrono numa fase futura. A doc é enfática: criar **um** transporter e reusá-lo, nunca um por mensagem.

### handlebars

Fonte da TD: `auth/TD-07` (adapter de template do mailer).

`Handlebars.compile(source)` devolve uma função que recebe o objeto de contexto. `{{expr}}` escapa HTML; `{{{expr}}}` não escapa — relevante para os e-mails de confirmação e reset, onde o link vai dentro de `href`: use `{{url}}` (escapado) e monte o `<a>` no template, nunca `{{{html}}}` com HTML montado no service.

O adapter do `@nestjs-modules/mailer` compila os `.hbs` do diretório configurado; `options: { strict: true }` faz variável ausente no contexto lançar em vez de renderizar vazio — desejável para não enviar e-mail com link em branco.

## Cross-layer — contrato e validação

### class-validator

Fonte da TD: `auth/TD-11` (política de senha), e consumida por `http-error-contract/TD-02`.

Decoradores relevantes: `@IsEmail()`, `@Length(8, 128)`, `@MinLength`, `@MaxLength`, `@Matches(regex)`. `auth/TD-11` decidiu mín. 8 / máx. 128 **sem exigência de complexidade**, então `@Length(8, 128)` sozinho — não acrescentar `@Matches` de complexidade.

**Shape do erro — load-bearing para `http-error-contract/TD-01` e `TD-02`:** `validate()` devolve `ValidationError[]`, e cada erro tem `property` (o nome do campo) e `constraints` (mapa `nomeDaRegra → mensagem`), além de `children` para objetos aninhados. É desse par `property` + `Object.values(constraints)` que o filtro deve montar o `details: [{ field, message }]` decidido em `TD-01 Option B`, em vez de repassar o array cru que o `ValidationPipe` põe hoje em `message`.

### @nestjs/swagger

Fonte da TD: `http-error-contract/TD-03` (enum de códigos na spec), herdada de `openapi-spec/TD-01` a `TD-07`.

`@ApiResponse({ status, description })` documenta cada resposta de erro por endpoint — é o decorador que `openapi-spec/TD-07` criou e que `http-error-contract/TD-03` exige que passe a referenciar o enum de códigos.

Para o enum na spec: `@ApiProperty({ enum: ErrorCode })` (ou `enum: ['A','B']` com array literal). Com o CLI plugin de `openapi-spec/TD-02`, o `@ApiProperty` fica reservado a casos que a inferência não cobre — e um enum de códigos de domínio é exatamente um desses casos, porque o tipo TS sozinho não diz ao gerador quais valores emitir.

Genéricos (envelope + payload variável) usam `allOf` com `getSchemaPath()` — relevante se o envelope de `TD-01` for tipado genericamente na spec.

### openapi-typescript

Fonte da TD: `http-error-contract/TD-03` (frontend deriva o enum da spec). Versão **7.13.0**, pinada em `scripts/generate-api-types.sh` (não está em nenhum `package.json` — o script é o dono único do pin, per `next-frontend-api-typing/TD-01`).

CLI: `npx openapi-typescript ./spec.json -o ./lib/api/schema.d.ts` — é o que `scripts/generate-api-types.sh` encapsula.

**Enums:** por padrão a lib emite uniões de string literal, não `enum` TS. A flag `--enum` faz emitir `enum` de verdade, e `x-enum-varnames` / `x-enum-descriptions` na spec controlam os nomes e comentários dos membros. Para `TD-03`, a união de literais já basta para o `switch` no frontend quebrar no `tsc` quando um código some — não é preciso ligar `--enum` nem mudar o script. Registrado aqui porque é a pergunta que vai surgir na implementação.
