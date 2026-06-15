---
title: One-to-Many / Many-to-One Relationship
impact: HIGH
tags: [relationships, one-to-many, many-to-one, foreign-key]
---

## relation-one-to-many

Always declare an explicit FK column alongside `@ManyToOne` for direct filtering without joining.

```typescript
@Entity()
export class User {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  name: string;

  @OneToMany(() => Post, (post) => post.author)
  posts: Post[];
}

@Entity()
export class Post {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  title: string;

  @ManyToOne(() => User, (user) => user.posts, { onDelete: "CASCADE" })
  @JoinColumn({ name: "author_id" })
  author: User;

  // Explicit FK column — allows WHERE author_id = ? without loading the relation
  @Column()
  authorId: number;
}
```

`onDelete: "CASCADE"` is enforced at the database level. Use `nullable: false` on the FK column when the relation is mandatory.
