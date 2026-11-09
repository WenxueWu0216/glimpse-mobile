import type { QueryClient } from '@tanstack/react-query';

import { FEED_KEY, SAVED_KEY, type FeedData } from '../api/noteCache';
import type { Note } from '../api/types';
import type { CachedList, OfflineStore } from './types';

/** About three screens of feed are kept for offline use. */
export const MAX_CACHED_FEED = 60;
const WRITE_DELAY_MS = 400;

/**
 * Fill React Query from SQLite at startup so the first frame already has
 * content. `updatedAt: 0` marks the data as stale: it is shown immediately and
 * refreshed in the background as soon as there is a connection.
 */
export async function hydrateQueryCache(client: QueryClient, store: OfflineStore): Promise<void> {
  const [feed, saved] = await Promise.all([store.getNotes('feed'), store.getNotes('saved')]);
  const last = feed[feed.length - 1];
  if (last && !client.getQueryData(FEED_KEY)) {
    client.setQueryData<FeedData>(
      FEED_KEY,
      // The cursor of the last cached note lets infinite scroll continue
      // from where the cache ends once the device is back online.
      { pages: [{ items: feed, next_cursor: String(last.id) }], pageParams: [null] },
      { updatedAt: 0 },
    );
  }
  if (saved.length > 0 && !client.getQueryData(SAVED_KEY)) {
    client.setQueryData<Note[]>(SAVED_KEY, saved, { updatedAt: 0 });
  }
}

function snapshot(client: QueryClient, list: CachedList): Note[] | undefined {
  if (list === 'saved') return client.getQueryData<Note[]>(SAVED_KEY);
  const data = client.getQueryData<FeedData>(FEED_KEY);
  return data?.pages.flatMap((page) => page.items).slice(0, MAX_CACHED_FEED);
}

/**
 * Mirror the feed and saved queries into the store whenever they change,
 * including optimistic likes, so offline edits survive an app restart.
 * Writes are debounced: scrolling loads pages in bursts.
 */
export function persistQueryCache(client: QueryClient, store: OfflineStore): () => void {
  const timers = new Map<CachedList, ReturnType<typeof setTimeout>>();

  const unsubscribe = client.getQueryCache().subscribe((event) => {
    if (event.type !== 'updated' || event.action.type !== 'success') return;
    const root = event.query.queryKey[0];
    const list: CachedList | null =
      root === FEED_KEY[0] ? 'feed' : root === SAVED_KEY[0] ? 'saved' : null;
    if (!list) return;
    clearTimeout(timers.get(list));
    timers.set(
      list,
      setTimeout(() => {
        const notes = snapshot(client, list);
        if (notes) void store.setNotes(list, notes).catch(() => undefined);
      }, WRITE_DELAY_MS),
    );
  });

  return () => {
    unsubscribe();
    timers.forEach((timer) => clearTimeout(timer));
  };
}
