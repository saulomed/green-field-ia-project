import 'reflect-metadata';
import * as dotenv from 'dotenv';
import { DataSource } from 'typeorm';
import { buildDatabaseOptions } from '../config/database.config';

dotenv.config();

// CLI migration paths are fixed to src/ (ts-node); entities resolve automatically
// via __dirname in database.config.ts, so no override is needed here for those.
export const AppDataSource = new DataSource({
  ...buildDatabaseOptions(process.env),
  migrations: ['src/database/migrations/**/*{.js,.ts}'],
  entities: ['src/**/*.entity{.js,.ts}'],
});
