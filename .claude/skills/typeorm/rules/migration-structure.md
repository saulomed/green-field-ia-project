---
title: Migration File Structure
impact: HIGH
tags: [migrations, schema, up-down]
---

## migration-structure

Every migration must implement `up` (apply) and `down` (revert). Always revert cleanly.

```typescript
import { MigrationInterface, QueryRunner, Table, TableIndex } from "typeorm";

export class CreateUsers1234567890 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: "users",
        columns: [
          {
            name: "id",
            type: "int",
            isPrimary: true,
            isGenerated: true,
            generationStrategy: "increment",
          },
          { name: "email", type: "varchar", length: "255", isUnique: true },
          { name: "name", type: "varchar", length: "255", isNullable: true },
          { name: "is_active", type: "boolean", default: true },
          { name: "created_at", type: "timestamp", default: "CURRENT_TIMESTAMP" },
          {
            name: "updated_at",
            type: "timestamp",
            default: "CURRENT_TIMESTAMP",
            onUpdate: "CURRENT_TIMESTAMP",
          },
        ],
      }),
      true // ifNotExists
    );

    await queryRunner.createIndex(
      "users",
      new TableIndex({ name: "IDX_USERS_EMAIL", columnNames: ["email"] })
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropIndex("users", "IDX_USERS_EMAIL");
    await queryRunner.dropTable("users");
  }
}
```

The timestamp in the class name (e.g. `1234567890`) is added automatically by `migration:generate` to ensure ordering. Never rename migration files after committing them.
