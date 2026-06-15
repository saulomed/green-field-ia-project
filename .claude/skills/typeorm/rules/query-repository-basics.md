---
title: Repository Basics
impact: HIGH
tags: [repository, querying, crud]
---

## query-repository-basics

Use the typed repository methods for standard CRUD. Prefer `findOneOrFail` when absence is an error.

```typescript
const userRepository = AppDataSource.getRepository(User);

// Read
const users = await userRepository.find({ where: { isActive: true } });
const user = await userRepository.findOne({ where: { id: 1 } }); // null if not found
const user = await userRepository.findOneOrFail({ where: { id: 1 } }); // throws if not found

// Create + Save
const newUser = userRepository.create({ email: "user@example.com", name: "John" });
await userRepository.save(newUser); // INSERT or UPDATE (upsert by PK)

// Update (does not trigger entity lifecycle hooks)
await userRepository.update({ id: 1 }, { name: "Jane" });

// Delete
await userRepository.delete({ id: 1 });

// Soft delete (requires @DeleteDateColumn on entity)
await userRepository.softDelete({ id: 1 });
await userRepository.restore({ id: 1 }); // undo soft delete
```

`save()` performs an upsert based on the PK — it loads existing data first to merge. For bulk updates, prefer `update()` which hits the DB directly without loading entities.
