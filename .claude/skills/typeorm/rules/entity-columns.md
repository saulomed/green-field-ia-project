---
title: Column Types
impact: HIGH
tags: [entity, columns, soft-delete, optimistic-locking]
---

## entity-columns

Use explicit column types. Add `@DeleteDateColumn` for soft deletes and `@VersionColumn` for optimistic locking.

```typescript
@Entity()
export class Product {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: "varchar", length: 255 })
  name: string;

  @Column({ type: "text", nullable: true })
  description: string | null;

  @Column({ type: "decimal", precision: 10, scale: 2 })
  price: number;

  @Column({ type: "int", default: 0 })
  stock: number;

  @Column({ type: "boolean", default: true })
  isAvailable: boolean;

  @Column({ type: "jsonb", nullable: true })
  metadata: Record<string, unknown> | null;

  @Column({
    type: "enum",
    enum: ["active", "inactive", "pending"],
    default: "pending",
  })
  status: "active" | "inactive" | "pending";

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @DeleteDateColumn()
  deletedAt: Date | null; // enables soft delete via softDelete()

  @VersionColumn()
  version: number; // increments on every save; use for optimistic locking
}
```

Use `jsonb` (not `json`) on PostgreSQL — it supports indexing and is more efficient for reads.
