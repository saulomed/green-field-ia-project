---
libs:
  "@t3-oss/env-nextjs":
    version: "not installed — to be added to next-frontend/package.json"
    context7_id: "/t3-oss/t3-env"
    fetched_at: "2026-08-09T18:41:02Z"
  "zod":
    version: "^4 — not installed; docs fetched against v4.0.1"
    context7_id: "/colinhacks/zod/v4.0.1"
    fetched_at: "2026-08-09T18:41:02Z"
  "@next/env":
    version: "aligned with next@16.2.12 (transitive today; needs explicit dependency entry)"
    context7_id: "/vercel/next.js/v16.2.2"
    fetched_at: "2026-08-09T18:41:02Z"
sources_mtime:
  docs/decisions/technical-decisions-next-frontend-env-config.md: "2026-08-10T10:30:53Z"
---

# Library References — task-next-frontend-env-config

Cache de documentação para as bibliotecas decididas nesta task. Nenhuma das três está instalada em `next-frontend/package.json` hoje — a instalação é trabalho de implementação.

### @t3-oss/env-nextjs

Decidida em `next-frontend-env-config/TD-01` (Option C). Superfície relevante: `createEnv` com separação server/client e enforcement da fronteira.

`createEnv` aceita quatro blocos relevantes ao caso desta task:

- `server` — chaves acessíveis apenas server-side. Acesso a partir do browser dispara `onInvalidAccess`.
- `client` — chaves públicas; o prefixo `NEXT_PUBLIC_` é **imposto em tipo e em runtime** pelo pacote `env-nextjs` (o pacote genérico `env-core` exige declarar `clientPrefix` manualmente).
- `shared` — chaves visíveis dos dois lados (tipicamente `NODE_ENV`).
- `experimental__runtimeEnv` — para Next.js ≥ 13.4.4, apenas as variáveis **client** e **shared** precisam ser destructuradas literalmente. É essa destructuração literal que garante que o inlining em build time do Next enxergue a chave; sem ela, a variável pública vira `undefined` no bundle.

```ts
// lib/env.ts
import { createEnv } from "@t3-oss/env-nextjs"
import * as z from "zod"

export const env = createEnv({
  server: {
    API_BASE_URL: z.url(),
  },
  client: {},
  shared: {
    NODE_ENV: z.enum(["development", "production", "test"]),
  },
  experimental__runtimeEnv: {
    NODE_ENV: process.env.NODE_ENV,
  },
  emptyStringAsUndefined: true,
})
```

Notas que importam para as decisões desta task:

- **`emptyStringAsUndefined: true` é recomendação explícita da própria documentação para projetos novos.** Sem ela, `VAR=` num `.env` chega ao validador como string vazia: um schema numérico acusa erro de tipo e um schema com default nunca aplica o default.
- **Qualquer validador Standard Schema v1 serve** — Zod, Valibot, ArkType. Isso é o que torna a TD-02 uma decisão independente da TD-01, e o que descarta Joi (não implementa Standard Schema).
- `onValidationError(issues)` e `onInvalidAccess(variable)` permitem customizar o formato do erro e a mensagem de violação da fronteira. Úteis para produzir uma falha de boot legível, no espírito da convenção herdada `config/TD-03` ("variável obrigatória ausente derruba a aplicação").
- O campo mantém o prefixo `experimental__` no nome há várias releases — não é sinal de instabilidade iminente, mas é uma aresta a monitorar em upgrades.

**Consequência da TD-04 Option C:** com a remoção de `NEXT_PUBLIC_API_BASE_URL`, o bloco `client` nasce vazio. Isso é estado válido e desejado — o enforcement continua ativo para impedir que uma chave server-only seja adicionada ao bloco errado no futuro.

### zod

Decidida em `next-frontend-env-config/TD-02` (Option A). Docs contra a v4.0.1.

Superfície relevante para validação de ambiente:

- **`z.url()`** — validação de URL como schema de topo (a forma `z.string().url()` da v3 continua existindo, mas a v4 promove o validador dedicado).
- **`z.enum([...] as const)`** — o `as const` é **obrigatório** quando os valores vêm de uma variável: sem ele, `z.infer` degrada para `string` em vez de inferir a união literal.

  ```ts
  const fish = ["Salmon", "Tuna"];            // z.infer → string
  const fish = ["Salmon", "Tuna"] as const;   // z.infer → "Salmon" | "Tuna"
  ```

- **`z.coerce.number()` / `z.coerce.boolean()`** — coerção de string para número/booleano no parse, o caso típico de variável de ambiente. Armadilha documentada: `z.coerce.boolean()` aplica `Boolean(value)`, então **`"false"` coage para `true`** (qualquer string não-vazia é truthy). Para flag booleana vinda de `.env`, use `z.enum(["true","false"]).transform(v => v === "true")` em vez de `z.coerce.boolean()`.
- **`safeParse`** retorna união discriminada `{ success: true; data: T } | { success: false; error: ZodError<T> }`. O `error.issues` traz array de `{ code, path, message, expected }` — material direto para uma mensagem de erro de boot que lista todas as variáveis inválidas de uma vez, em vez de falhar na primeira.
- **`z.infer<typeof Schema>`** deriva o tipo estático do schema — é o que elimina a segunda fonte de verdade que a Option C (validação manual) da TD-02 teria criado.

### @next/env

Decidida em `next-frontend-env-config/TD-05` (Option A). Docs contra Next.js v16.2.2.

`loadEnvConfig(dir, dev?, log?, forceReload?, onReload?)` expõe, para processos **fora** do runtime do Next, exatamente a mesma cascata de arquivos que o dev server usa:

```ts
// vitest.config.ts
import { loadEnvConfig } from "@next/env"

loadEnvConfig(process.cwd())
```

Ordem de precedência (primeiro vence), lida diretamente da implementação:

```
.env.{mode}.local  >  .env.local  >  .env.{mode}  >  .env
```

com `mode = "test"` quando `NODE_ENV === "test"`, `"development"` sob dev, `"production"` caso contrário. **`.env.local` é deliberadamente pulado quando `mode === "test"`** — é essa exclusão que impede o `.env.local` de um dev vazar para o suite, e é parte do porquê a Option A da TD-05 é mais segura que carregar `.env` à mão.

Suporta expansão `${VAR}` via `dotenv-expand`. Retorna `{ combinedEnv, parsedEnv, loadedEnvFiles }`.

**Ponto de atenção não coberto pela doc:** `@next/env` é hoje dependência **transitiva** de `next`. Importá-la diretamente do `vitest.config.ts` sem declará-la em `package.json` funciona por acidente de hoisting — a implementação deve adicionar a entrada explícita.

**Contexto adjacente do mesmo doc, load-bearing para a TD-04:** variáveis `NEXT_PUBLIC_*` são inlinadas no bundle JavaScript **em build time**, não lidas em runtime pelo browser. O escape hatch para leitura em runtime no servidor é `await connection()` de `next/server`, que opta a rota por renderização dinâmica — foi essa a Option B descartada na TD-04.
