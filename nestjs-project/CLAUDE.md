# CLAUDE.md

## Environment Startup Verification

**Default behavior:** starting the environment means starting **only infrastructure services** (database, mail, etc.) — **never** start the NestJS application server unless the user explicitly asks to run/serve the project (e.g., "rode o projeto", "suba o servidor", "run the app").

After starting infrastructure, always confirm the containers are up before proceeding:

```bash
docker compose ps   # all services must show status "running"
```

Then verify each infrastructure service is actually ready to accept connections — not just running:

- **PostgreSQL:** `docker compose exec db pg_isready -U streamtube` — expect `accepting connections`

Only start the NestJS dev server (`npm run start:dev`) when the user **explicitly** asks to run the application — never as part of "start the environment".

## Development Environment

This project runs inside Docker. Always use the container for development.

**All `docker compose` commands run from the repository root**, not from `nestjs-project/`. The root `compose.yaml` `include`s this file so the API, the database, Mailpit and `next-frontend` share one Compose project and one network. Running Compose from inside `nestjs-project/` creates a separate project on a separate network, and the frontend can no longer reach `nestjs-api`.

```bash
# Start containers (from the repo root)
docker compose up -d

# Install dependencies (first time only)
docker compose exec nestjs-api npm install

# Run the dev server (watch mode)
docker compose exec nestjs-api npm run start:dev
```

Services:
- `nestjs-api` — NestJS API, port `3000`
- `db` — PostgreSQL 17, port `5432`, database `streamtube`, user/password `streamtube`
- `mailpit` — SMTP `1025`, web UI `8025`
- `next-frontend` — Next.js app, port `3001` (see `next-frontend/CLAUDE.md`)

All verification and teardown commands run on the **host machine**:

```bash
# Verify NestJS is running (expect 200 + "Hello World!")
curl http://localhost:3000

# Verify PostgreSQL is ready (runs inside the db container)
docker compose exec db pg_isready -U streamtube

# Check container logs
docker compose logs nestjs-api
docker compose logs db

# Tear down the entire environment
docker compose down
```

## Commands (run inside the container via `docker compose exec nestjs-api <cmd>`)

```bash
npm run start:dev                        # Dev server with hot-reload
npm run build                            # Compile to dist/
npm run start:prod                       # Run compiled build

npm test                                 # Unit tests
npm run test:watch                       # Unit tests in watch mode
npm run test:cov                         # Coverage report
npm run test:e2e                         # End-to-end tests

npm run lint                             # ESLint with auto-fix
npm run format                           # Prettier formatting
```

## Installing Dependencies Inside the Container

The `node_modules` directory lives on a **bind mount**. The host owns it as uid `1001`, but the container runs as `node` (uid `1000`). Because of this mismatch, `docker compose exec nestjs-api npm install <pkg>` as the `node` user frequently fails with `EACCES` (seen with `argon2`/`@emnapi`, `@nestjs/throttler`, and others). The same mismatch breaks CLI-generated artifacts (e.g. migrations) that need write access to a source directory.

