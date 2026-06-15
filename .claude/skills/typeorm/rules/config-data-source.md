---
title: DataSource Configuration
impact: HIGH
tags: [configuration, data-source, connection-pool, ssl]
---

## config-data-source

Configure `DataSource` from environment variables. Never hardcode credentials.

```typescript
// data-source.ts (used by TypeORM CLI for migrations)
import { DataSource } from "typeorm";

export const AppDataSource = new DataSource({
  type: "postgres",
  host: process.env.DB_HOST,           // Docker Compose service name, e.g. "db"
  port: parseInt(process.env.DB_PORT ?? "5432"),
  username: process.env.DB_USERNAME,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,

  entities: [__dirname + "/entities/**/*.entity{.ts,.js}"],
  migrations: [__dirname + "/migrations/**{.ts,.js}"],

  synchronize: false,                  // never true in production

  logging: process.env.NODE_ENV === "development",

  poolSize: 10,                        // tune based on DB max_connections

  ssl: process.env.NODE_ENV === "production"
    ? { rejectUnauthorized: true }
    : false,
});
```

In Docker Compose, `DB_HOST` must be the Compose service name (e.g. `db`), not `localhost`. See project CLAUDE.md for the Docker networking rule.
