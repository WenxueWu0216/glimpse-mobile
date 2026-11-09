import { useQuery } from '@tanstack/react-query';
import { useCallback, useState } from 'react';

import { translateNote } from '../../api/ai';
import type { Note } from '../../api/types';
import { getOfflineStore } from '../../offline/runtime';
import type { CachedTranslation } from '../../offline/types';

/** Device cache first, then the server (which has its own cache), then save. */
export async function loadTranslation(noteId: number, lang: string): Promise<CachedTranslation> {
  const store = getOfflineStore();
  const cached = await store.getTranslation(noteId, lang).catch(() => null);
  if (cached) return cached;
  const { title, body } = await translateNote(noteId, lang);
  const translation = { title, body };
  // A failed cache write only costs a repeat request later.
  await store.setTranslation(noteId, lang, translation).catch(() => undefined);
  return translation;
}

/**
 * On-demand translation of one note into the UI language.
 * Nothing is requested until the user taps "Translate".
 */
export function useNoteTranslation(note: Note | undefined, lang: string) {
  const [showTranslated, setShowTranslated] = useState(false);
  const noteId = note?.id ?? 0;

  const query = useQuery({
    queryKey: ['translation', noteId, lang],
    queryFn: () => loadTranslation(noteId, lang),
    enabled: showTranslated && noteId > 0,
    // A translation never goes stale, and once it is in SQLite it works
    // offline too, so the query must not wait for a connection.
    staleTime: Infinity,
    networkMode: 'always',
    retry: false,
  });

  const { refetch, isError } = query;
  const toggle = useCallback(() => {
    setShowTranslated((shown) => {
      // Tapping again after a failure is a retry, not "show original".
      if (shown && isError) {
        void refetch();
        return true;
      }
      return !shown;
    });
  }, [isError, refetch]);

  return {
    /** False when the note is already in the reader's language. */
    available: note !== undefined && note.lang !== lang,
    translation: showTranslated ? query.data : undefined,
    isTranslating: showTranslated && query.isFetching,
    failed: showTranslated && query.isError && !query.isFetching,
    toggle,
  };
}
