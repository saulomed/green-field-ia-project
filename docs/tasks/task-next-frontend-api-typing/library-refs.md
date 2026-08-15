---
libs:
  "openapi-typescript":
    version: "^7.13.0"
    context7_id: "/websites/openapi-ts_dev"
    fetched_at: "2026-08-15T16:20:00Z"
sources_mtime:
  docs/decisions/technical-decisions-next-frontend-api-typing.md: "2026-08-15T16:15:37Z"
---

# task-next-frontend-api-typing — Library References

Cache de documentação obtida via Context7 para as bibliotecas decididas nesta task. Fonte: `/websites/openapi-ts_dev` (openapi-ts.dev, documentação oficial da linha 7.x).

### openapi-typescript

Decidida por `next-frontend-api-typing/TD-01` (Option A) e usada como base derivacional por `TD-02` (Option B). Instalada como **devDependency** — gera tipos e não tem custo de runtime.

#### Instalação e requisitos

```bash
npm i -D openapi-typescript typescript
```

Node.js 20.x ou superior é o recomendado. O `tsconfig.json` precisa de `module` em `ESNext` ou `NodeNext` e `moduleResolution` em `Bundler` ou `NodeNext` para carregar os tipos corretamente — conferir contra o `tsconfig.json` atual do `next-frontend` antes de assumir que já está compatível.

#### CLI — geração do `.d.ts`

A forma canônica é passar o schema de entrada (JSON ou YAML, local ou URL remota) e o destino via `--output` / `-o`:

```bash
npx openapi-typescript ./path/to/api/v1.yaml -o ./src/lib/api/v1.d.ts
```

Aplicado à TD-01, o comando roda **na raiz do repositório** (fora dos containers), onde os dois subprojetos são visíveis:

```bash
npx openapi-typescript nestjs-project/openapi.json -o next-frontend/lib/api/schema.d.ts
```

Flags adicionais documentadas que podem interessar mais adiante, nenhuma necessária agora: `--read-write-markers` (gera helpers `$Read`/`$Write` para propriedades `readOnly`/`writeOnly`, permitindo derivar `Readable<T>` / `Writable<T>`) e `--make-paths-enum` (gera um enum `ApiPaths` com as rotas literais).

#### Type-check como rede de segurança

A garantia central da `openapi-spec/TD-05` — contrato incompatível quebra o build do frontend — depende de `tsc --noEmit` rodar no CI. A documentação recomenda expor isso como script:

```json
{
  "scripts": {
    "test:ts": "tsc --noEmit"
  }
}
```

#### Forma dos tipos gerados

O arquivo gerado exporta `paths`, `components` e `operations`. É essa estrutura que a TD-02 Option B deriva via `Pick`/`Omit`/`Extract`:

```typescript
import type { paths, components } from "./my-openapi-3-schema" // gerado por openapi-typescript

// Schema por nome
type MyType = components["schemas"]["MyType"]

// Parâmetros de rota
type EndpointParams = paths["/my/endpoint"]["parameters"]

// Corpo de resposta, por status e content-type
type SuccessResponse = paths["/my/endpoint"]["get"]["responses"][200]["content"]["application/json"]["schema"]
type ErrorResponse = paths["/my/endpoint"]["get"]["responses"][500]["content"]["application/json"]["schema"]
```

Os tipos são estaticamente analisáveis e **sem custo de runtime** (com exceções menores, como enums), e a capitalização e a estrutura do schema original são preservadas o mais fielmente possível — ou seja, os nomes de schema do `openapi.json` do NestJS aparecem verbatim em `components["schemas"]`. Isso é o que torna a derivação da TD-02 estável: renomear um DTO no backend quebra o `Pick` em build, que é exatamente o efeito desejado.

#### Nota sobre `openapi-fetch`

`openapi-spec/TD-05` fixou `openapi-fetch` como client junto com `openapi-typescript`, mas nenhum TD desta task o adota — a TD-02 Option B não introduz dependência nova. A documentação instala os dois juntos (`npm i openapi-fetch` como runtime, `openapi-typescript` como dev); quando o client entrar em escopo, sua doc deve ser cacheada aqui pelo resolve da task correspondente.
