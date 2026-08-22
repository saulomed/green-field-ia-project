import { Test, TestingModule } from '@nestjs/testing';
import { getDataSourceToken } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { DataSource, QueryFailedError } from 'typeorm';
import { databaseConfig } from '../config/database.config';
import { DatabaseModule } from './database.module';
import { getTableColumns, hasFkOnUserId, insertUser } from './migration-test-helpers';

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
    const columns = await getTableColumns(db, 'users');
    expect(columns).toEqual(expect.arrayContaining(['id', 'email', 'password_hash', 'is_confirmed', 'created_at', 'updated_at']));
  });

  it('should have the channels table with expected columns', async () => {
    const columns = await getTableColumns(db, 'channels');
    expect(columns).toEqual(expect.arrayContaining(['id', 'user_id', 'nickname', 'name', 'description', 'created_at', 'updated_at']));
  });

  it('should enforce uniqueness on users.email', async () => {
    const userId1 = '00000000-0000-0000-0000-000000000001';
    const userId2 = '00000000-0000-0000-0000-000000000002';
    await insertUser(db, { id: userId1, email: 'dup@example.com' });
    await expect(
      insertUser(db, { id: userId2, email: 'dup@example.com' }),
    ).rejects.toThrow(QueryFailedError);
    await db.query(`DELETE FROM users WHERE id = $1`, [userId1]);
  });

  it('should enforce uniqueness on channels.nickname', async () => {
    const userId = '00000000-0000-0000-0000-000000000010';
    const userId2 = '00000000-0000-0000-0000-000000000011';
    const chanId1 = '00000000-0000-0000-0000-000000000020';
    const chanId2 = '00000000-0000-0000-0000-000000000021';
    await insertUser(db, { id: userId, email: 'nick1@example.com' });
    await insertUser(db, { id: userId2, email: 'nick2@example.com' });
    await db.query(`INSERT INTO channels (id, user_id, nickname, name) VALUES ($1, $2, $3, $4)`, [chanId1, userId, 'samename', 'Name 1']);
    await expect(
      db.query(`INSERT INTO channels (id, user_id, nickname, name) VALUES ($1, $2, $3, $4)`, [chanId2, userId2, 'samename', 'Name 2']),
    ).rejects.toThrow(QueryFailedError);
    await db.query(`DELETE FROM users WHERE id IN ($1, $2)`, [userId, userId2]);
  });

  it('should cascade-delete channel when user is removed', async () => {
    const userId = '00000000-0000-0000-0000-000000000030';
    const chanId = '00000000-0000-0000-0000-000000000040';
    await insertUser(db, { id: userId, email: 'cascade@example.com' });
    await db.query(`INSERT INTO channels (id, user_id, nickname, name) VALUES ($1, $2, $3, $4)`, [chanId, userId, 'cascade_nick', 'Cascade Channel']);

    await db.query(`DELETE FROM users WHERE id = $1`, [userId]);

    const remaining: Array<unknown> = await db.query(`SELECT id FROM channels WHERE id = $1`, [chanId]);
    expect(remaining).toHaveLength(0);
  });

  it('should have FK constraint from channels.user_id to users.id', async () => {
    expect(await hasFkOnUserId(db, 'channels')).toBe(true);
  });
});
