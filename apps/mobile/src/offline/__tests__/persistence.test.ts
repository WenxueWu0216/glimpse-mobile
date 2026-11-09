import { QueryClient } from '@tanstack/react-query';

import { FEED_KEY, patchNote, SAVED_KEY, type FeedData } from '../../api/noteCache';
import type { Note } from '../../api/types';
import { makeNote, makePage } from '../../test/factories';
import { MemoryStore } from '../memoryStore';
import { hydrateQueryCache, MAX_CACHED_FEED, persistQueryCache } from '../persistence';

describe('hydrateQueryCache', () => {
  it('fills the feed and saved queries from the store, marked stale', async () => {
    const store = new MemoryStore();
    await store.setNotes('feed', makePage(9, 3, null).items);
    await store.setNotes('saved', [makeNote({ id: 4, saved: true })]);
    const client = new QueryClient();

    await hydrateQueryCache(client, store);

    const feed = client.getQueryData<FeedData>(FEED_KEY);
    expect(feed?.pages[0]?.items.map((n) => n.id)).toEqual([9, 8, 7]);
    // Infinite scroll resumes after the last cached note once online.
    expect(feed?.pages[0]?.next_cursor).toBe('7');
    expect(client.getQueryData<Note[]>(SAVED_KEY)?.[0]?.id).toBe(4);
    expect(client.getQueryState(FEED_KEY)?.dataUpdatedAt).toBe(0);
  });

  it('leaves the cache empty when nothing was stored', async () => {
    const client = new QueryClient();
    await hydrateQueryCache(client, new MemoryStore());
    expect(client.getQueryData(FEED_KEY)).toBeUndefined();
    expect(client.getQueryData(SAVED_KEY)).toBeUndefined();
  });
});

describe('persistQueryCache', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('writes the feed after it changes, including optimistic edits', async () => {
    const store = new MemoryStore();
    const client = new QueryClient();
    const stop = persistQueryCache(client, store);

    client.setQueryData<FeedData>(FEED_KEY, { pages: [makePage(3, 3, null)], pageParams: [null] });
    patchNote(client, 2, { liked: true, like_count: 11 });
    // Debounced: nothing is written until the burst of updates settles.
    expect(await store.getNotes('feed')).toEqual([]);
    await jest.runAllTimersAsync();

    const cached = await store.getNotes('feed');
    expect(cached.map((n) => n.id)).toEqual([3, 2, 1]);
    expect(cached[1]).toMatchObject({ liked: true, like_count: 11 });
    stop();
  });

  it('caps the cached feed size', async () => {
    const store = new MemoryStore();
    const client = new QueryClient();
    const stop = persistQueryCache(client, store);

    client.setQueryData<FeedData>(FEED_KEY, {
      pages: [makePage(200, 50, '151'), makePage(150, 50, '101')],
      pageParams: [null, '151'],
    });
    await jest.runAllTimersAsync();

    expect(await store.getNotes('feed')).toHaveLength(MAX_CACHED_FEED);
    stop();
  });

  it('writes the saved list and stops after unsubscribing', async () => {
    const store = new MemoryStore();
    const client = new QueryClient();
    const stop = persistQueryCache(client, store);

    client.setQueryData<Note[]>(SAVED_KEY, [makeNote({ id: 8, saved: true })]);
    await jest.runAllTimersAsync();
    expect((await store.getNotes('saved')).map((n) => n.id)).toEqual([8]);

    stop();
    client.setQueryData<Note[]>(SAVED_KEY, []);
    await jest.runAllTimersAsync();
    expect(await store.getNotes('saved')).toHaveLength(1);
  });
});
