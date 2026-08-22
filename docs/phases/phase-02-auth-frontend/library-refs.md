---
libs:
  "openapi-fetch":
    version: "_[não instalado — fixar no install]_"
    context7_id: "/websites/openapi-ts_dev"
    fetched_at: "2026-08-15T22:00:00Z"
  "react-hook-form":
    version: "_[não instalado — fixar no install]_"
    context7_id: "/react-hook-form/resolvers"
    fetched_at: "2026-08-15T22:00:00Z"
  "@hookform/resolvers":
    version: "_[não instalado — fixar no install]_"
    context7_id: "/react-hook-form/resolvers"
    fetched_at: "2026-08-15T22:00:00Z"
  "zod":
    version: "^4.4.3"
    context7_id: "/colinhacks/zod"
    fetched_at: "2026-08-15T22:00:00Z"
  "@playwright/test":
    version: "_[não instalado — fixar no install]_"
    context7_id: "/microsoft/playwright"
    fetched_at: "2026-08-15T22:00:00Z"
  "@nestjs/swagger":
    version: "^11.4.6"
    context7_id: "/nestjs/swagger"
    fetched_at: "2026-08-22T14:36:00Z"
  "openapi-typescript":
    version: "7.13.0"
    context7_id: "/websites/openapi-ts_dev"
    fetched_at: "2026-08-22T14:36:00Z"
sources_mtime:
  docs/decisions/technical-decisions-auth-frontend.md: "2026-08-18T22:04:39Z"
  docs/decisions/technical-decisions-http-error-contract.md: "2026-08-22T14:35:43Z"
---

# phase-02-auth-frontend — Library References

Cache de documentação das bibliotecas decididas neste slice. Materializado por `/plan-resolve auth-frontend` em 2026-08-15, logo após as 10 TDs saírem de `_[pending]_`.

## openapi-fetch

Decidida por `auth-frontend/TD-02`. Vive nos route handlers do BFF, do lado servidor — o browser nunca a alcança.

### Inicialização

```typescript
import createClient from "openapi-fetch";
import type { paths } from "./my-openapi-3-schema"; // gerado por openapi-typescript

const client = createClient<paths>({ baseUrl: "https://myapi.dev/v1/" });
```

Neste projeto o `paths` vem de `next-frontend/lib/api/schema.d.ts` (gerado por `scripts/generate-api-types.sh`, nunca editado à mão) e o `baseUrl` de `config.api.baseUrl` — que por `next-frontend-env-config/TD-04` resolve para `http://nestjs-api:3000`, o nome do serviço no Compose.

### Forma da resposta

```typescript
const {
  data,  // presente apenas em resposta 2XX
  error, // presente apenas em 4XX ou 5XX
} = await client.GET("/blogposts/{post_id}", {
  params: { path: { post_id: "123" } },
});
```

### Middleware — o ponto único das TD-03 e TD-04

```typescript
import createClient, { type Middleware } from "openapi-fetch";

const authMiddleware: Middleware = {
  async onRequest({ request }) {
    request.headers.set("Authorization", `Bearer ${accessToken}`);
    return request;
  },
};

client.use(authMiddleware);
```

`client.use(middleware)` é onde a `TD-03` (reemissão de cookie) e a `TD-04` (retry no 401 com single-flight) se implementam **uma vez**, em vez de repetidas por handler.

### Armadilha documentada — `onError` não pega 4xx/5xx

> `onError` does not handle error responses with `4xx` or `5xx` HTTP status codes, since these are considered "successful" responses but with a bad status code. In these cases you need to check the response's status property or `ok()` method via the `onResponse` callback.

Ou seja: **o retry de refresh da `TD-04` vive em `onResponse`, não em `onError`.** Um `onError` só dispara em falha de rede/parse. Para lançar em resposta não-ok:

```typescript
onResponse({ response }) {
  if (!response.ok) {
    throw new Error(`${response.url}: ${response.status} ${response.statusText}`);
  }
}
```

Note que `onResponse` recebe o `Response` cru — que é exatamente o que a `TD-03` precisa para alcançar `response.headers.getSetCookie()`.

---

## react-hook-form + @hookform/resolvers

Decididas por `auth-frontend/TD-06`. Rodam em Client Components (`"use client"`), nas três telas do slice.

### Integração com Zod

