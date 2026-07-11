import { Test, TestingModule } from '@nestjs/testing';
import { getDataSourceToken } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { DataSource, QueryFailedError } from 'typeorm';
import { databaseConfig } from '../config/database.config';
import { DatabaseModule } from './database.module';

describe('auth-tokens migration (integration)', () => {
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

  beforeAll(async () => {
    const testUserIds = [
      '10000000-0000-0000-0000-000000000001',
      '10000000-0000-0000-0000-000000000002',
      '10000000-0000-0000-0000-000000000003',
    ];
    await db.query(`DELETE FROM users WHERE id = ANY($1::uuid[])`, [testUserIds]);
  });

  afterAll(async () => {
    await module.close();
  });

  async function getTableColumns(table: string): Promise<string[]> {
    const rows: Array<{ column_name: string }> = await db.query(
      `SELECT column_name FROM information_schema.columns WHERE table_name = $1 AND table_schema = 'public'`,
      [table],
    );
    return rows.map((r) => r.column_name);
  }

  async function createUser(id: string, email: string): Promise<void> {
    await db.query(
      `INSERT INTO users (id, email, password_hash) VALUES ($1, $2, $3)`,
      [id, email, 'hash'],
    );
  }

  it('should have the refresh_tokens table with expected columns', async () => {
    const columns = await getTableColumns('refresh_tokens');
    expect(columns).toEqual(
      expect.arrayContaining(['id', 'user_id', 'jti', 'family_id', 'expires_at', 'revoked_at', 'replaced_by_id', 'created_at']),
    );
  });

  it('should have the password_reset_tokens table with expected columns', async () => {
    const columns = await getTableColumns('password_reset_tokens');
    expect(columns).toEqual(
      expect.arrayContaining(['id', 'user_id', 'token_hash', 'expires_at', 'used_at', 'created_at']),
    );
  });

  it('should enforce uniqueness on refresh_tokens.jti', async () => {
    const userId = '10000000-0000-0000-0000-000000000001';
    await createUser(userId, 'jti-unique@example.com');

    const jti = 'aaaaaaaa-0000-0000-0000-000000000001';
    const familyId = 'bbbbbbbb-0000-0000-0000-000000000001';
    const expiresAt = new Date(Date.now() + 86400000).toISOString();

    await db.query(
      `INSERT INTO refresh_tokens (id, user_id, jti, family_id, expires_at) VALUES (uuid_generate_v4(), $1, $2, $3, $4)`,
      [userId, jti, familyId, expiresAt],
    );
    await expect(
      db.query(
        `INSERT INTO refresh_tokens (id, user_id, jti, family_id, expires_at) VALUES (uuid_generate_v4(), $1, $2, $3, $4)`,
        [userId, jti, familyId, expiresAt],
      ),
    ).rejects.toThrow(QueryFailedError);

    await db.query(`DELETE FROM users WHERE id = $1`, [userId]);
  });

  it('should cascade-delete refresh_tokens when user is removed', async () => {
    const userId = '10000000-0000-0000-0000-000000000002';
    await createUser(userId, 'rt-cascade@example.com');

    const jti = 'aaaaaaaa-0000-0000-0000-000000000002';
    const familyId = 'bbbbbbbb-0000-0000-0000-000000000002';
    const expiresAt = new Date(Date.now() + 86400000).toISOString();

    await db.query(
      `INSERT INTO refresh_tokens (id, user_id, jti, family_id, expires_at) VALUES (uuid_generate_v4(), $1, $2, $3, $4)`,
      [userId, jti, familyId, expiresAt],
    );

    await db.query(`DELETE FROM users WHERE id = $1`, [userId]);

    const remaining: Array<unknown> = await db.query(
      `SELECT id FROM refresh_tokens WHERE user_id = $1`,
      [userId],
    );
    expect(remaining).toHaveLength(0);
  });

  it('should cascade-delete password_reset_tokens when user is removed', async () => {
    const userId = '10000000-0000-0000-0000-000000000003';
    await createUser(userId, 'prt-cascade@example.com');

    const expiresAt = new Date(Date.now() + 3600000).toISOString();

    await db.query(
      `INSERT INTO password_reset_tokens (id, user_id, token_hash, expires_at) VALUES (uuid_generate_v4(), $1, $2, $3)`,
      [userId, 'sha256hashvalue', expiresAt],
    );

    await db.query(`DELETE FROM users WHERE id = $1`, [userId]);

    const remaining: Array<unknown> = await db.query(
      `SELECT id FROM password_reset_tokens WHERE user_id = $1`,
      [userId],
    );
    expect(remaining).toHaveLength(0);
  });

  async function hasFkConstraint(table: string): Promise<boolean> {
    const rows: Array<{ constraint_name: string }> = await db.query(`
      SELECT tc.constraint_name
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu
        ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
      WHERE tc.constraint_type = 'FOREIGN KEY'
        AND tc.table_name = $1
        AND kcu.column_name = 'user_id'
        AND tc.table_schema = 'public'
    `, [table]);
    return rows.length > 0;
  }

  it('should have FK constraint from refresh_tokens.user_id to users.id', async () => {
    expect(await hasFkConstraint('refresh_tokens')).toBe(true);
  });

  it('should have FK constraint from password_reset_tokens.user_id to users.id', async () => {
    expect(await hasFkConstraint('password_reset_tokens')).toBe(true);
  });
});
