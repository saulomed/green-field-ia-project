import { Test, TestingModule } from '@nestjs/testing';
import { getDataSourceToken } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { DataSource, QueryFailedError } from 'typeorm';
import { databaseConfig } from '../config/database.config';
import { DatabaseModule } from './database.module';

describe('users/channels migration (integration)', () => {
  let module: TestingModule;
  let db: DataSource;

  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          load: [databaseConfig],
          validationOptions: { allowUnknown: true, abortEarly: true },
        }),
        DatabaseModule,
      ],
    }).compile();

    db = module.get<DataSource>(getDataSourceToken());
  });

  afterAll(async () => {
    await module.close();
  });

  it('should have the users table with expected columns', async () => {
    const rows: Array<{ column_name: string }> = await db.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'users' AND table_schema = 'public'
    `);
    const columns = rows.map((r) => r.column_name);
    expect(columns).toEqual(expect.arrayContaining(['id', 'email', 'password_hash', 'is_confirmed', 'created_at', 'updated_at']));
  });

  it('should have the channels table with expected columns', async () => {
    const rows: Array<{ column_name: string }> = await db.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'channels' AND table_schema = 'public'
    `);
    const columns = rows.map((r) => r.column_name);
    expect(columns).toEqual(expect.arrayContaining(['id', 'user_id', 'nickname', 'name', 'description', 'created_at', 'updated_at']));
  });

  it('should enforce uniqueness on users.email', async () => {
    const userId1 = '00000000-0000-0000-0000-000000000001';
    const userId2 = '00000000-0000-0000-0000-000000000002';
    await db.query(
      `INSERT INTO users (id, email, password_hash) VALUES ($1, $2, $3)`,
      [userId1, 'dup@example.com', 'hash'],
    );
    await expect(
      db.query(`INSERT INTO users (id, email, password_hash) VALUES ($1, $2, $3)`, [userId2, 'dup@example.com', 'hash']),
    ).rejects.toThrow(QueryFailedError);
    await db.query(`DELETE FROM users WHERE id = $1`, [userId1]);
  });

  it('should enforce uniqueness on channels.nickname', async () => {
    const userId = '00000000-0000-0000-0000-000000000010';
    const userId2 = '00000000-0000-0000-0000-000000000011';
    const chanId1 = '00000000-0000-0000-0000-000000000020';
    const chanId2 = '00000000-0000-0000-0000-000000000021';
    await db.query(`INSERT INTO users (id, email, password_hash) VALUES ($1, $2, $3), ($4, $5, $6)`, [
      userId, 'nick1@example.com', 'hash',
      userId2, 'nick2@example.com', 'hash',
    ]);
    await db.query(`INSERT INTO channels (id, user_id, nickname, name) VALUES ($1, $2, $3, $4)`, [chanId1, userId, 'samename', 'Name 1']);
    await expect(
      db.query(`INSERT INTO channels (id, user_id, nickname, name) VALUES ($1, $2, $3, $4)`, [chanId2, userId2, 'samename', 'Name 2']),
    ).rejects.toThrow(QueryFailedError);
    await db.query(`DELETE FROM users WHERE id IN ($1, $2)`, [userId, userId2]);
  });

  it('should cascade-delete channel when user is removed', async () => {
    const userId = '00000000-0000-0000-0000-000000000030';
    const chanId = '00000000-0000-0000-0000-000000000040';
    await db.query(`INSERT INTO users (id, email, password_hash) VALUES ($1, $2, $3)`, [userId, 'cascade@example.com', 'hash']);
    await db.query(`INSERT INTO channels (id, user_id, nickname, name) VALUES ($1, $2, $3, $4)`, [chanId, userId, 'cascade_nick', 'Cascade Channel']);

    await db.query(`DELETE FROM users WHERE id = $1`, [userId]);

    const remaining: Array<unknown> = await db.query(`SELECT id FROM channels WHERE id = $1`, [chanId]);
    expect(remaining).toHaveLength(0);
  });

  it('should have FK constraint from channels.user_id to users.id', async () => {
    const rows: Array<{ constraint_name: string }> = await db.query(`
      SELECT tc.constraint_name
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu
        ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
      WHERE tc.constraint_type = 'FOREIGN KEY'
        AND tc.table_name = 'channels'
        AND kcu.column_name = 'user_id'
        AND tc.table_schema = 'public'
    `);
    expect(rows.length).toBeGreaterThan(0);
  });
});
