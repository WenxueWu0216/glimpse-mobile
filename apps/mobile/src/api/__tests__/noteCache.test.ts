import { QueryClient } from '@tanstack/react-query';

import { makeNote, makePage } from '../../test/factories';
import {
  FEED_KEY,
  findCachedNote,
  noteKey,
  patchNote,
  prependToFeed,
  SAVED_KEY,
  type FeedData,
} from '../noteCache';
import type { Note } from '../types';

function seededClient() {
  const client = new QueryClient();
  client.setQueryData<FeedData>(FEED_KEY, {
    pages: [makePage(6, 3, '4'), makePage(3, 3, null)],
    pageParams: [null, '4'],
  });
  return client;
}

describe('patchNote', () => {
  it('updates the note in every cache that holds it', () => {
    const client = seededClient();
    client.setQueryData(noteKey(5), makeNote({ id: 5 }));
    client.setQueryData(SAVED_KEY, [makeNote({ id: 5, saved: true })]);

    patchNote(client, 5, { liked: true, like_count: 11 });

    const inFeed = client.getQueryData<FeedData>(FEED_KEY)?.pages[0]?.items[1];
    expect(inFeed).toMatchObject({ id: 5, liked: true, like_count: 11 });
    expect(client.getQueryData<Note>(noteKey(5))).toMatchObject({ liked: true, like_count: 11 });
    expect(client.getQueryData<Note[]>(SAVED_KEY)?.[0]).toMatchObject({ liked: true });
  });

  it('keeps the identity of pages and notes that did not change', () => {
    const client = seededClient();
    const before = client.getQueryData<FeedData>(FEED_KEY);

    patchNote(client, 5, { liked: true });

    const after = client.getQueryData<FeedData>(FEED_KEY);
    expect(after?.pages[1]).toBe(before?.pages[1]);
    expect(after?.pages[0]?.items[0]).toBe(before?.pages[0]?.items[0]);
    expect(after?.pages[0]?.items[1]).not.toBe(before?.pages[0]?.items[1]);
  });

  it('adds a newly saved note to the saved list and removes it when unsaved', () => {
    const client = seededClient();
    client.setQueryData<Note[]>(SAVED_KEY, []);

    patchNote(client, 4, { saved: true });
    expect(client.getQueryData<Note[]>(SAVED_KEY)?.map((n) => n.id)).toEqual([4]);

    patchNote(client, 4, { saved: false });
    expect(client.getQueryData<Note[]>(SAVED_KEY)).toEqual([]);
  });
});

test('findCachedNote looks in detail, feed, then saved', () => {
  const client = seededClient();
  client.setQueryData(SAVED_KEY, [makeNote({ id: 99 })]);

  expect(findCachedNote(client, 2)?.id).toBe(2);
  expect(findCachedNote(client, 99)?.id).toBe(99);
  expect(findCachedNote(client, 1234)).toBeUndefined();
});

test('prependToFeed puts a new note first', () => {
  const client = seededClient();

  prependToFeed(client, makeNote({ id: 50 }));

  expect(client.getQueryData<FeedData>(FEED_KEY)?.pages[0]?.items.map((n) => n.id)).toEqual([
    50, 6, 5, 4,
  ]);
});
