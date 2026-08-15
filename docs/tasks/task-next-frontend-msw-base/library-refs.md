---
libs:
  "vitest":
    version: "^4.1.6"
    context7_id: "/vitest-dev/vitest"
    fetched_at: "2026-08-15T16:10:07-03:00"
  "jsdom":
    version: "^27"
    context7_id: "/jsdom/jsdom"
    fetched_at: "2026-08-15T16:10:07-03:00"
  "msw":
    version: "^2"
    context7_id: "/websites/mswjs_io"
    fetched_at: "2026-08-15T16:10:07-03:00"
  "openapi-msw":
    version: "^1"
    context7_id: "/christoph-fricke/openapi-msw"
    fetched_at: "2026-08-15T16:10:07-03:00"
sources_mtime:
  docs/decisions/technical-decisions-next-frontend-msw-base.md: "2026-08-15 16:08:55.132346818 -0300"
---

# task-next-frontend-msw-base — Library References

Cache de documentação das bibliotecas introduzidas pelas decisões desta task. Recortado para as superfícies que os TDs efetivamente usam.

## vitest

Introduzida por **TD-01** (Option A — `test.projects`, um projeto por lane).

### `test.projects` — a separação de ambientes por glob

`environmentMatchGlobs` e `poolMatchGlobs` foram **removidos no Vitest 4**. A documentação aponta `test.projects` como o substituto. Projetos inline herdam a config raiz quando declaram `extends: true`.

```ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    projects: [
      {
        // "extends: true" herda plugins, alias e demais opções da raiz
        extends: true,
        test: {
          include: ['tests/**/*.{browser}.test.{ts,js}'],
          // recomenda-se nomear o projeto quando a config é inline
          name: 'happy-dom',
          environment: 'happy-dom',
        }
      },
      {
        test: {
          include: ['tests/**/*.{node}.test.{ts,js}'],
          // a cor do rótulo é configurável
          name: { label: 'node', color: 'green' },
          environment: 'node',
        }
      }
    ]
  }
})
```

> `test.workspace` está **depreciado** — a propriedade correta é `test.projects`.

### Alternativa por arquivo (não adotada, TD-01 Option B/C)

Registrada para reconhecimento, não para uso: o Vitest também aceita trocar o ambiente por arquivo via docblock ou comentário, e o valor declarado no arquivo tem precedência sobre a config global.

```js
// @vitest-environment happy-dom
```

```js
/**
 * @vitest-environment jsdom
 */
```

### `environmentOptions`

Opções por ambiente, escopadas pela chave do ambiente:

```js
export default defineConfig({
  test: {
    environmentOptions: {
      jsdom: {
        url: 'http://localhost:3000',
      },
      happyDOM: {
        width: 300,
        height: 400,
      },
    },
  },
})
```

**Relevante para a TD-04:** handlers MSW de caminho relativo resolvem contra o `location` do documento. Sob `jsdom` o default é `http://localhost:3000`; a app deste projeto serve em **3001** (`next -p 3001`, porque a 3000 é do `nestjs-api`). Fixar `environmentOptions.jsdom.url` em `http://localhost:3001` alinha o teste à realidade de runtime.

## jsdom

Introduzida por **TD-02** (Option A). Implementação em JavaScript puro de padrões web (DOM, HTML) para Node.js.

No contexto desta task o `jsdom` não é consumido diretamente — ele é o valor de `environment` do projeto de DOM da TD-01, e o Vitest o instancia. A configuração relevante é a de `environmentOptions.jsdom` documentada na seção do `vitest` acima.

É a implementação que o **guia oficial de testes com Vitest do Next.js** instala. O setup manual documentado pelo Next.js pede, como devDependencies: `vitest`, `@vitejs/plugin-react`, `jsdom`, `@testing-library/react`, `@testing-library/dom` e — para projetos TypeScript — `vite-tsconfig-paths` (que resolve os paths do `tsconfig.json`, dispensando duplicar o alias `@/*` em `resolve.alias`).

> **Limitação oficial, já refletida na skill de testes:** Server Components assíncronos **não são suportados** pelo Vitest. Componentes síncronos (Server ou Client) são testáveis; os assíncronos exigem Playwright.

## msw

Fixada pelo `next-frontend/CLAUDE.md`; citada pela **TD-03** e pela **TD-04**.

### Ciclo de vida do `setupServer`

