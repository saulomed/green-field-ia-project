---
title: Naming Strategy
impact: MEDIUM
tags: [configuration, naming-strategy, snake-case]
---

## config-naming-strategy

Use a `SnakeNamingStrategy` to map camelCase TypeScript properties to snake_case database columns automatically.

```typescript
import { DefaultNamingStrategy, NamingStrategyInterface } from "typeorm";
import { snakeCase } from "typeorm/util/StringUtils";

export class SnakeNamingStrategy
  extends DefaultNamingStrategy
  implements NamingStrategyInterface
{
  tableName(targetName: string, userSpecifiedName?: string): string {
    return userSpecifiedName ?? snakeCase(targetName);
  }

  columnName(
    propertyName: string,
    customName: string,
    embeddedPrefixes: string[],
  ): string {
    return (
      snakeCase(embeddedPrefixes.join("_")) +
      (customName ? customName : snakeCase(propertyName))
    );
  }
}

// data-source.ts / TypeOrmModule config
import { SnakeNamingStrategy } from "./snake-naming.strategy";

DataSource({
  // ...
  namingStrategy: new SnakeNamingStrategy(),
});
```

Without a naming strategy, TypeORM uses the property name as-is for column names, which produces mixed-case column names in PostgreSQL (case-sensitive without quoting).
