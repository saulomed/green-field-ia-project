import { DataSource } from 'typeorm';

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
