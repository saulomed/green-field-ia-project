---
title: Injecting Repositories in NestJS
impact: HIGH
tags: [nestjs, inject-repository, constructor-injection]
---

## nestjs-inject-repository

Inject repositories via constructor using `@InjectRepository`. Never use property injection or `getRepository` directly.

```typescript
// Incorrect: property injection, bypasses DI validation at startup
@Injectable()
export class UsersService {
  @InjectRepository(User)
  private usersRepository: Repository<User>; // not initialized at construction
}

// Correct: constructor injection with readonly
import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { User } from "./user.entity";

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
  ) {}

  findAll(): Promise<User[]> {
    return this.usersRepository.find();
  }

  findOne(id: number): Promise<User | null> {
    return this.usersRepository.findOneBy({ id });
  }
}
```

For custom repositories, provide them as a factory in the module providers instead of using `@InjectRepository`:

```typescript
// users/users.module.ts
@Module({
  imports: [TypeOrmModule.forFeature([User])],
  providers: [
    UsersService,
    { provide: UserRepository, useFactory: (ds: DataSource) => new UserRepository(ds), inject: [DataSource] },
  ],
})
export class UsersModule {}
```