```javascript
import { setupServer } from 'msw/node'
import { handlers } from './handlers'

const server = setupServer(...handlers)

beforeAll(() => server.listen())
afterEach(() => server.resetHandlers())  // remove overrides de runtime
afterAll(() => server.close())
```

### `onUnhandledRequest: 'error'` — o trilho de segurança

```javascript
server.listen({
  onUnhandledRequest: 'error',
})
```

Faz qualquer request não declarada nos handlers lançar em vez de vazar para a rede — é o que torna absoluta a regra do `CLAUDE.md` de que nenhum teste Vitest abre conexão real com o `nestjs-api`.

### Override por teste com `server.use(...)`

O padrão default + override que a TD-04 preserva: os handlers base cobrem o caminho feliz, e cada teste injeta o desvio de que precisa.

```javascript
afterEach(() => {
  server.resetHandlers()
})

it('handles errors when fetching the user', () => {
  server.use(
    http.get('/user', () => {
      return new HttpResponse(null, { status: 500 })
    })
  )
  // ...
})
```

`resetHandlers()` remove **apenas** os handlers de runtime adicionados via `use()`, preservando os iniciais do `setupServer()`. Pular essa chamada vaza override entre testes — a fonte de flakiness mais comum nesta lane.

### Caminhos relativos vs. absolutos

MSW usa `path-to-regexp` para casar strings. **URLs relativas resolvem contra o `location` do documento**; URLs absolutas exigem casamento completo de esquema, host e path. No Node puro não existe `location` — daí a separação de lanes da TD-01: `mocks/handlers.ts` (upstream, URLs absolutas de `config.api.baseUrl`) roda na lane de `node`, e `mocks/bff-handlers.ts` (rotas relativas `/api/...`) roda na lane de DOM.

Para compor uma base URL sem hardcode, a documentação sugere um helper com o construtor `URL`:

```javascript
function api(path) {
  return new URL(path, config.api.baseUrl).href
}
```

## openapi-msw

Introduzida por **TD-03** (Option A). Wrapper tipado sobre o MSW, construído para consumir a saída do `openapi-typescript`.

### Setup

```typescript
import { createOpenApiHttp } from "openapi-msw";
import type { paths } from "./types/openapi";

const http = createOpenApiHttp<paths>();
```

**Nesta task**, per a sub-decisão da TD-03, `paths` vem **reexportado de `lib/api/contracts.ts`** — nunca importado de `lib/api/schema` diretamente, o que manteria a regra de `next-frontend-api-typing/TD-02` sem carve-out.

### `createOpenApiHttp`

```typescript
function createOpenApiHttp<ApiSpec extends AnyApiSpec>(
  options?: HttpOptions
): OpenApiHttpHandlers<ApiSpec>;

interface HttpOptions {
  baseUrl?: string;   // prefixado a todos os paths dos handlers
}
```

Retorna um objeto com uma fábrica por método (`get`, `post`, `put`, `patch`, `delete`, `head`, `options`) mais `untyped`, que dá acesso direto ao `http` original do MSW.

```typescript
const httpWithBase = createOpenApiHttp<paths>({ baseUrl: "/api/v1" });
```

### Handlers tipados

```typescript
const getResourceHandler = http.get("/resource/{id}", ({ params, response }) => {
  const id = params.id;                       // tipado como string
  return response(200).json({ id, name: "Resource" });
});

const createResourceHandler = http.post(
  "/resource",
  async ({ request, response }) => {
    const data = await request.json();        // corpo tipado pela spec
    return response(201).json(data);
  },
);
```

### A garantia que a TD-03 comprou

Caminho e método são verificados em build contra a spec:

```typescript
// ✓ existe para GET no schema
http.get("/users/{id}", ({ response }) => response(200).json({}));

// ✗ erro de TypeScript — path não definido, ou método errado
http.get("/unknown", ({ response }) => response(200).json({}));
```

E `response(200).json(...)` amarra o corpo ao status declarado — é isso que fará o fixture de `POST /auth/login` acusar de imediato a imprecisão já confirmada na spec do backend (declara `RegisterResponseDto` como resposta 200 do login).

### Escape hatch

Para o que estiver legitimamente fora da spec:

```typescript
const catchAllHandler = http.untyped.all("*/unknown", ({ request }) => {
  return HttpResponse.json({ message: "Caught unknown path", path: request.url });
});
```
