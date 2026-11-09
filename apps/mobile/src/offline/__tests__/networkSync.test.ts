import NetInfo from '@react-native-community/netinfo';
import { onlineManager, QueryClient } from '@tanstack/react-query';

import { ApiError } from '../../api/client';
import { FEED_KEY, type FeedData } from '../../api/noteCache';
import '../../i18n';
import { useNetworkStore } from '../../state/networkStore';
import { useToastStore } from '../../state/toastStore';
import { makeNote } from '../../test/factories';
import { MemoryStore } from '../memoryStore';
import { startNetworkSync } from '../networkSync';
import { SyncQueue, type SyncApi } from '../syncQueue';

type NetListener = (state: {
  isConnected: boolean | null;
  isInternetReachable: boolean | null;
}) => void;

function setup() {
  const api: jest.Mocked<SyncApi> = {
    setLike: jest.fn(async (_id, liked) => ({ liked, like_count: 42 })),
    setSave: jest.fn(async (_id, saved) => ({ saved, save_count: 7 })),
  };
  const queue = new SyncQueue(new MemoryStore(), api);
  const client = new QueryClient();
  client.setQueryData<FeedData>(FEED_KEY, {
    // The note as the user sees it after liking it offline.
    pages: [{ items: [makeNote({ id: 1, liked: true, like_count: 11 })], next_cursor: null }],
    pageParams: [null],
  });
  let emit: NetListener = () => {};
  jest.mocked(NetInfo.addEventListener).mockImplementation((listener) => {
    emit = listener as unknown as NetListener;
    return jest.fn();
  });
  const stop = startNetworkSync(client, queue);
  const note = () => client.getQueryData<FeedData>(FEED_KEY)?.pages[0]?.items[0];
  return {
    api,
    queue,
    client,
    emit: (online: boolean) => emit({ isConnected: online, isInternetReachable: online }),
    note,
    stop,
  };
}

const settle = () => new Promise((resolve) => setTimeout(resolve, 10));

describe('startNetworkSync', () => {
  beforeEach(() => {
    useNetworkStore.setState({ isOnline: true, pendingActions: 0 });
    useToastStore.setState({ message: null });
    onlineManager.setOnline(true);
  });

  it('marks the app offline and exposes the number of queued changes', async () => {
    const { queue, emit } = setup();

    emit(false);
    await queue.enqueue({ noteId: 1, kind: 'like', value: true });

    expect(useNetworkStore.getState()).toMatchObject({ isOnline: false, pendingActions: 1 });
    expect(onlineManager.isOnline()).toBe(false);
  });

  it('flushes the queue on reconnect and applies the server counts', async () => {
    const { queue, api, emit, note } = setup();
    emit(false);
    await queue.enqueue({ noteId: 1, kind: 'like', value: true });

    emit(true);
    await settle();

    expect(api.setLike).toHaveBeenCalledWith(1, true);
    expect(note()).toMatchObject({ liked: true, like_count: 42 });
    expect(useNetworkStore.getState()).toMatchObject({ isOnline: true, pendingActions: 0 });
    expect(onlineManager.isOnline()).toBe(true);
  });

  it('rolls back and notifies when the server rejects a queued change', async () => {
    const { queue, api, emit, note } = setup();
    api.setLike.mockRejectedValueOnce(new ApiError(404, 'Note not found'));
    emit(false);
    await queue.enqueue({ noteId: 1, kind: 'like', value: true });

    emit(true);
    await settle();

    expect(note()).toMatchObject({ liked: false, like_count: 10 });
    expect(useToastStore.getState().message).toBe("A change made offline couldn't be synced.");
  });

  it('treats "connected but no internet" as offline', () => {
    const { stop } = setup();
    const listener = jest
      .mocked(NetInfo.addEventListener)
      .mock.calls.at(-1)?.[0] as unknown as NetListener;

    listener({ isConnected: true, isInternetReachable: false });
    expect(useNetworkStore.getState().isOnline).toBe(false);

    // Reachability still being probed (null) must not flash the banner.
    listener({ isConnected: true, isInternetReachable: null });
    expect(useNetworkStore.getState().isOnline).toBe(true);
    stop();
  });
});
