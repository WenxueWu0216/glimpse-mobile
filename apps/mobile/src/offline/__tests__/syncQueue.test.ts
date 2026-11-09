import { ApiError, NetworkError } from '../../api/client';
import { MemoryStore } from '../memoryStore';
import { SqliteStore } from '../sqliteStore';
import { SyncQueue, type SyncApi, type SyncListener } from '../syncQueue';
import type { OfflineStore } from '../types';

jest.mock('expo-sqlite', () => jest.requireActual('../../test/nodeSqlite'));

function setup(store: OfflineStore) {
  const api: jest.Mocked<SyncApi> = {
    setLike: jest.fn(async (_id, liked) => ({ liked, like_count: 100 })),
    setSave: jest.fn(async (_id, saved) => ({ saved, save_count: 50 })),
  };
  const listener: jest.Mocked<Required<SyncListener>> = {
    onSynced: jest.fn(),
    onDropped: jest.fn(),
    onPendingChange: jest.fn(),
  };
  const queue = new SyncQueue(store, api);
  queue.setListener(listener);
  return { queue, api, listener, store };
}

describe.each<[string, () => OfflineStore]>([
  ['MemoryStore', () => new MemoryStore()],
  ['SqliteStore', () => new SqliteStore()],
])('SyncQueue on %s', (_name, createStore) => {
  describe('enqueue', () => {
    it('stores an action and reports the pending count', async () => {
      const { queue, listener } = setup(createStore());

      await queue.enqueue({ noteId: 1, kind: 'like', value: true });

      expect(await queue.pendingCount()).toBe(1);
      expect(await queue.has(1, 'like')).toBe(true);
      expect(await queue.has(1, 'save')).toBe(false);
      expect(listener.onPendingChange).toHaveBeenLastCalledWith(1);
    });

    it('cancels out a like followed by an unlike of the same note', async () => {
      const { queue, api, listener } = setup(createStore());

      await queue.enqueue({ noteId: 1, kind: 'like', value: true });
      await queue.enqueue({ noteId: 1, kind: 'like', value: false });

      expect(await queue.pendingCount()).toBe(0);
      expect(listener.onPendingChange).toHaveBeenLastCalledWith(0);
      await queue.flush();
      expect(api.setLike).not.toHaveBeenCalled();
    });

    it('does not duplicate the same end state', async () => {
      const { queue } = setup(createStore());

      await queue.enqueue({ noteId: 1, kind: 'like', value: true });
      await queue.enqueue({ noteId: 1, kind: 'like', value: true });

      expect(await queue.pendingCount()).toBe(1);
    });

    it('keeps like and save of one note, and different notes, separate', async () => {
      const { queue } = setup(createStore());

      await queue.enqueue({ noteId: 1, kind: 'like', value: true });
      await queue.enqueue({ noteId: 1, kind: 'save', value: true });
      await queue.enqueue({ noteId: 2, kind: 'like', value: true });

      expect(await queue.pendingCount()).toBe(3);
    });

    it('coalesces correctly when taps arrive at the same time', async () => {
      const { queue, store } = setup(createStore());

      await Promise.all([
        queue.enqueue({ noteId: 1, kind: 'like', value: true }),
        queue.enqueue({ noteId: 1, kind: 'like', value: false }),
        queue.enqueue({ noteId: 1, kind: 'like', value: true }),
      ]);

      expect(await store.listQueue()).toMatchObject([{ noteId: 1, kind: 'like', value: true }]);
    });
  });

  describe('flush', () => {
    it('replays actions oldest-first and empties the queue', async () => {
      const { queue, api, listener } = setup(createStore());
      const order: string[] = [];
      api.setLike.mockImplementation(async (id, liked) => {
        order.push(`like:${id}`);
        return { liked, like_count: 7 };
      });
      api.setSave.mockImplementation(async (id, saved) => {
        order.push(`save:${id}`);
        return { saved, save_count: 3 };
      });
      await queue.enqueue({ noteId: 1, kind: 'like', value: true });
      await queue.enqueue({ noteId: 2, kind: 'save', value: true });
      await queue.enqueue({ noteId: 3, kind: 'like', value: false });

      const result = await queue.flush();

      expect(order).toEqual(['like:1', 'save:2', 'like:3']);
      expect(api.setLike).toHaveBeenCalledWith(3, false);
      expect(result).toEqual({ synced: 3, dropped: 0, remaining: 0 });
      expect(listener.onSynced).toHaveBeenCalledWith(
        expect.objectContaining({ noteId: 1, kind: 'like' }),
        { liked: true, like_count: 7 },
      );
      expect(listener.onPendingChange).toHaveBeenLastCalledWith(0);
    });

    it('stops at the first network failure and keeps everything for later', async () => {
      const { queue, api, listener } = setup(createStore());
      api.setLike.mockRejectedValueOnce(new NetworkError());
      await queue.enqueue({ noteId: 1, kind: 'like', value: true });
      await queue.enqueue({ noteId: 2, kind: 'like', value: true });

      const offline = await queue.flush();

      expect(offline).toEqual({ synced: 0, dropped: 0, remaining: 2 });
      expect(api.setLike).toHaveBeenCalledTimes(1);
      expect(listener.onSynced).not.toHaveBeenCalled();

      // Back online: the same entries go through, still in order.
      const online = await queue.flush();
      expect(online).toEqual({ synced: 2, dropped: 0, remaining: 0 });
      expect(api.setLike.mock.calls.map(([id]) => id)).toEqual([1, 1, 2]);
    });

    it('keeps an action when the server has a temporary 5xx problem', async () => {
      const { queue, api } = setup(createStore());
      api.setLike.mockRejectedValueOnce(new ApiError(503, 'Unavailable'));
      await queue.enqueue({ noteId: 1, kind: 'like', value: true });

      expect(await queue.flush()).toEqual({ synced: 0, dropped: 0, remaining: 1 });
    });

    it('drops an action the server rejects for good and continues with the rest', async () => {
      const { queue, api, listener } = setup(createStore());
      api.setLike.mockRejectedValueOnce(new ApiError(404, 'Note not found'));
      await queue.enqueue({ noteId: 1, kind: 'like', value: true });
      await queue.enqueue({ noteId: 2, kind: 'save', value: true });

      const result = await queue.flush();

      expect(result).toEqual({ synced: 1, dropped: 1, remaining: 0 });
      expect(listener.onDropped).toHaveBeenCalledWith(expect.objectContaining({ noteId: 1 }));
      expect(listener.onSynced).toHaveBeenCalledWith(
        expect.objectContaining({ noteId: 2, kind: 'save' }),
        { saved: true, save_count: 50 },
      );
    });

    it('shares one run between concurrent flush calls', async () => {
      const { queue, api } = setup(createStore());
      await queue.enqueue({ noteId: 1, kind: 'like', value: true });

      const [a, b] = await Promise.all([queue.flush(), queue.flush()]);

      expect(api.setLike).toHaveBeenCalledTimes(1);
      expect(a).toBe(b);
    });

    it('sends an action that was queued while a flush was running', async () => {
      const { queue, api } = setup(createStore());
      let release!: () => void;
      api.setLike.mockImplementationOnce(
        (_id, liked) =>
          new Promise((resolve) => {
            release = () => resolve({ liked, like_count: 1 });
          }),
      );
      await queue.enqueue({ noteId: 1, kind: 'like', value: true });
      const flushing = queue.flush();
      await waitUntil(() => api.setLike.mock.calls.length === 1);

      await queue.enqueue({ noteId: 2, kind: 'save', value: true });
      release();

      expect(await flushing).toEqual({ synced: 2, dropped: 0, remaining: 0 });
      expect(api.setSave).toHaveBeenCalledWith(2, true);
    });

    it('sends the opposite afterwards when undone while the request is in flight', async () => {
      const { queue, api } = setup(createStore());
      let release!: () => void;
      api.setLike.mockImplementationOnce(
        (_id, liked) =>
          new Promise((resolve) => {
            release = () => resolve({ liked, like_count: 1 });
          }),
      );
      await queue.enqueue({ noteId: 1, kind: 'like', value: true });
      const flushing = queue.flush();
      await waitUntil(() => api.setLike.mock.calls.length === 1);

      // Too late to cancel the like: the unlike must follow it.
      await queue.enqueue({ noteId: 1, kind: 'like', value: false });
      release();

      expect(await flushing).toEqual({ synced: 2, dropped: 0, remaining: 0 });
      expect(api.setLike.mock.calls).toEqual([
        [1, true],
        [1, false],
      ]);
    });

    it('survives an app restart: a new queue on the same store sends what was left', async () => {
      const store = createStore();
      const first = setup(store);
      await first.queue.enqueue({ noteId: 5, kind: 'save', value: true });

      const second = setup(store);
      expect(await second.queue.pendingCount()).toBe(1);
      await second.queue.flush();

      expect(second.api.setSave).toHaveBeenCalledWith(5, true);
      expect(await second.queue.pendingCount()).toBe(0);
    });
  });
});

async function waitUntil(condition: () => boolean) {
  for (let i = 0; i < 200 && !condition(); i++) {
    await new Promise((resolve) => setTimeout(resolve, 1));
  }
  expect(condition()).toBe(true);
}
