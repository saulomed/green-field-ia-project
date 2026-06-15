---
title: Database Indexes
impact: HIGH
tags: [performance, indexes, query-optimization]
---

## perf-indexes

Add indexes on columns used in `WHERE`, `JOIN ON`, and `ORDER BY` clauses.

```typescript
// Single-column index via @Index on the column
@Entity()
export class User {
  @Column()
  @Index()
  email: string;
}

// Single-column index via @Index on the entity
@Entity()
@Index(["email"])
export class User {
  @Column()
  email: string;
}

// Composite index — useful when queries filter by multiple columns together
@Entity()
@Index(["firstName", "lastName"])
export class User {
  @Column()
  firstName: string;

  @Column()
  lastName: string;
}

// Unique constraint with index
@Entity()
export class Channel {
  @Column({ unique: true })
  slug: string; // unique columns are automatically indexed
}
```

Indexes speed up reads but slow down writes. Add them only for columns with high-cardinality values that appear in query filters. Verify with `EXPLAIN ANALYZE` in PostgreSQL before committing index changes.
