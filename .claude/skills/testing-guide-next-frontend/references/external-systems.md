> Part of the `testing-guide-next-frontend` skill (see `../SKILL.md`).

# External System Strategy

`next-frontend` depends on these external systems. Each row is fixed by the project's CLAUDE.md and must not be overridden per-test without a written reason.

| External system | Vitest strategy | Playwright strategy | Why |
|---|---|---|---|
| **NestJS API** (`nestjs-api` / `API_BASE_URL`) | **MSW (`msw/node`) intercepting `fetch`.** No real network calls. | Drives the running app; the app talks to whatever NestJS instance is wired (typically a real container in the same Compose stack). | The Vitest suite must be deterministic, isolated from the NestJS test suite, and runnable without the backend up. The HTTP contract is captured in `mocks/handlers.ts` and overridden per-test with `server.use(...)`. Playwright proves the real wire still works. |
| **Object Storage (S3/MinIO)** | Fake — when a route handler or hook calls a storage SDK directly, MSW intercepts the HTTP request to the storage endpoint or `vi.mock` the SDK module. | Use a real MinIO container in the Compose stack when E2E covers an upload/playback flow; otherwise fake via a fixture URL. | Real S3 has cost and network flakiness. MinIO in Docker is fine. |
| **Future external HTTP APIs** | Fake via MSW. | Fake via Playwright's `page.route(...)` mocking when the API is not safe to hit. | Rate limits, cost, flakiness. |
| **Email (SMTP)** | This concern lives in the NestJS API, not `next-frontend`. No setup here. | — | — |
| **Browser cookies / `localStorage`** | jsdom provides them; no extra setup. | Use Playwright's `storageState` for authenticated runs (`auth.setup.ts`). | Built-in tooling is enough. **Never write a test that reads the auth token from JS or seeds it into `localStorage`** — per `auth/TD-03` the token lives in an httpOnly cookie; such a test would only pass against an implementation that violates the decision. |

## MSW: where it lives, how it loads

Per `next-frontend/CLAUDE.md`:

```
mocks/
├── handlers.ts       # Upstream NestJS handlers, typed from the OpenAPI contract
├── bff-handlers.ts   # Relative `/api/...` routes of the Next BFF — browser lane only
└── server.ts         # setupServer() — composed per lane by the Vitest setupFiles
```

Two handler sets, not one, per `next-frontend-msw-base/TD-04`: `handlers.ts` fakes the **upstream NestJS API** (absolute URLs derived from `config.api.baseUrl`) and `bff-handlers.ts` fakes the **Next BFF's own relative routes**. They have different typing guarantees and different resolution rules, so they never share a file.

`mocks/server.ts`:

```ts
import { setupServer } from "msw/node"

// No initial handlers — which set applies depends on the lane, and that composition happens in
// each project's setupFiles (next-frontend-msw-base/TD-04).
export const server = setupServer()
```

`mocks/handlers.ts` — typed from the contract per `next-frontend-msw-base/TD-03`:

```ts
import { createOpenApiHttp } from "openapi-msw"
import type { paths } from "@/lib/api/contracts"
import { config } from "@/lib/env"

const http = createOpenApiHttp<paths>({ baseUrl: config.api.baseUrl })

export const handlers = [
  http.post("/auth/login", ({ response }) =>
    response(200).json({ id: "…", email: "user@streamtube.test", channel: { nickname: "user" } }),
  ),
  // One entry per NestJS endpoint touched by the BFF
]
```

Path, method, status and body are checked at build time against `nestjs-project/openapi.json`. `paths` comes from `@/lib/api/contracts`, **never** from `@/lib/api/schema` — `next-frontend-api-typing/TD-02` confines the generated module to `lib/api/`, and `contracts.ts` reexports the type so `mocks/` needs no carve-out. For anything legitimately outside the spec, `http.untyped` is the escape hatch.

