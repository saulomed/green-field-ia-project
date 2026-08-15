<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# CLAUDE.md

## Environment Startup Verification

**Default behavior:** starting the environment means starting **only infrastructure services** (database, mail, and the idle app containers) — **never** start the Next.js dev server unless the user explicitly asks to run/serve the project (e.g., "rode o projeto", "suba o front", "run the app").

After starting, always confirm the containers are up before proceeding:

```bash
docker compose ps   # all services must show status "running"
```

`next-frontend` running only means the container is alive — its `CMD` is `tail -f /dev/null`, so **no dev server is listening yet**. Only check `curl -I http://localhost:3001` after you have deliberately started `npm run dev`.

## Development Environment

This project runs inside Docker. **All `docker compose` commands run from the repository root**, never from `next-frontend/` or `nestjs-project/` — the root `compose.yaml` `include`s the backend stack so every service lands in one Compose project and shares one network. Running Compose from a subdirectory creates a separate project on a separate network, and `nestjs-api` stops resolving.

```bash
# Start containers (from the repo root)
docker compose up -d

# Install dependencies (first time only)
docker compose exec next-frontend npm install

# Run the dev server (only when explicitly asked)
docker compose exec next-frontend npm run dev
```

Services:
- `next-frontend` — Next.js app, port `3001`
- `nestjs-api` — NestJS API, port `3000`
- `db` — PostgreSQL 17, port `5432`
- `mailpit` — SMTP `1025`, web UI `8025`

The frontend is on **3001, not 3000** — the API already owns 3000. The port is pinned in the `dev`/`start` scripts (`next dev -p 3001`), so it holds whether the server runs in the container or on the host. Do not remove the flag.

Verification and teardown run on the **host machine**:

```bash
curl -I http://localhost:3001          # expect 200 once the dev server is up
docker compose logs next-frontend
docker compose down                    # tears down the whole environment, backend included
```

## Commands (run inside the container via `docker compose exec next-frontend <cmd>`)

```bash
npm run dev                              # Dev server on 3001 (long-running — see below)
npm run build                            # Production build
npm run start                            # Serve the production build on 3001

npm run lint                             # ESLint (flat config, eslint-config-next)
npm run check:tokens                     # Guards the globals.css theming contract
npx tsc --noEmit                         # Type-check (the build does not emit JS via tsc)
```

Test commands — **the scripts do not exist yet**; these are the names bootstrap must create (see "Testing"):

```bash
npm test                                 # vitest run — unit + integration
npm run test:watch                       # vitest — watch mode
npm test -- lib/__tests__/foo.test.ts    # single Vitest file
npm run test:e2e                         # playwright test
npm run test:e2e -- tests/login.e2e-spec.ts   # single Playwright spec
```

## Installing Dependencies Inside the Container

`node_modules` lives on a **bind mount**. The host owns it as uid `1001`, but the container runs as `node` (uid `1000`). Because of this mismatch, `docker compose exec next-frontend npm install <pkg>` as the `node` user can fail with `EACCES`. The same mismatch affects **`.next/`**, which the dev server must write on every request.