```typescript
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

const schema = z.object({
  email: z.string().email(),
  name: z.string().min(1),
});

export function MyForm() {
  const { register, handleSubmit, formState: { errors } } = useForm({
    resolver: zodResolver(schema),
  });

  return (
    <form onSubmit={handleSubmit((data) => console.log(data))}>
      <input {...register('name')} />
      {errors.name && <p>{errors.name.message}</p>}
      <button type="submit">Submit</button>
    </form>
  );
}
```

O `errors.<campo>.message` é o que alimenta o estado de erro inline do `TextField` decidido em OQ-19.

### Tipos de entrada e saída divergentes

Quando o schema transforma (`.default()`, `.coerce`), entrada e saída diferem e o `useForm` precisa dos três genéricos:

```typescript
const schema = z.object({ age: z.coerce.number() });

useForm<
  z.input<typeof schema>,   // { age: string }
  unknown,
  z.output<typeof schema>   // { age: number }
>({ resolver: zodResolver(schema) });
```

### Múltiplos erros por campo

Relevante para a política de senha do cadastro, onde mais de uma regra pode falhar ao mesmo tempo:

```typescript
const { register, formState: { errors } } = useForm({
  resolver: zodResolver(schema),
  criteriaMode: 'all',
});

// errors.password?.types → { too_small: "...", invalid_string: "..." }
```

O resolver aceita `ParseParams` do Zod 3 **e** do Zod 4 — este projeto está no 4.

---

## zod

**Já instalado: `^4.4.3`.** Decidida por `auth-frontend/TD-06` como origem do schema de validação.

### Amarrar o schema ao contrato — o ponto central da TD-06

A `TD-06` exige que o schema seja **tipado contra `contracts.ts`**, não escrito solto, para que uma mudança no contrato do backend quebre o `tsc --noEmit` em vez de o formulário passar a postar um corpo errado em silêncio.

> **Atenção de versão.** A documentação recuperada mostra a assinatura de **Zod 3**, `z.ZodType<Output, z.ZodTypeDef, Input>`. Este projeto está em **Zod 4**, onde o genérico é `z.ZodType<Output, Input>` (o parâmetro `ZodTypeDef` do meio deixou de existir). Ao implementar, usar a forma de duas posições e confirmar contra a doc da v4 — não copiar o exemplo de três posições abaixo verbatim.

Exemplo recuperado (v3, para referência da mecânica, **não** da assinatura):

```ts
const schema: z.ZodType<Output, z.ZodTypeDef, Input> = baseSchema.extend({
  children: z.lazy(() => schema.array()),
});
```

### Extrair o tipo de um schema

```typescript
type Out = z.output<typeof schema>; // z.infer é alias de z.output
type In  = z.input<typeof schema>;
```

Útil para o caminho inverso: provar que o schema produz exatamente o tipo derivado em `contracts.ts`.

### `z.custom<T>()`

Cria schema para um tipo TypeScript arbitrário, com predicado opcional:

```ts
const decimalSchema = z.custom<Decimal>((val) => Decimal.isDecimal(val));
```

---

## @playwright/test

Decidida por `auth-frontend/TD-08` (stack completo) e `auth-frontend/TD-10` (dados únicos por execução).

### `webServer` e `baseURL`

```typescript
import { defineConfig } from '@playwright/test';

export default defineConfig({
  webServer: {
    command: 'npm run start',
    url: 'http://localhost:3000',
    timeout: 120 * 1000,
    reuseExistingServer: !process.env.CI,
  },
  use: {
    baseURL: 'http://localhost:3000/',
  },
});
```

Campos de `webServer` relevantes aqui: `command`, `url` **ou** `port` (um dos dois), `cwd`, `env`, `reuseExistingServer`, `timeout` (padrão 60000), `gracefulShutdown`, `wait.stdout` (regex a aguardar na saída).

> **Ponto de atenção para a TD-08.** O `webServer` do Playwright **sobe um servidor**. A `TD-08` decidiu rodar contra o stack do Compose já de pé (`nestjs-api` + `db` + `mailpit`). As duas coisas se conciliam de duas formas: (a) omitir `webServer` e apontar `baseURL` para o serviço já em execução, deixando o `docker compose up` como pré-requisito externo da suíte; ou (b) usar `webServer` com `reuseExistingServer: true` para que ele não tente subir nada quando a porta já responde. A escolha entre as duas é detalhe de implementação, não uma TD — o `/plan-build` decide ao escrever a SI.

