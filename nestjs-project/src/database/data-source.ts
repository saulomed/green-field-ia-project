import 'reflect-metadata';
import { DataSource } from 'typeorm';

export const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT),
  username: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  synchronize: false,
  logging: false,
  migrationsTableName: 'typeorm_migrations',
  migrations: ['src/database/migrations/**/*{.js,.ts}'],
  entities: ['src/**/*.entity{.js,.ts}'],
});
