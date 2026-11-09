/**
 * Test double for expo-sqlite backed by Node's built-in SQLite, so the real
 * SQL in SqliteStore runs in Jest instead of being mocked away.
 */
import { DatabaseSync } from 'node:sqlite';

type Param = string | number | null;

export async function openDatabaseAsync() {
  const db = new DatabaseSync(':memory:');
  return {
    execAsync: async (sql: string) => db.exec(sql),
    runAsync: async (sql: string, params: Param[] = []) => db.prepare(sql).run(...params),
    getAllAsync: async (sql: string, params: Param[] = []) => db.prepare(sql).all(...params),
    getFirstAsync: async (sql: string, params: Param[] = []) =>
      db.prepare(sql).get(...params) ?? null,
    withTransactionAsync: async (task: () => Promise<void>) => {
      db.exec('BEGIN');
      try {
        await task();
        db.exec('COMMIT');
      } catch (error) {
        db.exec('ROLLBACK');
        throw error;
      }
    },
  };
}
