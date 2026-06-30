import { Test, TestingModule } from '@nestjs/testing';
import { getDataSourceToken } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { databaseConfig } from '../config/database.config';
import { envValidationSchema } from '../config/env.validation';
import { DatabaseModule } from './database.module';

describe('DatabaseModule (integration)', () => {
  let module: TestingModule;
  let dataSource: DataSource;

  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          load: [databaseConfig],
          validationSchema: envValidationSchema,
          validationOptions: { allowUnknown: true, abortEarly: true },
        }),
        DatabaseModule,
      ],
    }).compile();

    dataSource = module.get<DataSource>(getDataSourceToken());
  });

  afterAll(async () => {
    await module.close();
  });

  it('should connect to the Postgres database', async () => {
    expect(dataSource.isInitialized).toBe(true);
  });

  it('should have synchronize disabled (no auto schema creation)', () => {
    const options = dataSource.options as { synchronize?: boolean };
    expect(options.synchronize).toBe(false);
  });

  it('should be able to run a raw query against the database', async () => {
    const result: Array<{ now: Date }> = await dataSource.query('SELECT NOW()');
    expect(result).toHaveLength(1);
    expect(result[0].now).toBeDefined();
  });
});
