import 'reflect-metadata';
import * as dotenv from 'dotenv';
import { DataSource } from 'typeorm';
import { buildDatabaseOptions } from '../config/database.config';

dotenv.config();

// CLI paths use src/ (ts-node); the app runtime uses dist/ (see database.config.ts)
export const AppDataSource = new DataSource({
  ...buildDatabaseOptions(process.env),
  migrations: ['src/database/migrations/**/*{.js,.ts}'],
  entities: ['src/**/*.entity{.js,.ts}'],
});
