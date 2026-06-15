---
title: Cascade and Loading Strategy
impact: HIGH
tags: [relationships, cascade, eager-loading, lazy-loading, n-plus-one]
---

## relation-cascade

Prefer explicit `relations: []` loading over eager or lazy options on the decorator.

```typescript
// Avoid: lazy Promise<> relation as the default — silently runs extra queries on access,
// hard to control, breaks non-async contexts.
// Acceptable only when the relation is rarely accessed and Promise<> is intentional.
@OneToMany(() => Post, (post) => post.author)
posts: Promise<Post[]>; // lazy — use only for rarely-accessed relations

// Avoid: eager: true as the default — loads relation on EVERY query.
// Acceptable only for low-cardinality relations that are always needed (e.g., user.role).
@OneToMany(() => Post, (post) => post.author, { eager: true })
posts: Post[];

// Correct: load explicitly when needed
const user = await userRepository.findOne({
  where: { id: userId },
  relations: { posts: true },
});

// Correct: cascade on save/remove when the parent owns the lifecycle
@OneToOne(() => Profile, (profile) => profile.user, { cascade: true })
@JoinColumn()
profile: Profile;

// Correct: database-level cascade for referential integrity
@ManyToOne(() => User, (user) => user.posts, { onDelete: "CASCADE" })
author: User;
```

`cascade: true` on the TypeORM side controls application-level save/remove propagation. `onDelete: "CASCADE"` is a database constraint — both can coexist and serve different purposes.
