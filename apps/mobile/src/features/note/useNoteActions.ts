import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';

import i18n from '../../i18n';
import { noteKey, patchNote } from '../../api/noteCache';
import { setLike, setSave } from '../../api/notes';
import type { Note } from '../../api/types';
import { useToastStore } from '../../state/toastStore';

interface ToggleVars {
  note: Note;
  value: boolean;
}

/**
 * Optimistic like/save.
 *
 * 1. onMutate  – update the cache immediately, remember the old values
 * 2. request   – tell the server
 * 3. onSuccess – replace our guess with the server's real count
 *    onError   – put the old values back and tell the user
 *
 * The UI therefore responds on the same frame as the tap instead of waiting
 * for a network round trip.
 */
export function useNoteActions() {
  const client = useQueryClient();

  const like = useMutation({
    mutationFn: ({ note, value }: ToggleVars) => setLike(note.id, value),
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
    onSuccess: (server, { note }) => patchNote(client, note.id, server),
  });

  const save = useMutation({
    mutationFn: ({ note, value }: ToggleVars) => setSave(note.id, value),
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
    onSuccess: (server, { note }) => patchNote(client, note.id, server),
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
