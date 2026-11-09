import type { Note, NotePage } from '../api/types';

export function makeNote(overrides: Partial<Note> = {}): Note {
  const id = overrides.id ?? 1;
  return {
    id,
    title: `Note ${id}`,
    body: `Body of note ${id}`,
    lang: 'en',
    author: { id: 'u1', name: 'Mia Chen', avatar_url: null },
    images: [{ url: `https://img.test/${id}.jpg`, width: 600, height: 800, color: '#cccccc' }],
    tags: ['coffee', 'travel'],
    like_count: 10,
    save_count: 2,
    liked: false,
    saved: false,
    created_at: '2026-01-01T00:00:00+00:00',
    ...overrides,
  };
}

/** Pages of `size` notes with descending ids, like the real API returns. */
export function makePage(firstId: number, size: number, nextCursor: string | null): NotePage {
  return {
    items: Array.from({ length: size }, (_, i) => makeNote({ id: firstId - i })),
    next_cursor: nextCursor,
  };
}
