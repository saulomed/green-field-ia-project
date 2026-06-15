---
title: Avoid N+1 Queries
impact: HIGH
tags: [performance, n-plus-one, relations, query-builder]
---

## perf-avoid-n-plus-one

Load relations in a single query using `relations` option or `leftJoinAndSelect` — never access unloaded relations in a loop.

```typescript
// Incorrect: N+1 — one query per user to load posts
const users = await userRepository.find();
for (const user of users) {
  console.log(user.posts); // triggers a separate SELECT for each user
}

// Correct option 1: explicit relations loading (1 extra JOIN query)
const users = await userRepository.find({
  relations: { posts: true },
});

// Correct option 2: query builder with JOIN (single query)
const users = await userRepository
  .createQueryBuilder("user")
  .leftJoinAndSelect("user.posts", "post")
  .where("user.isActive = :isActive", { isActive: true })
  .getMany();

// Correct option 3: when you only need a subset of relation data
const users = await userRepository
  .createQueryBuilder("user")
  .leftJoin("user.posts", "post")
  .addSelect(["post.id", "post.title"])
  .getMany();
```

`relations: { posts: true }` executes a second query with `WHERE user_id IN (...)`. `leftJoinAndSelect` fetches everything in one SQL statement — better for large result sets.
