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

There are **no `test` / `test:e2e` scripts yet** — see "Testing" below.

## Installing Dependencies Inside the Container

`node_modules` lives on a **bind mount**. The host owns it as uid `1001`, but the container runs as `node` (uid `1000`). Because of this mismatch, `docker compose exec next-frontend npm install <pkg>` as the `node` user can fail with `EACCES`. The same mismatch affects **`.next/`**, which the dev server must write on every request.

**Canonical procedure (requires the user's explicit authorization before running anything as root):**

1. Install once as root: `docker compose exec -u root next-frontend npm install <pkg>`
2. **Immediately** restore ownership: `docker compose exec -u root next-frontend chown -R node:node node_modules .next`

Do **not** leave `node_modules` or `.next` owned by root, and do **not** `chmod 777` as a permanent fix. Always ask the user before the root step; never run it silently.

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

Path alias: `@/*` resolves to the project root (`@/components/ui/button`, `@/lib/utils`).

**There is no `tailwind.config`.** Tailwind v4 is CSS-first: the theme lives in `app/globals.css` under `@theme inline`, wired through `@tailwindcss/postcss`. Do not create a JS config to "fix" a missing utility.

## API Integration

The root `CLAUDE.md` says to always use the Docker Compose service name as the host. That rule holds for **server-side** code only. The browser runs on the host machine and cannot resolve Compose service names, so client-side code must use the published port. Hence two variables (`.env.example`):

- `API_BASE_URL=http://nestjs-api:3000` — Server Components, route handlers, server actions
- `NEXT_PUBLIC_API_BASE_URL=http://localhost:3000` — anything reaching `fetch` from the browser

Contracts already fixed in `docs/decisions/`, to be honored when the screens land:

- **Auth token transport** (`auth/TD-03`): the API issues the token in an `httpOnly` + `Secure` + `SameSite` cookie. The frontend never reads it from JavaScript and never stores it in `localStorage`.
- **Typed API client** (`openapi-spec/TD-07`): `openapi-typescript` (types) + `openapi-fetch` (client), derived from `nestjs-project/openapi.json`. **Strategy decided, adoption deferred** — neither library is installed yet. Do not hand-write DTO interfaces to work around it; adopting the codegen is the sanctioned path.

## Design System

Figma (file **FC-Tube**) is the source of truth for tokens, typography, and component variants. The full contract — token layers, theming policy, shadcn↔Figma reconciliation, icon rules, known traps — lives in `.claude/rules/frontend-design-system.md`, which auto-loads for `.tsx`/`.css` files here. **Read it before touching any component or `globals.css`; it is not duplicated in this file.**

The one thing worth repeating: run `npm run check:tokens` after any change to `globals.css` and after every `npx shadcn add` — the shadcn CLI rewrites cssVars and reintroduces an oklch palette plus a `.dark` block, both of which break the contract.

## Testing

The contract for this project (tooling is **not wired yet** — `vitest.config.ts`, `playwright.config.ts` and the `test` scripts do not exist):

- **Vitest** — unit and integration tests (`*.test.ts`, `*.integration.test.ts`), colocated with the code.
- **Playwright** — end-to-end tests (`*.e2e-spec.ts` under `tests/`).
- **MSW (`msw/node`)** — the only fake for the NestJS API in integration tests. **No Vitest test may open a real network connection to `nestjs-api`**, and no test mocks global `fetch` directly.

Async Server Components cannot be rendered by Vitest — their behavior is proven in Playwright. See the `testing-guide-next-frontend` skill for what to test at which layer, per artifact type.
