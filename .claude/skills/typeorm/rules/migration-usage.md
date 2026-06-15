---
title: Migrations — Never synchronize in Production
impact: CRITICAL
tags: [migrations, production, synchronize]
---

## migration-usage

`synchronize: true` auto-alters the schema on startup — it can silently drop columns in production. Always use migrations.

```typescript
// Incorrect — NEVER in production
DataSource({
  synchronize: true, // drops/alters tables to match entities on every restart
})

// Correct
DataSource({
  synchronize: false,
  migrations: ["src/migrations/**/*.ts"],
})
```

### Migration CLI Commands

```bash
# Generate migration from entity diff
npx typeorm migration:generate src/migrations/AddUsersTable -d src/data-source.ts

# Create empty migration for data transforms
npx typeorm migration:create src/migrations/SeedInitialRoles

# Apply pending migrations
npx typeorm migration:run -d src/data-source.ts

# Revert last applied migration
npx typeorm migration:revert -d src/data-source.ts
```

Run `migration:generate` after every entity change to keep migrations in sync. Commit migration files — they are the source of truth for schema evolution.
