---
title: Query Builder
impact: HIGH
tags: [query-builder, joins, raw-queries, bulk-insert]
---

## query-builder

Use `createQueryBuilder` for complex joins, aggregations, or bulk operations not expressible with `find`.

```typescript
// SELECT with join and pagination
const users = await userRepository
  .createQueryBuilder("user")
  .leftJoinAndSelect("user.posts", "post")
  .where("user.isActive = :isActive", { isActive: true })
  .andWhere("post.publishedAt IS NOT NULL")
  .orderBy("user.createdAt", "DESC")
  .skip(offset)
  .take(limit)
  .getMany();

// Aggregation (raw result)
const { count } = await userRepository
  .createQueryBuilder("user")
  .select("COUNT(*)", "count")
  .where("user.isActive = :isActive", { isActive: true })
  .getRawOne<{ count: string }>();

// Bulk INSERT (bypasses entity lifecycle hooks — use when performance matters)
await userRepository
  .createQueryBuilder()
  .insert()
  .into(User)
  .values([
    { email: "user1@example.com", name: "User 1" },
    { email: "user2@example.com", name: "User 2" },
  ])
  .execute();
```

Always use parameterized values (`:param` syntax) — never string-interpolate user input into query builder calls.
