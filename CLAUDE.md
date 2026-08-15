# CLAUDE.md

## Project Overview

StreamTube — a video sharing platform (YouTube-like). Users can upload, manage, and publish videos. Anonymous users can watch freely; social features (comments, subscriptions, likes) require authentication.

More info in the project overview: [docs/project-plan.md](docs/project-plan.md)

## Repository Structure

This is a monorepo with two main areas:

- `nestjs-project/` — Backend API (NestJS 11, TypeScript, Express). Contains modules for users, channels, videos, comments, etc.
- `next-frontend/` — Frontend app (Next.js 16, React 19, Tailwind v4, shadcn). App Router; design system mirrored from Figma.
- `docs/` — Project documentation, architecture diagrams, and planning.

`compose.yaml` at the root is the single entrypoint for the environment: it `include`s `nestjs-project/compose.yaml` and adds `next-frontend`, so every service shares one Compose project and one network. Run `docker compose` from the root.

## Architecture (C4 Container Diagram)

See `docs/diagrams/software-arch.mermaid` for the full diagram. Key containers:

- **Frontend** (Next.js) → calls API via REST over a contract generated from the API's OpenAPI spec (never hand-written types), streams from Object Storage
- **API** (Nest.js) → business rules, auth, reads/writes DB, uploads to storage, publishes jobs to queue, sends emails
- **Video Worker** (FFmpeg) → consumes jobs from queue, processes videos, updates DB and storage
- **Database** (PostgreSQL) → users, channels, videos, comments, likes
- **Object Storage** (S3/MinIO) → video files and thumbnails
- **Message Queue** (TBD) → video processing job queue
- **Email Service** (SMTP) → account confirmation and password recovery

## Docker Networking

This project runs entirely in Docker containers. When configuring connections between services (database, cache, queue, etc.), **always use the Docker Compose service name** as the host — never `localhost` or `127.0.0.1`.

Inside a container, `localhost` refers to the container itself, not the host machine or other containers. Services communicate through the Docker Compose network using their service names (e.g., `db`, `nestjs-api`).

- **Correct:** `DB_HOST=db` (the Compose service name)
- **Wrong:** `DB_HOST=localhost`

This applies to all environment variables, configuration files, and code that references service hosts.

**The browser is outside the Compose network** — it runs on the host and cannot resolve service names. This does **not** buy the frontend an exception to the rule above: per `next-frontend-env-config/TD-04` the browser calls only relative `/api/...` routes, which the Next route handlers serve from inside the container. See `next-frontend/CLAUDE.md` § API Integration for the rationale and the deferred cases.

## API Types Codegen (`scripts/`)

The frontend's HTTP calls are typed from the backend's OpenAPI spec. Two scripts at the repo root own that pipeline (per `next-frontend-api-typing/TD-01`). Both run **on the host, outside the containers** — `build.context: ./next-frontend` prevents the frontend container from seeing `nestjs-project/`, and there is no root `package.json` to hold the dependency.

- **`./scripts/generate-api-types.sh`** — regenerates `next-frontend/lib/api/schema.d.ts` from `nestjs-project/openapi.json`. Run it after **any** `npm run openapi:generate` in `nestjs-project/` (per `openapi-spec/TD-04`), i.e. whenever a DTO, endpoint, or response shape changes on the backend. Accepts an optional output path; with no argument it writes to the versioned destination. **This script is the single owner of the pinned `openapi-typescript` version and of the spec path** — with no root manifest to hold them, they live here and nowhere else.
- **`./scripts/check-api-types-drift.sh`** — calls the generator into a temp dir and diffs against the committed file, exiting non-zero when they diverge. It never writes to the versioned file and leaves no artifact behind. **A failure means the committed types are stale relative to the spec** — the backend contract moved and nobody regenerated. The fix is always to run `generate-api-types.sh` and commit the result, never to edit `schema.d.ts` by hand.

