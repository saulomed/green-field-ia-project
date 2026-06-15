---
title: Primary Key Options
impact: MEDIUM
tags: [entity, primary-key, uuid, composite]
---

## entity-primary-keys

Choose the right primary key strategy for each entity.

```typescript
// Auto-increment integer (default, simpler joins)
@PrimaryGeneratedColumn()
id: number;

// UUID (globally unique, good for distributed systems or public-facing IDs)
@PrimaryGeneratedColumn("uuid")
id: string;

// Custom/manually assigned primary key
@PrimaryColumn()
id: string;

// Composite primary key (junction tables, natural keys)
@Entity()
export class OrderItem {
  @PrimaryColumn()
  orderId: number;

  @PrimaryColumn()
  productId: number;
}
```

Prefer UUIDs when entity IDs are exposed in URLs or shared across services. Use composite PKs only for junction tables or when a natural compound key exists.
