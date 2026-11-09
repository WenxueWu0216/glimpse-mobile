import type { InfiniteData, QueryClient } from '@tanstack/react-query';

import type { Note, NotePage } from './types';

export const FEED_KEY = ['feed'] as const;
export const SAVED_KEY = ['saved'] as const;
export const noteKey = (id: number) => ['note', id] as const;

export type FeedData = InfiniteData<NotePage, string | null>;

/**
 * The same note can sit in three caches (feed pages, saved list, detail).
 * Every write goes through here so they can never disagree.
 *
 * Untouched notes and pages keep their object identity, which is what lets
 * memo()'d cards skip re-rendering when a different note changes.
 */
export function patchNote(client: QueryClient, id: number, patch: Partial<Note>): void {
  const apply = (note: Note): Note => (note.id === id ? { ...note, ...patch } : note);

  client.setQueryData<FeedData>(FEED_KEY, (data) => {
    if (!data) return data;
    let changed = false;
    const pages = data.pages.map((page) => {
      if (!page.items.some((n) => n.id === id)) return page;
      changed = true;
      return { ...page, items: page.items.map(apply) };
    });
    return changed ? { ...data, pages } : data;
  });

  client.setQueryData<Note>(noteKey(id), (note) => (note ? apply(note) : note));

  client.setQueryData<Note[]>(SAVED_KEY, (saved) => {
    if (!saved) return saved;
    const patched = saved.map(apply).filter((n) => n.saved);
    if (patch.saved && !patched.some((n) => n.id === id)) {
      const note = findCachedNote(client, id);
      if (note) return [note, ...patched];
    }
    return patched;
  });
}

export function findCachedNote(client: QueryClient, id: number): Note | undefined {
  const detail = client.getQueryData<Note>(noteKey(id));
  if (detail) return detail;
  for (const page of client.getQueryData<FeedData>(FEED_KEY)?.pages ?? []) {
    const hit = page.items.find((n) => n.id === id);
    if (hit) return hit;
  }
  return client.getQueryData<Note[]>(SAVED_KEY)?.find((n) => n.id === id);
}

/** Show a freshly created note at the top of the feed without refetching. */
export function prependToFeed(client: QueryClient, note: Note): void {
  client.setQueryData(noteKey(note.id), note);
  client.setQueryData<FeedData>(FEED_KEY, (data) => {
    const [first, ...rest] = data?.pages ?? [];
    if (!data || !first) return data;
    return { ...data, pages: [{ ...first, items: [note, ...first.items] }, ...rest] };
  });
}
