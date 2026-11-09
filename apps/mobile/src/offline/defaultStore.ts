import { SqliteStore } from './sqliteStore';
import type { OfflineStore } from './types';

/** iOS / Android: persist to SQLite. Metro picks defaultStore.web.ts on web. */
export function createDefaultStore(): OfflineStore {
  return new SqliteStore();
}
