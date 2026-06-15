---
title: Transactions — QueryRunner
impact: CRITICAL
tags: [transactions, query-runner, rollback]
---

## transaction-query-runner

Use `QueryRunner` when you need fine-grained control (savepoints, multiple commits, mixed raw SQL).

```typescript
const queryRunner = AppDataSource.createQueryRunner();
await queryRunner.connect();
await queryRunner.startTransaction();

try {
  const user = queryRunner.manager.create(User, {
    email: "user@example.com",
    name: "User",
  });
  await queryRunner.manager.save(user);

  const post = queryRunner.manager.create(Post, {
    title: "First Post",
    author: user,
  });
  await queryRunner.manager.save(post);

  await queryRunner.commitTransaction();
} catch (error) {
  await queryRunner.rollbackTransaction();
  throw error;
} finally {
  await queryRunner.release(); // always release the connection
}
```

`release()` in `finally` is mandatory — omitting it leaks connections from the pool. For most cases, prefer `AppDataSource.transaction()` (see `transaction-datasource.md`) — it handles `commit`/`rollback`/`release` automatically.
