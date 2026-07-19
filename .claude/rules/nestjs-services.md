---
paths:
  - 'nestjs-project/**/*.service.ts'
description: 'Service layer error handling — errors must always propagate to upper layers'
---

# Service Error Handling Rules

## Never Swallow Errors

Services must never catch an error and silently ignore it. Every error must either:
1. **Propagate naturally** — don't catch it at all, let it bubble up
2. **Be re-thrown** — catch to add context or transform, then re-throw

A `try/catch` that logs and returns `null`, `undefined`, `false`, or an empty value instead of throwing is a silent failure. This hides bugs and makes debugging extremely difficult.

## Bad: swallowing the error

```typescript
async findById(id: string): Promise<User | null> {
  try {
    return await this.userRepository.findOneByOrFail({ id });
  } catch (error) {
    this.logger.error('User not found', error);
    return null; // caller has no idea something went wrong
  }
}
```

## Good: let it propagate or re-throw with context

```typescript
async findById(id: string): Promise<User> {
  const user = await this.userRepository.findOneBy({ id });
  if (!user) {
    throw new EntityNotFoundException('User', id);
  }
  return user;
}
```

## Good: catch, enrich, re-throw

```typescript
async createChannel(dto: CreateChannelDto): Promise<Channel> {
  try {
    return await this.channelRepository.save(dto);
  } catch (error) {
    if (error.code === '23505') {
      throw new DuplicateEntityException('Channel', 'name');
    }
    throw error; // unknown errors propagate as-is
  }
}
```

## The Rule

### Request lifecycle (services invocados por controllers)

- `catch` blocks must always end with a `throw` — either the original error or a more specific one
- The only exception is when the catch is intentionally converting an error into a valid domain result (e.g., `findOneBy` returning `null` is not an error — a `try/catch` that swallows `findOneByOrFail` is)
- Throw domain exceptions (custom `Error` subclasses) — never throw NestJS HTTP exceptions (`NotFoundException`, `ConflictException`, etc.) from services. Services must not be aware of the transport layer. Exception filters are responsible for mapping domain exceptions to HTTP responses
- Logging inside a catch is fine, but logging is not a substitute for throwing

### Unique constraints are the real arbiter of uniqueness — catch `23505`

A pre-insert `exists`/`findOne` check does **not** close the race: under READ COMMITTED it takes no row lock, so two concurrent transactions both read `false`, both insert, and the DB's unique index is the only thing that actually rejects the duplicate. If you rely solely on the pre-check, the loser of the race gets an untreated `QueryFailedError` (`code === '23505'`) → **500 instead of 409**.

So, for any insert guarded by uniqueness (email, nickname, slug):

- A pre-check is still useful as **fail-fast** (skip expensive work like argon2 hashing before opening a transaction), but it is not the guarantee.
- The `catch` around the insert MUST map `error.code === '23505'` to the appropriate domain exception (e.g. `EmailAlreadyExistsException`) and re-throw. Unknown errors still propagate as-is (see the "catch, enrich, re-throw" example above).

### Background tasks, event handlers e cron jobs

- In these contexts, rethrowing would crash the process. `catch` blocks should log the error and optionally queue for retry or send to a dead letter queue
- These are the **only** contexts where catch-and-log without rethrowing is acceptable