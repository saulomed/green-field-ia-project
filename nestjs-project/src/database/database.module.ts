import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { databaseConfig } from '../config/database.config';
import type { DatabaseConfig } from '../config/database.config';

/**
 * Global database module. Registers TypeORM using the namespaced databaseConfig
 * provider — no magic strings, fully typed via ConfigType.
 *
 * @author Saulo Santos
 * @date 15/06/2026
 */
@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      inject: [databaseConfig.KEY],
      useFactory: (config: DatabaseConfig) => config,
    }),
  ],
})
export class DatabaseModule {}
