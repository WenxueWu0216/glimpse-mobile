import { setLike, setSave } from '../api/notes';
import { createDefaultStore } from './defaultStore';
import { SyncQueue } from './syncQueue';
import type { OfflineStore } from './types';

let store: OfflineStore | null = null;
let queue: SyncQueue | null = null;

/** App-wide singletons, created lazily so tests can swap the store first. */
export function getOfflineStore(): OfflineStore {
  store ??= createDefaultStore();
  return store;
}

export function getSyncQueue(): SyncQueue {
  queue ??= new SyncQueue(getOfflineStore(), { setLike, setSave });
  return queue;
}

export function resetOfflineRuntime(next?: OfflineStore): void {
  store = next ?? null;
  queue = null;
}
