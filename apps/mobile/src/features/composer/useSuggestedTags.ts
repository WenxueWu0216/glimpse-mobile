import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';

import { suggestTags } from '../../api/ai';

export const SUGGEST_DEBOUNCE_MS = 900;
const MIN_CHARS = 8;

/** Returns `value` only after it has stopped changing for `delayMs`. */
function useDebounced<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);
  return debounced;
}

/**
 * AI tag suggestions for the draft. Debounced so the model is asked once the
 * user pauses typing, not on every keystroke. Any failure simply yields no
 * suggestions: the composer works the same without them.
 */
export function useSuggestedTags(title: string, body: string): string[] {
  const draft = useDebounced(`${title.trim()}\n${body.trim()}`, SUGGEST_DEBOUNCE_MS);
  const [draftTitle = '', draftBody = ''] = draft.split('\n', 2);

  const query = useQuery({
    queryKey: ['suggested-tags', draft],
    queryFn: () => suggestTags(draftTitle, draftBody),
    enabled: draft.length - 1 >= MIN_CHARS,
    staleTime: Infinity,
    retry: false,
    // Keep showing the previous chips while new ones load, to avoid flicker.
    placeholderData: keepPreviousData,
  });

  return query.isError ? [] : (query.data ?? []);
}
