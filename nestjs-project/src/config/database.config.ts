import { registerAs, ConfigType } from '@nestjs/config';
import { DataSourceOptions } from 'typeorm';

/**
 * Builds PostgreSQL connection options from an environment variable map.
 *
 * Pure function shared by three consumers: the Nest DI context (databaseConfig
 * namespace), the TypeORM CLI (data-source.ts) and the seed runner — single
 * source of truth for DB connection params.
 *
 * @author Saulo Santos
 * @date 15/06/2026
 * @param env - environment variable map (process.env or a test stub)
 * @returns DataSourceOptions ready for TypeORM
 */
export function buildDatabaseOptions(env: NodeJS.ProcessEnv): DataSourceOptions {
  return {
    type: 'postgres',
    host: env.DB_HOST,
    port: Number(env.DB_PORT),
    username: env.DB_USER,
    password: env.DB_PASSWORD,
    database: env.DB_NAME,
    synchronize: false,
    logging: false,
    migrationsTableName: 'typeorm_migrations',
    migrations: ['dist/database/migrations/**/*.js'],
    entities: ['dist/**/*.entity.js'],
  };
}

/**
 * Database configuration namespace registered with @nestjs/config.
 * Injected in DatabaseModule via ConfigType for strong typing.
 *
 * @author Saulo Santos
 * @date 15/06/2026
 */
export const databaseConfig = registerAs('database', () =>
  buildDatabaseOptions(process.env),
);

export type DatabaseConfig = ConfigType<typeof databaseConfig>;
