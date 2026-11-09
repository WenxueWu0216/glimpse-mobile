/**
 * Measures how many cards render when ONE note in the feed is liked.
 * The numbers printed by this test are the ones quoted in the README.
 */
import { act, screen } from '@testing-library/react-native';
import { useQuery } from '@tanstack/react-query';
import type { ComponentType } from 'react';

import { FEED_KEY, patchNote, type FeedData } from '../../api/noteCache';
import type { Note } from '../../api/types';
import { NoteGrid } from '../../components/NoteGrid';
import { makePage } from '../../test/factories';
import { createTestQueryClient, renderWithProviders } from '../../test/render';
import { BaselineNoteGrid } from '../BaselineNoteGrid';

// One Avatar renders per card render, so counting Avatars counts card renders.
const mockCardRender = jest.fn();
jest.mock('../../components/Avatar', () => ({
  Avatar: () => {
    mockCardRender();
    return null;
  },
}));

const NOTES = 20;
const noop = () => {};

function Feed({ Grid }: { Grid: ComponentType<React.ComponentProps<typeof NoteGrid>> }) {
  const { data } = useQuery<FeedData>({
    queryKey: FEED_KEY,
    queryFn: () => new Promise<FeedData>(() => {}),
    enabled: false,
  });
  const notes: Note[] = data?.pages.flatMap((page) => page.items) ?? [];
  return <Grid notes={notes} onOpenNote={noop} onToggleLike={noop} />;
}

async function cardRendersForOneLike(Grid: ComponentType<React.ComponentProps<typeof NoteGrid>>) {
  const client = createTestQueryClient();
  client.setQueryData<FeedData>(FEED_KEY, {
    pages: [makePage(NOTES, NOTES, null)],
    pageParams: [null],
  });
  const view = await renderWithProviders(<Feed Grid={Grid} />, client);
  const mounted = mockCardRender.mock.calls.length;
  mockCardRender.mockClear();

  await act(async () => patchNote(client, 5, { liked: true, like_count: 11 }));

  expect(await screen.findByText('11')).toBeOnTheScreen();
  const rerendered = mockCardRender.mock.calls.length;
  await view.unmount();
  return { mounted, rerendered };
}

describe('card re-renders when one note is liked', () => {
  beforeEach(() => mockCardRender.mockClear());

  it('baseline: every mounted card renders again', async () => {
    const { mounted, rerendered } = await cardRendersForOneLike(BaselineNoteGrid);
    console.info(`[perf] baseline: ${rerendered} of ${mounted} mounted cards re-rendered`);
    expect(mounted).toBe(NOTES);
    expect(rerendered).toBe(NOTES);
  });

  it('optimised: only the liked card renders again', async () => {
    const { mounted, rerendered } = await cardRendersForOneLike(NoteGrid);
    console.info(`[perf] optimised: ${rerendered} of ${mounted} mounted cards re-rendered`);
    expect(mounted).toBeGreaterThan(0);
    expect(rerendered).toBe(1);
  });
});