`mocks/bff-handlers.ts` — untyped by nature (these routes are the Next app's own, absent from the NestJS spec):

```ts
import { http, HttpResponse, type RequestHandler } from "msw"

export const bffHandlers: RequestHandler[] = [
  http.post("/api/auth/login", () => HttpResponse.json({ id: "…" })),
]
```

`vitest.config.mts` (template — relevant parts only). **Two projects, one per execution lane**, per `next-frontend-msw-base/TD-01`. A single global `environment` is not an option: `@/lib/env` throws under a DOM environment (see "API_BASE_URL — single source of truth" below), so route handlers and `lib/` utilities must run in `node`.

```ts
import nextEnv from "@next/env"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vitest/config"

// `@next/env` is CommonJS; a default import is required from an ESM (`.mts`) config.
const { loadEnvConfig } = nextEnv

// Before defineConfig: `lib/env.ts` validates at module evaluation, so process.env must already
// be populated when the first test imports it (next-frontend-env-config/TD-05).
loadEnvConfig(process.cwd())

export default defineConfig({
  plugins: [react()],
  // Vite 8 resolves tsconfig paths natively — `vite-tsconfig-paths` is no longer needed.
  resolve: { tsconfigPaths: true },
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: "node",
          environment: "node",
          include: ["app/api/**/__tests__/**/*.test.ts", "lib/**/__tests__/**/*.test.ts"],
          setupFiles: ["./vitest.setup.node.ts"],
        },
      },
      {
        extends: true,
        test: {
          name: "dom",
          environment: "jsdom",
          // jsdom defaults to :3000, which is the `nestjs-api` port here. Relative handlers
          // resolve against this location (next-frontend-msw-base/TD-02).
          environmentOptions: { jsdom: { url: "http://localhost:3001" } },
          include: [
            "components/**/__tests__/**/*.test.{ts,tsx}",
            "hooks/**/__tests__/**/*.test.{ts,tsx}",
          ],
          setupFiles: ["./vitest.setup.dom.ts"],
        },
      },
    ],
  },
})
```

The config is `.mts`, not `.ts`: `next-frontend/package.json` has no `"type": "module"`, and Vite 8 warns that loading an ESM-syntax config as CommonJS uses a path that will stop being supported.

`vitest.setup.node.ts` (template) — upstream handlers only:

```ts
import { afterAll, afterEach, beforeAll } from "vitest"
import { handlers } from "./mocks/handlers"
import { server } from "./mocks/server"

beforeAll(() => {
  server.listen({ onUnhandledRequest: "error" })
  // Promotes the list to *initial* handlers. Without this the first test of each file would run
  // before the first afterEach, with no handlers at all — `setupServer()` starts empty.
  server.resetHandlers(...handlers)
})
afterEach(() => server.resetHandlers(...handlers))
afterAll(() => server.close())
```

`vitest.setup.dom.ts` (template) — BFF handlers only, plus DOM matchers:

```ts
import "@testing-library/jest-dom/vitest"
import { cleanup } from "@testing-library/react"
import { afterAll, afterEach, beforeAll } from "vitest"
import { bffHandlers } from "./mocks/bff-handlers"
import { server } from "./mocks/server"

beforeAll(() => {
  server.listen({ onUnhandledRequest: "error" })
  server.resetHandlers(...bffHandlers)
})
afterEach(() => {
  cleanup() // Testing Library only auto-unmounts with `globals: true`.
  server.resetHandlers(...bffHandlers)
})
afterAll(() => server.close())
```

> **The DOM lane must not register `handlers`.** `mocks/handlers.ts` imports `@/lib/env` to read `config.api.baseUrl`, and that import throws under jsdom (server/client boundary — see below). It would also be pointless: per `next-frontend-env-config/TD-04` browser code only ever calls relative routes.

> `onUnhandledRequest: "error"` is the safety rail: any `fetch` the BFF makes to an URL not declared in `handlers.ts` (or overridden via `server.use(...)`) throws, surfacing missing fixtures immediately. Without it, MSW would silently let the request through to the network — exactly the failure mode CLAUDE.md forbids.

## API_BASE_URL — single source of truth

There is exactly **one** NestJS base URL, and it is server-side only: `API_BASE_URL`. Per `next-frontend-env-config/TD-04` the browser never calls the API directly — it calls relative routes (`/api/...`) on the Next route handlers, which are the only code that dereferences `API_BASE_URL`. So MSW fixtures always intercept `API_BASE_URL`; there is no browser-side counterpart to mock. A client component's own `fetch` targets a relative path and never reaches MSW's NestJS handlers at all.

Fixtures must read the value from the same module the BFF reads it from — `config.api.baseUrl` in `@/lib/env` — never from `process.env` directly and never hardcoded:

```ts
import { config } from "@/lib/env"

// ✅
http.post(`${config.api.baseUrl}/auth/login`, …)

// ❌ hardcoded — diverges from production wiring
http.post("http://localhost:3000/auth/login", …)

// ❌ bypasses the validated module — `lib/env.ts` is the only place that reads process.env
const API_BASE_URL = process.env.API_BASE_URL ?? "http://api.test"
```

**Only Node-environment tests may import `@/lib/env`.** `API_BASE_URL` is a server-only key, and t3-env decides server vs client by `typeof window === "undefined"`. Under jsdom the boundary guard fires and the import throws at module evaluation. So `config.api.baseUrl` belongs in route-handler tests (which run in `environment: "node"`); client components and hooks intercept the **relative** BFF path instead (`http.post("/api/videos", …)`) — which is what they actually call, per `next-frontend-env-config/TD-04`.

`API_BASE_URL` is set once, for the whole suite, in the versioned `next-frontend/.env.test` (`http://nestjs-api.test:3000` — a host that deliberately does not resolve, so anything escaping MSW fails loudly instead of leaking to the real service). It is loaded by `loadEnvConfig(process.cwd())` from `@next/env` at the top of `vitest.config.mts`. Do **not** duplicate the value in `vitest.config.mts`'s `test.env`.

## Typing the fixtures — `openapi-spec/TD-05` + `next-frontend-msw-base/TD-03`

The NestJS contract is published as `nestjs-project/openapi.json`. **The codegen is adopted for the upstream fixtures**: `openapi-typescript` generates `lib/api/schema.d.ts`, and `openapi-msw` wraps MSW so `mocks/handlers.ts` is checked against that contract at build time (`next-frontend-msw-base/TD-03`). `openapi-fetch` (the runtime client half of `openapi-spec/TD-05`) is still **not** installed and no TD adopts it.

- **Never hand-write DTO interfaces in test files or in `mocks/handlers.ts`.** The prohibition in CLAUDE.md is not scoped to production code — a hand-rolled `interface LoginResponse` in a fixture drifts from the spec exactly like one in `lib/`, and is worse because nothing type-checks it against the real API.
- **Upstream handlers are typed, not literal.** `createOpenApiHttp<paths>()` rejects an unknown path, a wrong method, and a body that does not match the declared status — a backend contract change becomes a compile error in the fixtures, which is the whole point.
- **BFF handlers (`bff-handlers.ts`) stay untyped**, by construction: `/api/...` routes belong to the Next app and do not exist in the NestJS spec. Keep their payloads as inline literals; the contract that governs them is `lib/api/contracts.ts`, not `openapi.json`.
- **`http.untyped` is the escape hatch** for anything legitimately outside the spec.

> **A typed fixture surfaces spec bugs immediately — expect that, don't work around it.** `POST /auth/login` currently declares `RegisterResponseDto` as its 200 response, so a login fixture must include `channel.nickname` to compile. The fixture is faithful to the published contract, not to the intended behavior. Fix the backend spec; do not cast the fixture.

## Playwright: where the real NestJS sits

Playwright runs against `npm run build && npm run start`. The Next.js app's server-side `fetch` calls reach whatever `API_BASE_URL` resolves to at runtime — typically the `nestjs-api` container. When the NestJS stack is unavailable, Playwright tests for flows that depend on it must be skipped (`test.skip`), not faked at the Playwright layer. Faking belongs in Vitest+MSW.

If you need to assert UI behavior independent of NestJS state (e.g., error toast on 500), use Playwright's `page.route` to mock the BFF response for that single test — but prefer to cover that branch in Vitest+MSW first, since it's faster and more isolated.
