import { MemoryStore } from './memoryStore';
import type { OfflineStore } from './types';

/** The web build is only a development preview, so it keeps data in memory. */
export function createDefaultStore(): OfflineStore {
  return new MemoryStore();
}
