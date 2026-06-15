import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule, getDataSourceToken } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { envValidationSchema } from '../config/env.validation';

describe('DatabaseModule (integration)', () => {
  let module: TestingModule;
  let dataSource: DataSource;

  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          validationSchema: envValidationSchema,
          validationOptions: { allowUnknown: true, abortEarly: true },
        }),
        TypeOrmModule.forRootAsync({
          imports: [ConfigModule],
          inject: [ConfigService],
          useFactory: (config: ConfigService) => ({
            type: 'postgres',
            host: config.get<string>('DB_HOST'),
            port: config.get<number>('DB_PORT'),
            username: config.get<string>('DB_USER'),
            password: config.get<string>('DB_PASSWORD'),
            database: config.get<string>('DB_NAME'),
            synchronize: false,
            entities: [],
          }),
        }),
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
