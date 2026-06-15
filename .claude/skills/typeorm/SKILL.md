---
name: typeorm
description: "TypeORM patterns and best practices for database-driven NestJS applications.
TRIGGER when: planning or implementing features involving entities, repositories, migrations, queries, or TypeORM/database integration.
DO NOT TRIGGER when: only reading database code, working on non-database logic, or discussing general SQL/TypeScript concepts."
---

# TypeORM Guidelines

Light index — read individual rule files for detailed patterns and code examples.

## Categories by Priority

| Priority | Category | Rules |
|---|---|---|
| 1 | Migrations | `migration-usage`, `migration-structure` |
| 2 | Transactions | `transaction-datasource`, `transaction-query-runner` |
| 3 | Entities | `entity-basic`, `entity-columns`, `entity-primary-keys` |
| 4 | Relationships | `relation-one-to-one`, `relation-one-to-many`, `relation-many-to-many`, `relation-cascade` |
| 5 | Querying | `query-repository-basics`, `query-custom-repository`, `query-builder` |
| 6 | NestJS Integration | `nestjs-module-setup`, `nestjs-inject-repository` |
| 7 | Performance | `perf-avoid-n-plus-one`, `perf-indexes` |
| 8 | Configuration | `config-data-source`, `config-naming-strategy`, `config-typescript` |

## Quick Rules

- NEVER `synchronize: true` in production → `rules/migration-usage.md`
- Always explicit FK column alongside `@ManyToOne` → `rules/relation-one-to-many.md`
- Prefer `AppDataSource.transaction()` over manual QueryRunner → `rules/transaction-datasource.md`
- Prefer explicit `relations: {}` over lazy loading; allow lazy `Promise<>` only for relations that are rarely accessed → `rules/relation-cascade.md`
- Always parameterize query builder values — never interpolate user input → `rules/query-builder.md`
- Use `forRootAsync` with `ConfigService`, never hardcode credentials → `rules/nestjs-module-setup.md`

## How to Use

Load a rule file when its topic applies to the current task:

```
rules/migration-usage.md
rules/entity-basic.md
rules/nestjs-module-setup.md
```

Each rule file contains: the problem, an incorrect example, a correct example, and additional context.
