---
libs:
  "@nestjs/swagger":
    version: "^11.4.6"
    context7_id: "/nestjs/swagger"
    fetched_at: "2026-08-08T21:25:54Z"
  "@nestjs/config":
    version: "^4.0.4"
    context7_id: "/nestjs/docs.nestjs.com"
    fetched_at: "2026-08-08T21:25:54Z"
  "openapi-typescript":
    version: "^7.13.0"
    context7_id: "/websites/openapi-ts_dev"
    fetched_at: "2026-08-08T21:25:54Z"
  "openapi-fetch":
    version: "^0.17.0"
    context7_id: "/websites/openapi-ts_dev"
    fetched_at: "2026-08-08T21:25:54Z"
sources_mtime:
  docs/decisions/technical-decisions-openapi-spec.md: "2026-08-08T21:32:44Z"
---

# task-openapi-spec — Library References

Cache de documentação Context7 para as libs decididas nos TDs desta task. Versões: `@nestjs/swagger@11.4.6` tem peer `@nestjs/common ^11.0.1`, compatível com o `@nestjs/common@^11.0.1` instalado. `@nestjs/config@^4.0.4` já está no `nestjs-project/package.json`. `openapi-typescript` e `openapi-fetch` ainda **não** estão instalados — a adoção está diferida (ver `## Non-UI / Deferred Capabilities` no context.md).

---

### @nestjs/swagger

Superfícies relevantes aos TD-01, TD-02, TD-03, TD-04, TD-06 e TD-07.

**`DocumentBuilder` — metadados, servers e security schemes (TD-01, TD-03, TD-06).**

```typescript
const config = new DocumentBuilder()
  .setTitle('StreamTube API')
  .setDescription('...')
  .setVersion('1.0.0')
  .setOpenAPIVersion('3.0.0')
  .addServer('https://api.example.com', 'Production')
  .addTag('auth', 'Autenticação e gerenciamento de conta')
  .build();

const document = SwaggerModule.createDocument(app, config);
SwaggerModule.setup('api', app, document);
```

**Cookie auth (TD-06).** `addCookieAuth(cookieName, options, securityName)` declara um `securityScheme` do tipo `apiKey` em cookie:

```typescript
new DocumentBuilder()
  .addCookieAuth('auth_token', { type: 'apiKey' }, 'jwt-cookie')
  .build();
```

O decorator de conveniência para marcar endpoints protegidos é `ApiCookieAuth`:

```
## ApiCookieAuth
### Description
Convenience decorator for Cookie-based authentication.
### Signature
`function ApiCookieAuth(name?: string): ClassDecorator & MethodDecorator`
```

O `name` passado ao decorator deve casar com o `securityName` do `addCookieAuth` (`'jwt-cookie'` no exemplo). O `withCredentials` do "Try it out" é passado via `swaggerOptions` no terceiro argumento de `SwaggerModule.setup`.

**Path do setup (TD-03).** Paths inválidos falham a validação — evitar string vazia e barras duplas:

```typescript
SwaggerModule.setup('', app, document);            // ❌ path vazio
SwaggerModule.setup('//double/slash', app, document); // ❌ barras duplas
SwaggerModule.setup('/api', app, document);         // ✅
SwaggerModule.setup('api/docs', app, document);     // ✅ (barra inicial é adicionada)
```

**CLI plugin (TD-02).** Configuração em `nest-cli.json` sob `compilerOptions.plugins`:

```json
{
  "compilerOptions": {
    "plugins": [
      {
        "name": "@nestjs/swagger",
        "options": {
          "dtoFileNameSuffix": [".dto.ts", ".entity.ts"],
          "controllerFileNameSuffix": ".controller.ts",
          "introspectComments": true,
          "classValidatorShim": true,
          "dtoKeyOfComment": "description",
          "controllerKeyOfComment": "description",
          "introspectDefaultValues": true
        }
      }
    ]
  }
}
```

`classValidatorShim: true` traduz os decorators de `class-validator` já presentes nos DTOs (`@IsEmail`, `@Length`, `@MaxLength`) em restrições OpenAPI. `introspectComments: true` transforma o JSDoc — obrigatório pela convenção do projeto — em `description`.

Quando os metadados do plugin precisam ser consumidos fora do pipeline padrão, existe `SwaggerModule.loadPluginMetadata`:

```
## SwaggerModule.loadPluginMetadata
### Signature
`public static async loadPluginMetadata(metadataFn: () => Promise<Record<string, any>>): Promise<void>`
```