### Dados únicos por execução (TD-10)

A `TD-10` decidiu não resetar o banco entre execuções; cada teste cria o que precisa com identificadores únicos. Para artefatos temporários em disco, o Playwright já oferece caminho isolado por teste:

```javascript
test('example test', async ({}, testInfo) => {
  const file = testInfo.outputPath('dir', 'temporary-file.txt');
});
```

Para os e-mails únicos que a `TD-10` exige, a unicidade precisa vir do próprio teste (timestamp/uuid no local-part do endereço) — não há primitiva do Playwright para isso.

### Variáveis de ambiente na config

```typescript
import dotenv from 'dotenv';
dotenv.config({ path: path.resolve(__dirname, '.env') });

export default defineConfig({
  use: { baseURL: process.env.STAGING === '1' ? '...' : '...' },
});
```

---

## `@nestjs/swagger` ^11.4.6

_Acrescentada em 2026-08-22 por `http-error-contract/TD-03` (Option A — enum de códigos de domínio emitido na spec). Instalada no `nestjs-project`, não no `next-frontend` — entra neste cache porque a slice de frontend depende do que a spec emite. `context7_id: /nestjs/swagger`._

### Enum na spec — o que a TD-03 exige

A TD-03 decidiu que os códigos de domínio (`EMAIL_JA_EXISTE`, `CREDENCIAIS_INVALIDAS`, …) viram enum no backend e chegam ao frontend pela spec. O decorador que produz isso:

```typescript
enum PetType {
  CAT = 'cat',
  DOG = 'dog',
  BIRD = 'bird'
}

export class PetDto {
  @ApiProperty({
    enum: PetType,
    enumName: 'PetTypeEnum',
    description: 'Type of pet'
  })
  type: PetType;
}
```

**`enumName` é opcional mas recomendado** — a doc é explícita nisso ("optional but recommended for better schema generation"). Sem ele, o enum é inlined no schema da propriedade; com ele, vira um componente nomeado em `components.schemas`, que é o que permite ao frontend derivar o tipo por nome em vez de cavar o caminho inteiro do endpoint. Para a `auth-frontend/TD-11`, que quer a tabela código→campo tipada contra o contrato, o componente nomeado é o que torna a derivação estável.

A forma sem enum TypeScript, direto por literais, também vale:

```typescript
export class QueryDto {
  @ApiProperty({
    enum: ['asc', 'desc'],
    description: 'Sort order',
    example: 'asc'
  })
  sort?: 'asc' | 'desc';
}
```

### `details` opcional — o array de objetos da TD-01

A TD-01 Option B pede `details?: [{ field, message }]`. O par de decoradores:

- `@ApiProperty()` — propriedade obrigatória.
- `@ApiPropertyOptional()` — propriedade opcional; é o correto para `details`, que só existe quando o erro tem granularidade por campo.

```typescript
export class PetDto {
  @ApiProperty({ example: 1 })
  id: number;

  @ApiProperty({ enum: ['cat', 'dog', 'bird'] })
  type: string;

  @ApiPropertyOptional({ type: [String] })
  tags?: string[];
}
```

Para um array de **objetos** (e não de strings), o caminho é `type: [ClassDoItem]` com uma classe dedicada ao item — no caso, uma `ErrorDetailDto { field: string; message: string }` decorada com `@ApiProperty` em cada campo, referenciada como `@ApiPropertyOptional({ type: [ErrorDetailDto] })`. Isso emite `$ref` para o componente do item, que é o que faz o `openapi-typescript` gerar um tipo nomeado em vez de um objeto anônimo repetido.

### `ApiPropertyOptions` — campos relevantes

```typescript
interface SchemaObjectMetadata {
  type?: Type<unknown> | Function | [Function] | string;
  isArray?: boolean;
  required?: boolean;
  enum?: any[];
  enumName?: string;
  description?: string;
  example?: any;
  nullable?: boolean;
  items?: any;
  // … minimum/maximum/minLength/maxLength/pattern/deprecated/readOnly/writeOnly
}
```

`enumName` vive num ramo separado do tipo (`{ enumName: string; enumSchema?: EnumSchemaAttributes }`), o que confirma que nomear o enum é um modo de uso de primeira classe, não um extra.

