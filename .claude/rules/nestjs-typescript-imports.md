---
paths:
  - 'nestjs-project/src/**/*.ts'
description: 'TypeScript import conventions for NestJS — type-only imports in decorated signatures, CJS interop, no internal dist/ paths'
---

# TypeScript Import Rules

This project uses `emitDecoratorMetadata` + `isolatedModules` + `esModuleInterop`. The combination has a few sharp edges that have broken the build during Phase 02. Follow these to avoid re-discovering them.

## Type-only imports in decorated signatures

A type referenced **only** in a decorated parameter/method signature (e.g. `@Req()`, `@Res()`, `@Param()`) must be imported with `import type` — otherwise `isolatedModules` + `emitDecoratorMetadata` raises **TS1272** (`'X' is a type and must be imported using a type-only import`).

```typescript
// Good
import type { Response } from 'express';
import type { AuthenticatedRequest } from './types/authenticated-request';

@Post('login')
login(@Req() req: AuthenticatedRequest, @Res({ passthrough: true }) res: Response) { ... }
```

Rule of thumb: if a symbol is used purely as a type annotation, `import type` it. Only value imports (classes you instantiate, decorators, enums used as values) stay as normal imports.

## CommonJS interop

Some dependencies are CommonJS and export a callable via `module.exports`. Under `esModuleInterop`, importing them with `import * as x` makes `x` the namespace object, which is **not callable** — **TS2349** (`This expression is not callable`) at build time (passes in ts-jest, fails in `npm run build`).

```typescript
// Bad — TS2349 on cookieParser()
import * as cookieParser from 'cookie-parser';

// Good — default import
import cookieParser from 'cookie-parser';
```

If a value comes from a CJS package and you call it, use a **default import**.

## Never import a package's internal `dist/` path

Import only from a package's public entry points. Reaching into `some-pkg/dist/...` bypasses the package's `exports` map and breaks at runtime for any consumer that respects it.

```typescript
// Bad — violates the package's exports map, breaks every test that loads AppModule
import { HandlebarsAdapter } from '@nestjs-modules/mailer/dist/adapters/handlebars.adapter';

// Good — use the documented public export
import { HandlebarsAdapter } from '@nestjs-modules/mailer';
```

If the symbol you need is not exported from the package root, consult the library docs (context7) for the supported import path — do not guess at `dist/` layout.