```typescript
await SwaggerModule.loadPluginMetadata(() =>
  import('./generated/swagger-metadata.json')
);
```

**Emissão em disco (TD-04).** Padrão do e2e `validate-schema` do próprio repositório: após `createDocument()`, serializar e escrever com `writeFileSync`, sem `listen()`:

```typescript
const document = SwaggerModule.createDocument(app, options);
const doc = JSON.stringify(document, null, 2);
writeFileSync(join(__dirname, 'api-spec.json'), doc);
```

**Respostas de erro (TD-07).** `@ApiResponse` aceita `status`, `description` e `type`; existem atalhos por status (`@ApiOkResponse`, `@ApiUnauthorizedResponse`, `@ApiBadRequestResponse`, …) que são a base natural para os decoradores compostos via `applyDecorators`:

```typescript
@Get()
@ApiOkResponse({ type: UserDto, isArray: true })
@ApiUnauthorizedResponse({ description: 'Unauthorized' })
@ApiBadRequestResponse({ description: 'Invalid input' })
getUsers() {}
```

```typescript
@ApiResponse({ status: 200, description: 'List of users', type: UserDto, isArray: true })
@ApiResponse({ status: 500, description: 'Internal server error' })
```

---

### @nestjs/config

Superfícies relevantes ao TD-03 (namespace `swagger` com `enabled` + `path`), seguindo o padrão já fixado em `config/TD-01` e `config/TD-02`.

**Namespace com `registerAs`.** O `process.env` é totalmente resolvido dentro da factory:

```typescript
export default registerAs('database', () => ({
  host: process.env.DATABASE_HOST,
  port: process.env.DATABASE_PORT || 5432
}));
```

**Injeção tipada com `ConfigType`:**

```typescript
constructor(
  @Inject(databaseConfig.KEY)
  private dbConfig: ConfigType<typeof databaseConfig>,
) {}
```

**Registro parcial em módulo de feature** (`forFeature`), quando só um módulo consome o namespace:

```typescript
import databaseConfig from './config/database.config';

@Module({
  imports: [ConfigModule.forFeature(databaseConfig)],
})
export class DatabaseModule {}
```

**Validação Joi** — as variáveis novas do namespace `swagger` entram no `validationSchema` existente:

```typescript
ConfigModule.forRoot({
  validationSchema: Joi.object({
    NODE_ENV: Joi.string()
      .valid('development', 'production', 'test', 'provision')
      .default('development'),
    PORT: Joi.number().port().default(3000),
  }),
  validationOptions: {
    allowUnknown: false,
    abortEarly: true,
  },
})
```

---

### openapi-typescript

Superfície relevante ao TD-05 (adoção diferida). CLI que converte a spec em um arquivo de tipos puros, sem custo de runtime.

**Instalação e geração** a partir de arquivo local (o `nestjs-project/openapi.json` do TD-04) ou URL remota:

```bash
npm i -D openapi-typescript typescript
npx openapi-typescript ./path/to/api/v1.yaml -o ./src/lib/api/v1.d.ts
```

O flag de saída é `--output` / `-o`. O tipo exportado consumido pelo client é `paths`.

---

### openapi-fetch

Superfície relevante ao TD-05 (adoção diferida). Wrapper fino sobre `fetch`, tipado pelo `paths` gerado pelo `openapi-typescript`.

```bash
npm i openapi-fetch
```

**Inicialização:**

```typescript
import createClient from "openapi-fetch";
import type { paths } from "./my-openapi-3-schema"; // gerado por openapi-typescript

const client = createClient<paths>({ baseUrl: "https://myapi.dev/v1/" });
```

**Chamadas — `data` e `error` são tipados automaticamente** (`data` só presente em 2XX, `error` só em 4XX/5XX):

```typescript
const { data, error } = await client.GET("/blogposts/{post_id}", {
  params: {
    path: { post_id: "my-post" },
    query: { version: 2 },
  },
});

const { data, error } = await client.PUT("/blogposts", {
  body: { title: "New Post", body: "<p>New post body</p>" },
});
```

O `createClient` repassa opções ao `fetch` nativo — é por aí que o envio do cookie de sessão (`credentials: 'include'`) se conecta ao esquema `addCookieAuth` fixado no TD-06.

> Nota: o Context7 não indexa `openapi-fetch` como biblioteca própria; a documentação canônica vive no site do openapi-ts (`/websites/openapi-ts_dev`), que cobre ambos os pacotes.