The drift check delegates generation rather than reimplementing it, so there is exactly one pinned version: a second pin could drift and make the check compare output from two different codegen versions, reporting spurious drift or masking real drift.

The generated file's own rules — never edit it, never import it outside `lib/api/` — live in `next-frontend/CLAUDE.md` § Typed API contracts.

> **Pending:** `TD-01` calls for the drift check to run in CI, but this repo has no CI pipeline yet and no decision has picked a provider. Until then, `check-api-types-drift.sh` is a manual/pre-commit gate. Wiring it to a pipeline is a separate tooling decision.

## Working Principles

- **Single Responsibility:** each module, service, and function should have a clear, focused responsibility.
- **Type Safety:** Strict TypeScript usage across all layers.
- **Contract-Driven API Communication:** frontend↔API communication is governed by the OpenAPI contract, not by types written on each side. `nestjs-project/openapi.json` is the single source of truth; the frontend's types are **generated** from it and every consumer type is **derived** from those generated types. Never hand-write a DTO interface, a response shape, or a request body type on the frontend to mirror the backend — a hand-written mirror is a second source of truth that silently drifts. When the contract changes, the build breaks; that break is the feature. See § API Types Codegen below and `next-frontend/CLAUDE.md` § Typed API contracts.
- **Testing:** Strong emphasis on pyramid testing at all levels to ensure reliability and maintainability.
- **Code Quality:** Use ESLint and Prettier for consistent code style. Code reviews should focus on readability, maintainability, and adherence to best practices.
- **Documentation:** Comprehensive docs for architecture, setup, and troubleshooting in `docs/`.


## Git Conventions

- **Main branch:** `main` — never commit directly to it
- Branches: `feature/*`, `bugfix/*`, `hotfix/*`, `docs/*`
- **Commits:** short, descriptive messages focused on the "why" of the change
- **Workflow:** Git Flow conventions. Two long-lived branches:
  - `main` — stable, production-ready code 
  - `dev` — integration branch; all feature/bugfix/hotfix branches start from `dev` and merge back into `dev`
  - When `dev` is stable, it is merged into `main`

## Testing Policy

Every change must be tested. During development, run only the tests related to the modified code. Before finishing, always run the full test suite to ensure nothing is broken.

## Scope Limits

- Work on **one feature, fix, or refactoring at a time** — do not mix scopes
- Do not include cosmetic changes (formatting, renaming) alongside functional changes
- If something out of scope comes up during work, note it as a separate task instead of acting on it
- Focus on the defined scope for each task to ensure clarity and maintainability of the codebase.
- If you identify a necessary change that is out of scope, create a new issue or task for it instead of including it in the current work.

## Agent Skill Usage

When working on any task (planning, implementing, debugging, refactoring, 
reviewing, etc.), decompose the request into its underlying subtasks and 
concerns, then identify which available skills match any of them and activate 
those skills.

### Proactive Skills — NestJS Backend (`nestjs-project/`)

Always load these skills **before** implementing, planning, or reviewing NestJS code:

| Intenção | Skill |
|----------|-------|
| Criar/modificar código NestJS (módulos, controllers, services, guards, pipes) | `nestjs-best-practices` |
| Criar/modificar entidades, migrations, repositórios ou queries TypeORM | `nestjs-best-practices` + `typeorm` |
| Planejar arquitetura ou features do backend | `nestjs-best-practices` |
| Escrever ou revisar testes NestJS | `nestjs-best-practices` |

## Library Documentation Lookup

Before implementing any feature, you MUST use the **context7** MCP tool to look up the relevant library APIs and official documentation.

Always:

- Check the installed library version in the project manifest
- Retrieve the corresponding documentation using context7
- Cross-reference APIs to avoid deprecated or incompatible patterns
- Follow the official documentation over training data

Skip documentation lookup only for trivial operations such as:

- Variable declarations
- Basic control flow
- Simple CRUD using established project patterns

If a library is involved and there is uncertainty, documentation lookup is mandatory.
If the documentation returned does not match the installed version, flag the discrepancy before proceeding.