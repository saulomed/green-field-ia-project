---
title: Basic Entity Definition
impact: HIGH
tags: [entity, decorators, columns]
---

## entity-basic

Define entities with `@Entity`, typed columns, and automatic timestamp columns.

```typescript
// Incorrect: missing table name, no timestamps, implicit types
@Entity()
export class User {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  email: string;
}

// Correct
import {
  Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn, UpdateDateColumn,
} from "typeorm";

@Entity("users")
export class User {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: "varchar", length: 255, unique: true })
  email: string;

  @Column({ type: "varchar", length: 255, nullable: true })
  name: string | null;

  @Column({ type: "boolean", default: true })
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
```

Always specify the table name in `@Entity("table_name")` to avoid implicit naming surprises across environments.
