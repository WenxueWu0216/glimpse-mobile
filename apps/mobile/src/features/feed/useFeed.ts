import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useMemo, useState } from 'react';

import { FEED_KEY, type FeedData } from '../../api/noteCache';
import { fetchNotes } from '../../api/notes';
import type { Note } from '../../api/types';

/**
 * Infinite feed backed by cursor pagination.
 *
 * useInfiniteQuery stores an array of pages. `getNextPageParam` reads the
 * cursor out of the last page; returning undefined tells React Query there is
 * nothing more to load (hasNextPage becomes false).
 */
export function useFeed() {
  const queryClient = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);

  const query = useInfiniteQuery({
    queryKey: FEED_KEY,
    queryFn: ({ pageParam }) => fetchNotes(pageParam),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.next_cursor ?? undefined,
  });

  const notes = useMemo<Note[]>(() => {
    // New notes can push older ones onto the next page between requests, so
    // the same note may arrive twice; duplicate keys would break the list.
    const seen = new Set<number>();
    const out: Note[] = [];
    for (const page of query.data?.pages ?? []) {
      for (const note of page.items) {
        if (!seen.has(note.id)) {
          seen.add(note.id);
          out.push(note);
        }
      }
    }
    return out;
  }, [query.data]);

  const { hasNextPage, isFetchingNextPage, fetchNextPage, refetch } = query;

  const loadMore = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) void fetchNextPage();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      // refetch() would re-request every loaded page in sequence. Pull-to-refresh
      // only needs the newest notes, so fetch page one and swap it in atomically;
      // if the request fails the existing feed stays on screen.
      await queryClient.cancelQueries({ queryKey: FEED_KEY });
      const first = await fetchNotes(null);
      queryClient.setQueryData<FeedData>(FEED_KEY, { pages: [first], pageParams: [null] });
    } catch {
      // Keep showing what we have; the offline banner explains why.
    } finally {
      setRefreshing(false);
    }
  }, [queryClient]);

  return {
    notes,
    // Offline with nothing cached, React Query pauses the request instead of
    // failing it; treat that as "no data available" rather than loading forever.
    isLoading: query.isPending && query.fetchStatus !== 'paused',
    isError: query.isError,
    isPaused: query.isPending && query.fetchStatus === 'paused',
    isFetchingNextPage,
    hasNextPage,
    refreshing,
    loadMore,
    refresh,
    retry: refetch,
  };
}
