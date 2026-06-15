import 'reflect-metadata';
import * as dotenv from 'dotenv';
import { DataSource } from 'typeorm';

dotenv.config();

// Register new seeders here as they are created in future phases.
const seeders: Array<(dataSource: DataSource) => Promise<void>> = [];

async function runSeeds(): Promise<void> {
  const dataSource = new DataSource({
    type: 'postgres',
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT),
    username: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    synchronize: false,
    entities: ['src/**/*.entity{.js,.ts}'],
  });

  await dataSource.initialize();
  console.log('DataSource initialized. Running seeders...');

  for (const seeder of seeders) {
    await seeder(dataSource);
  }

  console.log(`All seeders completed (${seeders.length} seeders executed).`);
  await dataSource.destroy();
}

runSeeds().catch((err) => {
  console.error('Seed runner failed:', err);
  process.exit(1);
});
