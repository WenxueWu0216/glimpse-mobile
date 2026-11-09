import NetInfo, { type NetInfoState } from '@react-native-community/netinfo';
import { onlineManager, type QueryClient } from '@tanstack/react-query';

import { findCachedNote, patchNote } from '../api/noteCache';
import { Platform } from 'react-native';

import i18n from '../i18n';
import { useNetworkStore } from '../state/networkStore';
import { useToastStore } from '../state/toastStore';
import type { SyncQueue } from './syncQueue';

/**
 * Connects three things to the device's connectivity:
 *  - the zustand store that drives the offline banner,
 *  - React Query's onlineManager (pauses queries offline, refetches after),
 *  - the sync queue (flushed first, so refetched data already includes the
 *    likes and saves made offline).
 */
export function startNetworkSync(client: QueryClient, queue: SyncQueue): () => void {
  const network = useNetworkStore.getState();

  queue.setListener({
    onPendingChange: (pending) => useNetworkStore.getState().setPendingActions(pending),
    onSynced: (action, state) => patchNote(client, action.noteId, state),
    onDropped: (action) => {
      // Undo the optimistic change the user saw while offline.
      const note = findCachedNote(client, action.noteId);
      if (note) {
        const step = action.value ? -1 : 1;
        patchNote(
          client,
          action.noteId,
          action.kind === 'like'
            ? { liked: !action.value, like_count: Math.max(0, note.like_count + step) }
            : { saved: !action.value, save_count: Math.max(0, note.save_count + step) },
        );
      }
      useToastStore.getState().show(i18n.t('offline.syncFailed'));
    },
  });
  void queue.pendingCount().then(network.setPendingActions);

  const apply = (state: Pick<NetInfoState, 'isConnected' | 'isInternetReachable'>) => {
    // isInternetReachable is null while still being determined; only an
    // explicit false (e.g. captive portal) counts as offline.
    const online = state.isConnected !== false && state.isInternetReachable !== false;
    useNetworkStore.getState().setOnline(online);
    if (online) {
      void queue
        .flush()
        .catch(() => undefined)
        .finally(() => onlineManager.setOnline(true));
    } else {
      onlineManager.setOnline(false);
    }
  };
  const unsubscribe = NetInfo.addEventListener(apply);

  // Web preview only: browsers that expose navigator.connection do not emit
  // its "change" event when just navigator.onLine flips, which is the only
  // event NetInfo listens to there. Listen to online/offline directly too.
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    const onChange = () =>
      apply({ isConnected: window.navigator.onLine, isInternetReachable: null });
    window.addEventListener('online', onChange);
    window.addEventListener('offline', onChange);
    return () => {
      unsubscribe();
      window.removeEventListener('online', onChange);
      window.removeEventListener('offline', onChange);
    };
  }

  return unsubscribe;
}