**Canonical procedure (requires the user's explicit authorization before running anything as root):**

1. Install once as root: `docker compose exec -u root next-frontend npm install <pkg>`
2. **Immediately** restore ownership: `docker compose exec -u root next-frontend chown -R node:node node_modules .next tsconfig.tsbuildinfo next-env.d.ts`

Do **not** leave these paths owned by root, and do **not** `chmod 777` as a permanent fix. Always ask the user before the root step; never run it silently.

**Why `tsconfig.tsbuildinfo` and `next-env.d.ts` are on that list.** Both are generated files that live on the bind mount and are frequently created by tooling running on the **host** (uid 1001), which leaves them unwritable by the container's `node` user (uid 1000). They are not touched by `npm install`, so they drift out of sync with the two directories above. The symptoms are routine commands failing for reasons that look unrelated to permissions:

- `npx tsc --noEmit` → `error TS5033: Could not write file '/home/node/app/tsconfig.tsbuildinfo': EACCES`
- `npm run build` → `EACCES: permission denied, open '/home/node/app/next-env.d.ts'`, followed by `Next.js build worker exited with code: 1`

If either appears, re-run the `chown` from step 2 — it is idempotent and safe to run on its own, without a preceding install.

## Long-running Processes

`npm run dev` and `npm run start` never exit. Run them in background in the Bash tool — otherwise the agent blocks indefinitely waiting for the process to return.

## Architecture

App Router. Everything under `app/` is a **Server Component by default**; `"use client"` is the explicit boundary where a subtree moves to the browser. Push that boundary as deep as possible — a page that only composes markup stays on the server.

- `app/` — routes, layouts, `globals.css`. Route handlers, when they arrive, live at `app/api/**/route.ts`.
- `components/ui/` — shadcn primitives **reconciled with Figma** (see "Design System"). A scaffolded-but-unreconciled primitive is a defect, not a starting point.
- `components/` — composed application pieces (`brand-logo.tsx`, `auth-footer.tsx`). One component per file, named export.
- `components/icons/` — hand-maintained SVG components, re-exported from `index.ts`. **No external icon library** — `lucide-react` was deliberately removed.
- `lib/utils.ts` — `cn()`, built with `extendTailwindMerge` so the Figma typography utilities are not mistaken for colors. Every new `--text-*` token must be registered there in the same change.
- `scripts/` — repo tooling (`check-theme-tokens.mjs`).
- `__tests__/` — Vitest suites, one folder per artifact folder, sitting next to the code under test (`app/api/login/__tests__/`, `lib/__tests__/`, …).
- `mocks/` — MSW `handlers.ts` + `server.ts`, the fake NestJS API shared by every Vitest integration test.
- `tests/` — Playwright suites only. The single exception to colocation: E2E has no single artifact to sit beside.

Path alias: `@/*` resolves to the project root (`@/components/ui/button`, `@/lib/utils`).

**There is no `tailwind.config`.** Tailwind v4 is CSS-first: the theme lives in `app/globals.css` under `@theme inline`, wired through `@tailwindcss/postcss`. Do not create a JS config to "fix" a missing utility.

## API Integration

**A única base URL da API é server-side.** Per `next-frontend-env-config/TD-04`, o browser nunca fala com o `nestjs-api` diretamente: ele chama apenas rotas relativas (`/api/...`) dos route handlers do próprio Next, que rodam dentro do container e resolvem o host pelo nome de serviço do Compose. Isso mantém a regra do `CLAUDE.md` raiz intacta e dispensa a exceção do browser — não existe variável `NEXT_PUBLIC_*` de base URL.

- `API_BASE_URL=http://nestjs-api:3000` (`.env.example`) — Server Components, route handlers, server actions. Lida em runtime pelo processo Node, nunca embutida no bundle.
- Código de browser → `fetch('/api/...')`, sempre relativo, sempre passando pelo BFF.

Streaming e download de vídeo (Fases 03 e 05) ficam **fora** desta decisão: quando o object storage entrar em escopo, a URL pública desses assets exigirá decisão própria.

Contracts already fixed in `docs/decisions/`, to be honored when the screens land:

- **Auth token transport** (`auth/TD-03`): the API issues the token in an `httpOnly` + `Secure` + `SameSite` cookie. The frontend never reads it from JavaScript and never stores it in `localStorage`.
- **Typed API client** (`openapi-spec/TD-05`): `openapi-typescript` (types) + `openapi-fetch` (client), derived from `nestjs-project/openapi.json`. **Types adopted; client still deferred** — see § Typed API contracts below. `openapi-fetch` is not installed and no TD adopts it yet.

### Typed API contracts

Per `next-frontend-api-typing/TD-01` + `TD-02`, the HTTP layer is typed from the backend's OpenAPI spec:

- **`lib/api/schema.d.ts`** — generated output of `scripts/generate-api-types.sh` (repo root). Never edit it by hand, and never import it from `components/` or `hooks/`. Regenerate it whenever the backend spec changes; `scripts/check-api-types-drift.sh` fails when it is stale.
- **`lib/api/contracts.ts`** — hand-written, but every type in it **derives** from `schema.d.ts` via the canonical `paths[...]` accessor plus `Pick`/`Omit`/`Extract`/`Exclude`. Never restate a field by hand. `components/` and `hooks/` import **only** from here.
- Each new `/api/...` route handler registers its contract in `contracts.ts` in the same commit that creates the handler.

The point of deriving rather than restating is the build-time break: removing a field from a backend DTO makes `tsc --noEmit` fail at the affected derivation in `contracts.ts`. That break is the safety net.

**Every hop is typed by the same contract, and the chain has one origin:**

```text
nestjs-project/openapi.json   ← source of truth (generated by the backend)
  → lib/api/schema.d.ts       ← generated; never edited, never imported outside lib/api/
    → lib/api/contracts.ts    ← derived by Pick/Omit/Extract/Exclude; never restated
      → app/api/**/route.ts   ← the BFF; types its upstream call and its own response from here
        → components/, hooks/ ← fetch('/api/...') and type the result from here
```

No layer invents its own shape, and no layer skips a step: a component never imports `schema.d.ts`, and a route handler never types its response with an interface written on the spot. When you add a route, the contract entry comes first.

### No runtime validation at the BFF↔NestJS boundary

Per `next-frontend-api-typing/TD-03` (Option A), route handlers in `app/api/**/route.ts` **pass the `nestjs-api` response through typed at build time only**. There is no parse step, no response schema module, and no new dependency at that boundary. The absence is a decision on record, not an oversight — do not "fix" it by adding validation.

**Accepted risk:** a response that violates the contract is not caught at the boundary. It becomes a silent `undefined` further along, inside a component, far from the cause. The chosen mitigation is upstream instead of at the boundary: `scripts/check-api-types-drift.sh` keeps the generated types honest against the spec, and the `Pick`/`Omit` derivations in `contracts.ts` turn a backend field removal into a build failure.

**Reevaluation trigger — explicit and narrow:** revisit this only when codegen of Zod schemas **from the OpenAPI spec** exists. At that point runtime validation stops costing a second source of truth and the tradeoff genuinely changes. Reopening the discussion without that trigger contradicts the decision. Hand-writing Zod schemas for HTTP responses is exactly the second source of truth that `openapi-spec/TD-05` was chosen to eliminate.

**Scope boundary:** this decision covers the **HTTP** boundary only. `lib/env.ts` keeps validating environment variables with Zod at runtime per `next-frontend-env-config/TD-01` — that is a different boundary with a different failure mode (fail fast at startup on a misconfigured container). `zod@^4.4.3` stays installed and stays scoped to that use.

## Design System

Figma (file **FC-Tube**) is the source of truth for tokens, typography, and component variants. The full contract — token layers, theming policy, shadcn↔Figma reconciliation, icon rules, known traps — lives in `.claude/rules/frontend-design-system.md`, which auto-loads for `.tsx`/`.css` files here. **Read it before touching any component or `globals.css`; it is not duplicated in this file.**

The one thing worth repeating: run `npm run check:tokens` after any change to `globals.css` and after every `npx shadcn add` — the shadcn CLI rewrites cssVars and reintroduces an oklch palette plus a `.dark` block, both of which break the contract.

## Testing

Tooling is **not wired yet** — `vitest.config.ts`, `vitest.setup.ts`, `playwright.config.ts`, `mocks/server.ts` and the `test` / `test:e2e` scripts do not exist. Everything below is the standing contract for *new* tests; bootstrap makes the commands runnable without changing a single rule.

### Runner per layer

| Layer | Runner | Suffix | Location |
|---|---|---|---|
| Unit — a component, hook or util in isolation | **Vitest** | `*.test.ts` / `*.test.tsx` | `__tests__/` next to the artifact |
| Integration — artifacts wired together; route handlers called as functions against the MSW fake API | **Vitest** | `*.integration.test.ts` / `.tsx` | `__tests__/` next to the artifact |
| End-to-end — real browser driving the running app | **Playwright** | `*.e2e-spec.ts` | `tests/` at the root of `next-frontend/` |

**Placement rule:** unit and integration tests live in a `__tests__/` folder **beside the artifact they test** — never in a mirrored top-level tree. E2E is the only lane that lives apart, in `tests/`, because a browser flow crosses too many artifacts to belong next to any one of them.

### BFF / route handlers — the decided approach

Route handlers under `app/api/**/route.ts` are the BFF. They are tested as **integration tests in Vitest**, and never against the real NestJS API:

- **Import and call the handler directly** — `import { POST } from "@/app/api/auth/login/route"`, build a `Request`/`NextRequest`, `await POST(req)`, assert on the returned `Response` (status, headers, parsed body). No HTTP server is started, no supertest layer exists for the Next.js app.
- **The upstream NestJS API is faked by MSW** — a local fake built with `msw` handlers and `setupServer` from `msw/node`, defined in `mocks/handlers.ts` and `mocks/server.ts`. That fake is the *only* sanctioned stand-in for `nestjs-api`.
- **No Vitest test may open a real network connection to `nestjs-api`** — configure `server.listen({ onUnhandledRequest: "error" })` so an unmocked request fails the test instead of leaking out.
- **Never mock global `fetch`** with `vi.fn()`/`vi.mock`. A raw `fetch` mock accepts any URL, method or body and therefore hides exactly the wiring mistakes MSW would catch.
- MSW handlers must read the upstream base URL from `config.api.baseUrl` (`@/lib/env`) — the same module the handler reads — never hardcoded and never from `process.env` directly, otherwise fake and code drift apart silently. See `.claude/skills/testing-guide-next-frontend/references/external-systems.md` § "API_BASE_URL — single source of truth" for the mechanics.

Lifecycle goes in `vitest.setup.ts`, wired through `setupFiles` in `vitest.config.ts`:

```ts
import { afterAll, afterEach, beforeAll } from "vitest"
import { server } from "./mocks/server"

beforeAll(() => server.listen({ onUnhandledRequest: "error" }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())
```

Skipping `resetHandlers()` leaks per-test overrides into the next test — the most common source of flakiness in this lane.

### Layer boundaries

- **Async Server Components cannot be rendered by Vitest.** React 19 + Next.js 16 do not support rendering `async function Page()` under jsdom/happy-dom. Their behavior is proven in Playwright — do not invent jsdom workarounds. Synchronous Server Components and Client Components *are* unit-renderable.
- **Vitest + MSW proves BFF logic; Playwright proves the app works against a running stack.** Neither substitutes the other: MSW validates that the handler transforms and shapes responses correctly, Playwright validates the wiring end to end.
- **Playwright drives the production build** (`npm run build && npm run start` on port 3001), never `npm run dev` — the dev server adds overlays and timings that diverge from what users see.

See the `testing-guide-next-frontend` skill for what to test at which layer, per artifact type, plus the setup templates.
