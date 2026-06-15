---
title: Transactions — DataSource.transaction()
impact: CRITICAL
tags: [transactions, datasource, rollback]
---

## transaction-datasource

Prefer `AppDataSource.transaction()` for most cases — it automatically commits, rolls back on error, and releases the connection.

```typescript
// Incorrect: manual QueryRunner without proper cleanup
const qr = AppDataSource.createQueryRunner();
await qr.connect();
await qr.startTransaction();
await qr.manager.save(User, userData);
await qr.commitTransaction();
// Forgot release() — connection leak!

// Correct: transaction() manages the lifecycle
await AppDataSource.transaction(async (manager) => {
  const user = manager.create(User, {
    email: "user@example.com",
    name: "User",
  });
  await manager.save(user);

  const post = manager.create(Post, {
    title: "First Post",
    author: user,
  });
  await manager.save(post);
  // Any exception here triggers automatic rollback
});
```

In NestJS with `@Transactional` support, inject `DataSource` and wrap service methods:

```typescript
constructor(private readonly dataSource: DataSource) {}

async createUserWithProfile(dto: CreateUserDto): Promise<User> {
  return this.dataSource.transaction(async (manager) => {
    const user = manager.create(User, dto);
    await manager.save(user);
    const profile = manager.create(Profile, { user });
    await manager.save(profile);
    return user;
  });
}
```
