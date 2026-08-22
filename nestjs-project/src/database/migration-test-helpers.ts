import { DataSource, EntityManager } from 'typeorm';

/**
 * Inserts a bare `users` row for tests that need a FK target rather than a
 * realistic account. Owns the column list so a new NOT NULL column on `users`
 * is absorbed here instead of in every spec that hand-writes the INSERT —
 * `name` already had to be retrofitted into six of them.
 *
 * @param db - DataSource or EntityManager to run the insert on
 * @param user - Row values; `name` defaults to the e-mail, `passwordHash` to a stub
 *
 * @author Saulo Santos
 * @date 22/08/2026
 */
export async function insertUser(
  db: DataSource | EntityManager,
  user: { id: string; email: string; name?: string; passwordHash?: string },
): Promise<void> {
  await db.query(
    `INSERT INTO users (id, email, name, password_hash) VALUES ($1, $2, $3, $4)`,
    [user.id, user.email, user.name ?? user.email, user.passwordHash ?? 'hash'],
  );
}

/**
 * Returns the column names of the given table from information_schema.
 *
 * @author Saulo Santos
 * @date 11/07/2026
 */
export async function getTableColumns(db: DataSource, table: string): Promise<string[]> {
  const rows: Array<{ column_name: string }> = await db.query(
    `SELECT column_name FROM information_schema.columns WHERE table_name = $1 AND table_schema = 'public'`,
    [table],
  );
  return rows.map((r) => r.column_name);
}

/**
 * Returns true if the given table has a FOREIGN KEY constraint on the `user_id` column.
 *
 * @author Saulo Santos
 * @date 11/07/2026
 */
export async function hasFkOnUserId(db: DataSource, table: string): Promise<boolean> {
  const rows: Array<{ constraint_name: string }> = await db.query(
    `SELECT tc.constraint_name
     FROM information_schema.table_constraints tc
     JOIN information_schema.key_column_usage kcu
       ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
     WHERE tc.constraint_type = 'FOREIGN KEY'
       AND tc.table_name = $1
       AND kcu.column_name = 'user_id'
       AND tc.table_schema = 'public'`,
    [table],
  );
  return rows.length > 0;
}
