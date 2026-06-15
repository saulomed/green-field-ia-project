---
title: TypeScript Configuration
impact: HIGH
tags: [configuration, typescript, decorators]
---

## config-typescript

TypeORM decorators require specific `tsconfig.json` flags. Without them, relations and entity metadata will not resolve correctly at runtime.

```json
{
  "compilerOptions": {
    "experimentalDecorators": true,
    "emitDecoratorMetadata": true,
    "strict": true,
    "target": "ES2020",
    "module": "commonjs",
    "moduleResolution": "node"
  }
}
```

`emitDecoratorMetadata` is required for TypeORM to read TypeScript type information at runtime (e.g., column types, relation targets). It depends on the `reflect-metadata` package being imported once at app bootstrap:

```typescript
// main.ts
import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  await app.listen(3000);
}
bootstrap();
```

NestJS imports `reflect-metadata` automatically, but standalone TypeORM projects must do it explicitly.
