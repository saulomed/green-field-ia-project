import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { databaseConfig } from '../config/database.config';

/**
 * Global database module. Registers TypeORM directly from the namespaced
 * databaseConfig provider via asProvider() — no magic strings, fully typed.
 *
 * @author Saulo Santos
 * @date 15/06/2026
 */
@Module({
  imports: [TypeOrmModule.forRootAsync(databaseConfig.asProvider())],
})
export class DatabaseModule {}
