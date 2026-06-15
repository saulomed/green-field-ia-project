---
title: NestJS Module Setup
impact: HIGH
tags: [nestjs, typeorm-module, forRoot, forFeature]
---

## nestjs-module-setup

Configure TypeORM with `TypeOrmModule.forRoot` at the app level and `TypeOrmModule.forFeature` per feature module.

```typescript
// app.module.ts
import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { ConfigModule, ConfigService } from "@nestjs/config";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: "postgres",
        host: config.get("DB_HOST"),       // use Compose service name, not localhost
        port: config.get<number>("DB_PORT"),
        username: config.get("DB_USERNAME"),
        password: config.get("DB_PASSWORD"),
        database: config.get("DB_NAME"),
        entities: [__dirname + "/**/*.entity{.ts,.js}"],
        migrations: [__dirname + "/migrations/**{.ts,.js}"],
        synchronize: false,                // NEVER true in production
        logging: config.get("NODE_ENV") === "development",
      }),
    }),
    UsersModule,
  ],
})
export class AppModule {}

// users/users.module.ts
@Module({
  imports: [TypeOrmModule.forFeature([User])],
  providers: [UsersService],
  controllers: [UsersController],
  exports: [UsersService],
})
export class UsersModule {}
```

Use `forRootAsync` with `ConfigService` instead of `forRoot` — it resolves env vars at startup and avoids hardcoded credentials.
