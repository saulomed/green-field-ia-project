---
title: Custom Repository
impact: HIGH
tags: [repository, custom-repository, data-mapper]
---

## query-custom-repository

Extend `Repository<T>` to encapsulate domain-specific query logic.

```typescript
// Incorrect: business query logic scattered across service methods
@Injectable()
export class UsersService {
  findByEmail(email: string) {
    return this.repo.findOne({ where: { email } });
  }
  findActiveUsers() {
    return this.repo.find({ where: { isActive: true }, order: { createdAt: "DESC" } });
  }
}

// Correct: custom repository owns the query logic
import { Repository, DataSource } from "typeorm";

export class UserRepository extends Repository<User> {
  constructor(private dataSource: DataSource) {
    super(User, dataSource.createEntityManager());
  }

  findByEmail(email: string): Promise<User | null> {
    return this.findOne({ where: { email } });
  }

  findActiveUsers(): Promise<User[]> {
    return this.find({
      where: { isActive: true },
      order: { createdAt: "DESC" },
    });
  }

  findWithPosts(userId: number): Promise<User | null> {
    return this.findOne({
      where: { id: userId },
      relations: { posts: true },
    });
  }
}
```

Register the custom repository as a provider in the NestJS module and inject via constructor. See `nestjs-inject-repository.md` for wiring.
