---
paths:
  - 'nestjs-project/**/*.entity.ts'
description: 'TypeORM entity conventions for database models'
---

# Entity Rules

## Naming and Structure

- Always pass an explicit table name to `@Entity('table_name')` — do not rely on auto-generated names
- Use UUID as primary key: `@PrimaryGeneratedColumn('uuid')`
- Always include timestamp columns: `@CreateDateColumn()` and `@UpdateDateColumn()`

## Column Conventions

- Sensitive fields (passwords, tokens) must use `{ select: false }` to exclude from default queries
- Use `{ unique: true }` for naturally unique fields (email, slug)
- Define explicit column types when the default mapping is ambiguous

## Relationships

- Define the inverse side of a relationship **only when it is actually loaded and used**. Do **not** declare a bidirectional relation "for symmetry" if nothing ever populates the inverse side. A relation declared but never loaded — and typed as non-optional (`channel: Channel`) — is a runtime trap: `user.channel.nickname` passes the type-check and throws at runtime. If a side is only sometimes loaded, type it optional (`channel?: Channel`) so callers are forced to null-check. If it is never loaded, keep the relation unidirectional (the owning side / FK is enough).
- The owning side holds the FK; a unidirectional `@ManyToOne` on the owning side needs no `@OneToMany` on the other end unless you query from that end.
- Prefer explicit relation loading (`relations: [...]`) — load only what each query needs
- Use eager loading only for low-cardinality, always-needed relations (e.g., `user.role`)
- Use lazy loading only when the relation is rarely accessed and the `Promise<>` type is acceptable

## Schema Changes

- Never modify an entity without creating a corresponding migration
- Never use `synchronize: true` in production — only in early development if at all
- Generate migrations via TypeORM CLI, not by hand