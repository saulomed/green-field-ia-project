---
title: Many-to-Many Relationship
impact: HIGH
tags: [relationships, many-to-many, join-table]
---

## relation-many-to-many

Put `@JoinTable` on the owning side and name the junction table and columns explicitly.

```typescript
@Entity()
export class Post {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  title: string;

  // Owning side: defines the junction table
  @ManyToMany(() => Tag, (tag) => tag.posts)
  @JoinTable({
    name: "post_tags",
    joinColumn: { name: "post_id" },
    inverseJoinColumn: { name: "tag_id" },
  })
  tags: Tag[];
}

@Entity()
export class Tag {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true })
  name: string;

  // Inverse side — no @JoinTable
  @ManyToMany(() => Post, (post) => post.tags)
  posts: Post[];
}
```

Naming the junction table and columns explicitly avoids auto-generated names that differ across TypeORM versions.
