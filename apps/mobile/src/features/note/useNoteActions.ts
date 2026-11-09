import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';

import i18n from '../../i18n';
import { noteKey, patchNote } from '../../api/noteCache';
import { setLike, setSave } from '../../api/notes';
import type { Note } from '../../api/types';
import { ApiError } from '../../api/client';
import { getSyncQueue } from '../../offline/runtime';
import type { ActionKind } from '../../offline/types';
import { useNetworkStore } from '../../state/networkStore';
import { useToastStore } from '../../state/toastStore';

interface ToggleVars {
  note: Note;
  value: boolean;
}

/**
 * Sends the action now, or stores it in the offline queue when there is no
 * connection. Returns null when queued: the optimistic value stays on screen
 * and the queue reconciles with the server after reconnecting.
 */
async function sendOrQueue<T>(
  kind: ActionKind,
  noteId: number,
  value: boolean,
  send: (noteId: number, value: boolean) => Promise<T>,
): Promise<T | null> {
  const queue = getSyncQueue();
  const { isOnline } = useNetworkStore.getState();
  // If an older action for this note is still queued, go through the queue
  // too, otherwise the two could reach the server in the wrong order.
  if (!isOnline || (await queue.has(noteId, kind))) {
    await queue.enqueue({ noteId, kind, value });
    if (isOnline) void queue.flush();
    return null;
  }
  try {
    return await send(noteId, value);
  } catch (error) {
    // The server said no: surface it so onError rolls back.
    if (error instanceof ApiError) throw error;
    // The request never arrived (connection dropped before NetInfo noticed).
    await queue.enqueue({ noteId, kind, value });
    return null;
  }
}

/**
 * Optimistic like/save.
 *
 * 1. onMutate  – update the cache immediately, remember the old values
 * 2. request   – tell the server
 * 3. onSuccess – replace our guess with the server's real count
 *    onError   – put the old values back and tell the user
 *
 * `networkMode: 'always'` lets the mutation run while offline (React Query
 * would otherwise pause it), because sendOrQueue handles that case itself.
 *
 * The UI therefore responds on the same frame as the tap instead of waiting
 * for a network round trip.
 */
export function useNoteActions() {
  const client = useQueryClient();

  const like = useMutation({
    mutationFn: ({ note, value }: ToggleVars) => sendOrQueue('like', note.id, value, setLike),
    networkMode: 'always',
    onMutate: async ({ note, value }) => {
      // A detail fetch that started before the tap would overwrite the
      // optimistic value when it lands, so cancel it.
      await client.cancelQueries({ queryKey: noteKey(note.id) });
      const previous = { liked: note.liked, like_count: note.like_count };
      patchNote(client, note.id, {
        liked: value,
        like_count: Math.max(0, note.like_count + (value === note.liked ? 0 : value ? 1 : -1)),
      });
      return { previous };
    },
    onError: (_error, { note }, context) => {
      if (context) patchNote(client, note.id, context.previous);
      useToastStore.getState().show(i18n.t('note.actionFailed'));
    },
    onSuccess: (server, { note }) => {
      if (server) patchNote(client, note.id, server);
    },
  });

  const save = useMutation({
    mutationFn: ({ note, value }: ToggleVars) => sendOrQueue('save', note.id, value, setSave),
    networkMode: 'always',
    onMutate: async ({ note, value }) => {
      await client.cancelQueries({ queryKey: noteKey(note.id) });
      const previous = { saved: note.saved, save_count: note.save_count };
      patchNote(client, note.id, {
        saved: value,
        save_count: Math.max(0, note.save_count + (value === note.saved ? 0 : value ? 1 : -1)),
      });
      return { previous };
    },
    onError: (_error, { note }, context) => {
      if (context) patchNote(client, note.id, context.previous);
      useToastStore.getState().show(i18n.t('note.actionFailed'));
    },
    onSuccess: (server, { note }) => {
      if (server) patchNote(client, note.id, server);
    },
  });

  // `mutate` is referentially stable, so these callbacks are too – required
  // for memo()'d cards that receive them as props.
  const { mutate: mutateLike } = like;
  const { mutate: mutateSave } = save;
  const toggleLike = useCallback(
    (note: Note) => mutateLike({ note, value: !note.liked }),
    [mutateLike],
  );
  const toggleSave = useCallback(
    (note: Note) => mutateSave({ note, value: !note.saved }),
    [mutateSave],
  );

  return { toggleLike, toggleSave };
}