### Conflito com a convenção do projeto — atenção

A seção "Best Practices" da doc recomenda `@ApiProperty` em **todos** os campos de DTO. A `openapi-spec/TD-02` decidiu o oposto para este repositório: o **CLI plugin** infere a maioria dos campos a partir do `class-validator`, e `@ApiProperty()` fica reservado para exemplos e casos ambíguos. Um enum nomeado é exatamente um caso ambíguo — o plugin não tem como adivinhar `enumName` —, então decorar o campo `error` explicitamente está dentro da convenção, não contra ela. Não estenda isso para os demais campos do `ErrorResponseDto`.

---

## `openapi-typescript` 7.13.0

_Acrescentada em 2026-08-22 por `http-error-contract/TD-03`. Versão pinada em `scripts/generate-api-types.sh` (`OPENAPI_TYPESCRIPT_VERSION="7.13.0"`) — **não existe no `package.json` de nenhum subprojeto**, é invocada por `npx --yes` no host. O script é o dono único do pin. `context7_id: /websites/openapi-ts_dev`._

### Derivar tipos do arquivo gerado

É o mecanismo pelo qual a `auth-frontend/TD-11` e a `next-frontend-api-typing/TD-02` obtêm o tipo do corpo de erro sem escrever nada à mão:

```typescript
import type { paths, components } from "./my-openapi-3-schema"; // gerado por openapi-typescript

// Schema Obj
type MyType = components["schemas"]["MyType"];

// Path params
type EndpointParams = paths["/my/endpoint"]["parameters"];

// Response obj
type SuccessResponse =
  paths["/my/endpoint"]["get"]["responses"][200]["content"]["application/json"]["schema"];
type ErrorResponse =
  paths["/my/endpoint"]["get"]["responses"][500]["content"]["application/json"]["schema"];
```

O acesso por `components["schemas"][...]` é o que torna o `enumName` da seção anterior load-bearing: com o enum nomeado, o catálogo de códigos é `components["schemas"]["ErrorCodeEnum"]`; sem ele, só se alcança o tipo cavando o caminho completo de um endpoint específico, e a tabela código→campo passaria a depender de qual rota foi usada para derivá-la.

### Enums — a flag `--enum` e o formato de saída

Por padrão o gerador **não** emite `enum` do TypeScript; emite união de literais. Para emitir enums reais é preciso passar `--enum` na geração:

```ts
enum ErrorCode {
  // User is not authorized
  Unauthorized = 100
  // User has no access to this resource
  AccessDenied = 200
  // Something went wrong
  Unknown = 300
}
```

Os nomes e comentários acima vêm de extensões declaradas na própria spec:

```yaml
ErrorCode:
  type: integer
  format: int32
  enum:
    - 100
    - 200
    - 300
  x-enum-varnames:
    - Unauthorized
    - AccessDenied
    - Unknown
  x-enum-descriptions:
    - "User is not authorized"
    - "User has no access to this resource"
    - "Something went wrong"
```

**Consequência para este projeto:** `scripts/generate-api-types.sh` hoje invoca `npx openapi-typescript "$SPEC" -o "$OUT"` **sem** `--enum`. Isso é o comportamento correto para a TD-03 — a união de literais (`"EMAIL_JA_EXISTE" | "CREDENCIAIS_INVALIDAS" | …`) é o que dá exaustividade no `switch` do frontend sem introduzir um valor de runtime no bundle. Não acrescente `--enum` sem reabrir a decisão: um `enum` do TypeScript é emitido como objeto em runtime, o que contraria o custo-zero que a `openapi-spec/TD-05` escolheu.

### União discriminada — quando o envelope variar

Se o envelope de erro vier a ter formas distintas por status, `oneOf` sozinho gera a união limpa:

```typescript
Pet: components["schemas"]["Cat"] | components["schemas"]["Dog"] | components["schemas"]["Rabbit"];
```

E `allOf` dentro de cada variante mantém as propriedades comuns num lugar só, permitindo discriminar pelo campo literal:

```typescript
Cat: { type?: "cat"; } & components["schemas"]["PetCommonProperties"];
```

Não é necessário hoje — a TD-01 Option B fixou um envelope único com `details` opcional —, mas é o caminho se o `details` opcional se mostrar insuficiente e o envelope precisar se dividir por tipo de erro.