**Canonical procedure (requires the user's explicit authorization before running anything as root):**

1. Install once as root: `docker compose exec -u root nestjs-api npm install <pkg>`
2. **Immediately** restore ownership so future installs as `node` keep working: `docker compose exec -u root nestjs-api chown -R node:node node_modules`

Do **not** leave `node_modules` owned by root, and do **not** `chmod 777` directories as a permanent fix — restore `node:node` ownership instead. Always ask the user before the root step; never run it silently.

## Long-running Processes

Commands that never exit (dev server, watch modes) must be run in background in the Bash tool — otherwise the agent blocks indefinitely waiting for the process to return.

This applies to: `start:dev`, `start:prod`, `test:watch`, and any other persistent process.

## Architecture

NestJS with standard module structure. Source lives in `src/`, compiled output in `dist/`.

- Each domain feature gets its own module (e.g., `UsersModule`, `VideosModule`) registered in `AppModule`
- Controllers handle HTTP routing; Services hold business logic; both are scoped to their module

## Code Conventions

- **TypeScript:** `nodenext` module resolution, `ES2023` target, `strictNullChecks` on, `noImplicitAny` off
- **Decorators:** `emitDecoratorMetadata` + `experimentalDecorators` enabled — required for NestJS DI
- **Prettier:** single quotes, trailing commas everywhere
- **ESLint:** `no-explicit-any` allowed; `no-floating-promises` and `no-unsafe-argument` are warnings
- **TypeORM `entities` glob:** resolve it relative to `__dirname` (e.g. `join(__dirname, '**/*.entity.{ts,js}')`), never a hardcoded `dist/**/*.entity.js`. A `dist/`-only path does not exist under ts-jest/ts-node and breaks every test that loads `AppModule`; a `__dirname`-relative `{ts,js}` glob works in both ts-jest and the compiled `dist` build.

## OpenAPI Documentation

The `@nestjs/swagger` CLI plugin (`nest-cli.json` → `compilerOptions.plugins`) infers most OpenAPI metadata automatically from DTOs: `classValidatorShim` translates `class-validator` decorators (`@IsEmail`, `@Length`, etc.) into schema constraints, and `introspectComments` turns JSDoc into `description`. Use `@ApiProperty()` explicitly only for: providing `example` values, or disambiguating cases where the plugin's inference is ambiguous (e.g., union types, computed/derived fields). Never use `@ApiProperty()` to redeclare a constraint that `class-validator` already expresses — that duplicates the source of truth and risks drift between validation and documentation.

## OpenAPI Artifact Generation

`nestjs-project/openapi.json` is a versioned, on-demand snapshot of the OpenAPI 3.0 document (`openapi-spec/TD-04`) — regenerate it whenever a controller/DTO contract changes:

```bash
docker compose run --rm nestjs-api npm run openapi:generate
```

This is **never** a `postbuild` hook: `generate-openapi.ts` boots the full `AppModule` context (needs Postgres, Mailpit, and every required env var reachable), so it must run inside the Compose network with the app's dependencies up. The script itself runs against the **compiled build** (`nest build && node dist/openapi/generate-openapi.js`), not `ts-node` directly — the `@nestjs/swagger` CLI compiler plugin (`nest-cli.json`) is only applied by the `nest build`/`nest start` pipeline; plain `tsc`/`ts-node` ignore `compilerOptions.plugins` entirely, which would silently produce DTO schemas with empty `properties: {}`.

## REST Conventions

This is a RESTful API. All endpoints must follow standard REST conventions — correct HTTP methods, proper status codes, plural resource nouns, and consistent URL structure. Details are enforced via rules on controller files.

## Library Documentation Lookup

Before implementing any feature, you MUST use the **context7** MCP tool to look up the relevant library APIs and official documentation.

Always:

- Check the installed library version in the project manifest
- Retrieve the corresponding documentation using context7
- Cross-reference APIs to avoid deprecated or incompatible patterns
- Follow the official documentation over training data
- **Check peer dependencies and transitive `@types` before installing or upgrading.** Picking the "latest" version has broken the build here more than once: `@nestjs-modules/mailer@2.3.x` requires `nodemailer>=8` while this project uses `nodemailer@6` (pinned to `2.1.19`), and installing `@types/passport-jwt` pulled a newer `@types/jsonwebtoken` whose `expiresIn` type changed from `string` to `ms`'s `StringValue`. Verify compatibility with the versions already in `package.json`, not just the API surface.

Skip documentation lookup only for trivial operations such as:

- Variable declarations
- Basic control flow
- Simple CRUD using established project patterns

If a library is involved and there is uncertainty, documentation lookup is mandatory.
If the documentation returned does not match the installed version, flag the discrepancy before proceeding.