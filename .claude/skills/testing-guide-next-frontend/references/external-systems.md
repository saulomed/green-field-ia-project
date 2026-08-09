> Part of the `testing-guide-next-frontend` skill (see `../SKILL.md`).

# External System Strategy

`next-frontend` depends on these external systems. Each row is fixed by the project's CLAUDE.md and must not be overridden per-test without a written reason.

| External system | Vitest strategy | Playwright strategy | Why |
|---|---|---|---|
| **NestJS API** (`nestjs-api` / `API_BASE_URL`) | **MSW (`msw/node`) intercepting `fetch`.** No real network calls. | Drives the running app; the app talks to whatever NestJS instance is wired (typically a real container in the same Compose stack). | The Vitest suite must be deterministic, isolated from the NestJS test suite, and runnable without the backend up. The HTTP contract is captured in `mocks/handlers.ts` and overridden per-test with `server.use(...)`. Playwright proves the real wire still works. |
| **Object Storage (S3/MinIO)** | Fake — when a route handler or hook calls a storage SDK directly, MSW intercepts the HTTP request to the storage endpoint or `vi.mock` the SDK module. | Use a real MinIO container in the Compose stack when E2E covers an upload/playback flow; otherwise fake via a fixture URL. | Real S3 has cost and network flakiness. MinIO in Docker is fine. |
| **Future external HTTP APIs** | Fake via MSW. | Fake via Playwright's `page.route(...)` mocking when the API is not safe to hit. | Rate limits, cost, flakiness. |
| **Email (SMTP)** | This concern lives in the NestJS API, not `next-frontend`. No setup here. | — | — |
| **Browser cookies / `localStorage`** | jsdom/happy-dom provides them; no extra setup. | Use Playwright's `storageState` for authenticated runs (`auth.setup.ts`). | Built-in tooling is enough. **Never write a test that reads the auth token from JS or seeds it into `localStorage`** — per `auth/TD-03` the token lives in an httpOnly cookie; such a test would only pass against an implementation that violates the decision. |

## MSW: where it lives, how it loads

Per `next-frontend/CLAUDE.md`:

```
mocks/
├── handlers.ts   # Default request handlers — one per NestJS endpoint touched by the BFF
└── server.ts     # setupServer(...handlers) — imported by Vitest setupFiles
```

`mocks/server.ts` (template — write when bootstrap lands):

```ts
import { setupServer } from "msw/node"
import { handlers } from "./handlers"

export const server = setupServer(...handlers)
```

`mocks/handlers.ts` (template):

```ts
import { http, HttpResponse } from "msw"

const API_BASE_URL = process.env.API_BASE_URL ?? "http://api.test"

export const handlers = [
  http.post(`${API_BASE_URL}/auth/login`, () =>
    HttpResponse.json({ accessToken: "test-token" })
  ),
  // Add one entry per NestJS endpoint touched by the BFF
]
```

`vitest.config.ts` (template — relevant parts only):

```ts
import { defineConfig } from "vitest/config"
import react from "@vitejs/plugin-react"
import path from "node:path"

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "happy-dom",
    setupFiles: ["./vitest.setup.ts"],
    globals: false,
    css: false,
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, ".") },
  },
})
```

`vitest.setup.ts` (template):

```ts
import "@testing-library/jest-dom/vitest"
import { afterAll, afterEach, beforeAll } from "vitest"
import { server } from "./mocks/server"

beforeAll(() => server.listen({ onUnhandledRequest: "error" }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())
```

> `onUnhandledRequest: "error"` is the safety rail: any `fetch` the BFF makes to an URL not declared in `handlers.ts` (or overridden via `server.use(...)`) throws, surfacing missing fixtures immediately. Without it, MSW would silently let the request through to the network — exactly the failure mode CLAUDE.md forbids.

## API_BASE_URL — single source of truth

Tests must read the NestJS base URL from the same env var the BFF uses. Per `next-frontend/CLAUDE.md` § "API Integration" there are two, and MSW fixtures follow **`API_BASE_URL`** (`http://nestjs-api:3000`) because route handlers and Server Components are server-side code. `NEXT_PUBLIC_API_BASE_URL` (`http://localhost:3000`) is the browser-side counterpart — use it only in tests that exercise a client component's own `fetch`. Hardcoding either value inside fixtures creates drift:

```ts
// ✅
const API_BASE_URL = process.env.API_BASE_URL ?? "http://api.test"
http.post(`${API_BASE_URL}/auth/login`, …)

// ❌ hardcoded — diverges from production wiring
http.post("http://localhost:3000/auth/login", …)
```

Set `API_BASE_URL` in `vitest.config.ts`'s `test.env` or in a `.env.test` file once.

## Typing the fixtures — `openapi-spec/TD-07`

The NestJS contract is published as `nestjs-project/openapi.json`, and the decided client strategy is `openapi-typescript` (types) + `openapi-fetch` (client). **Adoption is deferred** — neither library is installed yet (`next-frontend/CLAUDE.md` § API Integration).

What this means for tests, today and after adoption:

- **Do not hand-write DTO interfaces in test files or in `mocks/handlers.ts`** to type request/response payloads. The prohibition in CLAUDE.md is not scoped to production code — a hand-rolled `interface LoginResponse` in a fixture drifts from the spec exactly like one in `lib/`, and is worse because nothing type-checks it against the real API.
- Until the codegen lands, keep fixture payloads as **inline literals** shaped from `openapi.json`. Inline literals are honest about being untyped; a fake interface pretends to be a contract.
- Once adopted, MSW handlers should derive their types from the generated schema (`components["schemas"]["LoginResponseDto"]`), which turns a backend contract change into a **compile error in the fixtures** — the single biggest reason the codegen is worth adopting for the test suite.

Whoever bootstraps the typed client should update this section and the templates above in the same change.

## Playwright: where the real NestJS sits

Playwright runs against `npm run build && npm run start`. The Next.js app's server-side `fetch` calls reach whatever `API_BASE_URL` resolves to at runtime — typically the `nestjs-api` container. When the NestJS stack is unavailable, Playwright tests for flows that depend on it must be skipped (`test.skip`), not faked at the Playwright layer. Faking belongs in Vitest+MSW.

If you need to assert UI behavior independent of NestJS state (e.g., error toast on 500), use Playwright's `page.route` to mock the BFF response for that single test — but prefer to cover that branch in Vitest+MSW first, since it's faster and more isolated.
