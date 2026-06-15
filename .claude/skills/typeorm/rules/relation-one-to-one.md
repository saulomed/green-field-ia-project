---
title: One-to-One Relationship
impact: HIGH
tags: [relationships, one-to-one, join-column]
---

## relation-one-to-one

Use `@OneToOne` with `@JoinColumn` on the owning side. Define both sides of the relation.

```typescript
@Entity()
export class User {
  @PrimaryGeneratedColumn()
  id: number;

  // Owning side holds the FK column; cascade saves/removes Profile with User
  @OneToOne(() => Profile, (profile) => profile.user, { cascade: true })
  @JoinColumn()
  profile: Profile;
}

@Entity()
export class Profile {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  bio: string;

  // Inverse side — no @JoinColumn here
  @OneToOne(() => User, (user) => user.profile)
  user: User;
}
```

`@JoinColumn` must be on exactly one side — the entity that owns the foreign key column. `cascade: true` propagates `save` and `remove` to the related entity.
