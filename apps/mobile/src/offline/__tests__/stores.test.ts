import { makeNote } from '../../test/factories';
import { MemoryStore } from '../memoryStore';
import { SqliteStore } from '../sqliteStore';
import type { OfflineStore } from '../types';

jest.mock('expo-sqlite', () => jest.requireActual('../../test/nodeSqlite'));

// Both implementations must behave identically, so they share one test suite.
describe.each<[string, () => OfflineStore]>([
  ['MemoryStore', () => new MemoryStore()],
  ['SqliteStore', () => new SqliteStore()],
])('%s', (_name, create) => {
  let store: OfflineStore;
  beforeEach(() => {
    store = create();
  });

  it('round-trips cached notes in order, per list', async () => {
    const feed = [
      makeNote({ id: 3, title: '周末 citywalk' }),
      makeNote({ id: 2 }),
      makeNote({ id: 1 }),
    ];
    await store.setNotes('feed', feed);
    await store.setNotes('saved', [makeNote({ id: 9, saved: true })]);

    expect(await store.getNotes('feed')).toEqual(feed);
    expect((await store.getNotes('saved')).map((n) => n.id)).toEqual([9]);
  });

  it('replaces the previous list instead of appending', async () => {
    await store.setNotes('feed', [makeNote({ id: 1 }), makeNote({ id: 2 })]);
    await store.setNotes('feed', [makeNote({ id: 5 })]);

    expect((await store.getNotes('feed')).map((n) => n.id)).toEqual([5]);
  });

  it('returns an empty list when nothing is cached', async () => {
    expect(await store.getNotes('feed')).toEqual([]);
  });

  it('keeps queued actions in insertion order and removes by id', async () => {
    await store.addToQueue({ noteId: 1, kind: 'like', value: true });
    await store.addToQueue({ noteId: 2, kind: 'save', value: false });
    const queue = await store.listQueue();

    expect(queue).toMatchObject([
      { noteId: 1, kind: 'like', value: true },
      { noteId: 2, kind: 'save', value: false },
    ]);

    await store.removeFromQueue(queue[0]!.id);
    expect(await store.listQueue()).toMatchObject([{ noteId: 2, kind: 'save', value: false }]);
  });

  it('caches translations per note and language', async () => {
    await store.setTranslation(1, 'zh', { title: '你好', body: '世界' });
    await store.setTranslation(1, 'en', { title: 'Hello', body: 'World' });

    expect(await store.getTranslation(1, 'zh')).toEqual({ title: '你好', body: '世界' });
    expect(await store.getTranslation(1, 'en')).toEqual({ title: 'Hello', body: 'World' });
    expect(await store.getTranslation(2, 'zh')).toBeNull();
  });

  it('stores and overwrites settings', async () => {
    expect(await store.getSetting('theme')).toBeNull();
    await store.setSetting('theme', 'dark');
    await store.setSetting('theme', 'light');
    expect(await store.getSetting('theme')).toBe('light');
  });
});
