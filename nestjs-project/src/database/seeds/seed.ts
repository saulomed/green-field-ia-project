import 'reflect-metadata';
import * as dotenv from 'dotenv';
import { DataSource } from 'typeorm';
import { buildDatabaseOptions } from '../../config/database.config';

dotenv.config();

// Register new seeders here as they are created in future phases.
const seeders: Array<(dataSource: DataSource) => Promise<void>> = [];

async function runSeeds(): Promise<void> {
  const dataSource = new DataSource({
    ...buildDatabaseOptions(process.env),
    entities: [],
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
