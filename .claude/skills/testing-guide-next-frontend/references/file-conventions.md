> Part of the `testing-guide-next-frontend` skill (see `../SKILL.md`).

# File Conventions

The conventions in this file are fixed by `next-frontend/CLAUDE.md` → "Testing". Repeated here for quick reference.

## Suffix → runner → location

| Suffix | Purpose | Runner | External I/O | Location |
|---|---|---|---|---|
| `*.test.ts` (or `.tsx`) | Unit — pure logic, collaborators mocked | Vitest | Forbidden | `__tests__/` next to the artifact |
| `*.integration.test.ts` (or `.tsx`) | Integration — multiple artifacts wired; route handlers called as functions with MSW | Vitest | MSW only — **no** real network | `__tests__/` next to the artifact |
| `*.e2e-spec.ts` | End-to-end — full browser flow via Playwright against a running app | Playwright | Real browser + running app | `tests/` at the root of `next-frontend/` |

**Routing rule** (apply mechanically):

- Renders a component or invokes a hook/util in isolation, with mocks for collaborators → `*.test.ts`.
- Imports a route handler (`import { GET } from "@/app/api/.../route"`), builds a `Request`/`NextRequest`, calls the handler, asserts on the `Response` — with MSW intercepting `fetch` to the NestJS API → `*.integration.test.ts`.
- Drives the full app in a real browser → `*.e2e-spec.ts` under `tests/`.

## Directory layout

```
next-frontend/
├── app/
│   ├── globals.css
│   ├── layout.tsx
│   ├── <route>/page.tsx
│   └── api/<route>/
│       ├── route.ts
│       └── __tests__/
│           └── route.integration.test.ts
├── components/                         # composed pieces live FLAT here, not in feature folders
│   ├── <component>.tsx                #   e.g. brand-logo.tsx, auth-footer.tsx
│   ├── ui/                            # shadcn primitives — no test files here
│   ├── icons/                         # icons — no test files here
│   └── __tests__/
│       ├── <component>.test.tsx                   # unit (client component)
│       └── <component>.integration.test.tsx       # integration (with MSW), when applicable
├── lib/
│   ├── utils.ts
│   └── __tests__/
│       └── <util>.test.ts
├── hooks/                              # created when first hook lands
│   └── __tests__/
│       └── <hook>.test.ts
├── mocks/
│   ├── handlers.ts                    # MSW request handlers
│   └── server.ts                      # setupServer(...handlers)
├── tests/                              # Playwright suites only
│   ├── auth.setup.ts                  # storageState producer (auth fixture)
│   └── <feature>.e2e-spec.ts
├── vitest.config.ts
├── vitest.setup.ts
├── playwright.config.ts
└── package.json
```

`components/ui/` and `components/icons/` deliberately have **no** `__tests__/` subfolder. If you find yourself wanting to add one, re-read `artifacts/ui-primitives.md` and `artifacts/icons.md` — these types do not earn unit tests.

Do **not** invent `components/<feature>/` subfolders to host tests. `next-frontend/CLAUDE.md` § Architecture fixes the flat layout (`ui/` and `icons/` are the only subfolders), so a single `components/__tests__/` holds every component test.

## Scripts (to add to `package.json` during bootstrap)

```json
{
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "test:e2e": "playwright test"
  }
}
```

All test commands run inside the container, and every `docker compose` invocation runs **from the repository root** — never from `next-frontend/`. Running Compose from the subdirectory creates a separate project on a separate network and `nestjs-api` stops resolving (`next-frontend/CLAUDE.md` § Development Environment).

```bash
docker compose exec next-frontend npm test
docker compose exec next-frontend npm run test:e2e
docker compose exec next-frontend npm test -- path/to/file.test.ts
```

For a single Playwright spec:

```bash
docker compose exec next-frontend npm run test:e2e -- tests/login.e2e-spec.ts
```

## `playwright.config.ts` — production build webServer

Playwright **must** drive `npm run build && npm run start`, not `npm run dev`. The dev server adds DevServer overlays, debug logs, and slower transitions that diverge from what users see.

The app is served on **3001, not 3000** — `nestjs-api` owns 3000, and the port is pinned in the `dev`/`start` scripts (`next -p 3001`). `baseURL` and `webServer.url` must match it.

```ts
import { defineConfig, devices } from "@playwright/test"

export default defineConfig({
  testDir: "./tests",
  testMatch: "**/*.e2e-spec.ts",
  fullyParallel: true,
  retries: process.env.CI ? 2 : 0,
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3001",
    trace: "on-first-retry",
  },
  webServer: {
    command: "npm run build && npm run start",
    url: "http://localhost:3001",
    timeout: 180_000,
    reuseExistingServer: !process.env.CI,
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
  ],
})
```

## Auth fixture pattern (`tests/auth.setup.ts`)

Login once per Playwright run, save `storageState`, reuse in authenticated specs:

```ts
import { test as setup, expect } from "@playwright/test"

const STORAGE_STATE = "tests/.auth/user.json"

setup("authenticate", async ({ page }) => {
  await page.goto("/login")
  await page.getByLabel("Email address").fill(process.env.E2E_EMAIL!)
  await page.getByLabel("Password").fill(process.env.E2E_PASSWORD!)
  await page.getByRole("button", { name: "Sign in" }).click()
  await expect(page).toHaveURL("/")
  await page.context().storageState({ path: STORAGE_STATE })
})
```

Wire it as a Playwright project dependency in `playwright.config.ts` to inject the cookie into the `chromium` project.

## Coverage philosophy

**Pragmatic, not threshold-driven.** This project does not enforce coverage percentages. The §3 checklist in `SKILL.md` is the source of truth — if every required test for an artifact exists, coverage is sufficient.

Reasons to *not* set a percentage threshold:

- Static markup in `app/page.tsx` and shadcn primitives would push the denominator up without earning any test value.
- Coverage targets reward writing pointless tests (mirror tests, validation passthroughs) that this guide explicitly forbids.

If coverage is ever needed for a specific subsystem (auth, payment), gate it via a per-folder check, not a global threshold.

## Naming and conventions

- File names: kebab-case (`login-form.test.tsx`, `format-duration.test.ts`).
- `describe` block: the artifact name (`<LoginForm>` for a component, the HTTP method+path for a route handler — `"POST /api/auth/login"`).
- `it` block: starts with a verb, describes user-visible behavior, not implementation (`"submits and navigates to /"`, not `"calls pushMock with '/'"`).
- Imports use `@/...` aliases — never deep relative paths.
- Test files use the same imports as their subject. Do **not** import from `dist/` or compiled paths.
