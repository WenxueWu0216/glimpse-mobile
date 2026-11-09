import { fireEvent, screen, waitFor } from '@testing-library/react-native';

import { ApiError } from '../../../api/client';
import { FEED_KEY, type FeedData } from '../../../api/noteCache';
import { fetchNote, setLike, setSave } from '../../../api/notes';
import type { LikeState } from '../../../api/types';
import { useToastStore } from '../../../state/toastStore';
import { makeNote } from '../../../test/factories';
import { createTestQueryClient, renderWithProviders } from '../../../test/render';
import { NoteDetailScreen } from '../NoteDetailScreen';

jest.mock('../../../api/notes');
const mockFetchNote = jest.mocked(fetchNote);
const mockSetLike = jest.mocked(setLike);
const mockSetSave = jest.mocked(setSave);

/** A promise the test resolves or rejects by hand, to observe the in-between state. */
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

const likeButton = () => screen.getByTestId('detail-like-button');

describe('NoteDetailScreen', () => {
  beforeEach(() => {
    mockFetchNote.mockReset();
    mockSetLike.mockReset();
    mockSetSave.mockReset();
    useToastStore.setState({ message: null });
    mockFetchNote.mockResolvedValue(
      makeNote({ id: 1, title: 'Kyoto mornings', body: 'Quiet streets.', like_count: 10 }),
    );
  });

  it('shows a skeleton, then the note with its tags', async () => {
    await renderWithProviders(<NoteDetailScreen noteId={1} />);

    expect(screen.getByTestId('note-skeleton')).toBeOnTheScreen();
    expect(await screen.findByText('Kyoto mornings')).toBeOnTheScreen();
    expect(screen.getByText('Quiet streets.')).toBeOnTheScreen();
    expect(screen.getByText('#coffee')).toBeOnTheScreen();
    expect(screen.getByText('#travel')).toBeOnTheScreen();
  });

  it('renders immediately from the feed cache without waiting for the network', async () => {
    const client = createTestQueryClient();
    client.setQueryData<FeedData>(FEED_KEY, {
      pages: [{ items: [makeNote({ id: 1, title: 'From cache' })], next_cursor: null }],
      pageParams: [null],
    });
    mockFetchNote.mockReturnValue(new Promise(() => {}));

    await renderWithProviders(<NoteDetailScreen noteId={1} />, client);

    expect(screen.getByText('From cache')).toBeOnTheScreen();
    expect(screen.queryByTestId('note-skeleton')).not.toBeOnTheScreen();
  });

  it('shows an error state when the note cannot be loaded', async () => {
    mockFetchNote.mockRejectedValue(new ApiError(404, 'Note not found'));
    await renderWithProviders(<NoteDetailScreen noteId={1} />);

    expect(await screen.findByText("Couldn't load this note")).toBeOnTheScreen();
  });

  it('likes optimistically before the server answers', async () => {
    const request = deferred<LikeState>();
    mockSetLike.mockReturnValue(request.promise);
    await renderWithProviders(<NoteDetailScreen noteId={1} />);
    await screen.findByText('Kyoto mornings');

    await fireEvent.press(likeButton());

    // The request is still pending, yet the UI already shows the like.
    await waitFor(() => expect(likeButton()).toBeSelected());
    expect(screen.getByText('11')).toBeOnTheScreen();
    expect(mockSetLike).toHaveBeenCalledWith(1, true);

    // The server's count wins once it arrives (someone else liked it too).
    request.resolve({ liked: true, like_count: 12 });
    expect(await screen.findByText('12')).toBeOnTheScreen();
  });

  it('rolls the like back and tells the user when the request fails', async () => {
    const request = deferred<LikeState>();
    mockSetLike.mockReturnValue(request.promise);
    await renderWithProviders(<NoteDetailScreen noteId={1} />);
    await screen.findByText('Kyoto mornings');

    await fireEvent.press(likeButton());
    await waitFor(() => expect(likeButton()).toBeSelected());
    expect(screen.getByText('11')).toBeOnTheScreen();

    request.reject(new ApiError(500, 'Server error'));

    await waitFor(() => expect(likeButton()).not.toBeSelected());
    expect(screen.getByText('10')).toBeOnTheScreen();
    expect(useToastStore.getState().message).toBe("Couldn't update. Please try again.");
  });

  it('rolls back only the failed note in the feed cache', async () => {
    const client = createTestQueryClient();
    client.setQueryData<FeedData>(FEED_KEY, {
      pages: [
        {
          items: [makeNote({ id: 1, like_count: 10 }), makeNote({ id: 2, like_count: 5 })],
          next_cursor: null,
        },
      ],
      pageParams: [null],
    });
    mockSetLike.mockRejectedValue(new ApiError(500, 'Server error'));
    await renderWithProviders(<NoteDetailScreen noteId={1} />, client);

    await fireEvent.press(likeButton());

    await waitFor(() => expect(useToastStore.getState().message).not.toBeNull());
    const items = client.getQueryData<FeedData>(FEED_KEY)?.pages[0]?.items;
    expect(items?.[0]).toMatchObject({ id: 1, liked: false, like_count: 10 });
    expect(items?.[1]).toMatchObject({ id: 2, liked: false, like_count: 5 });
  });

  it('unlikes a note that is already liked', async () => {
    mockFetchNote.mockResolvedValue(makeNote({ id: 1, liked: true, like_count: 10 }));
    mockSetLike.mockResolvedValue({ liked: false, like_count: 9 });
    await renderWithProviders(<NoteDetailScreen noteId={1} />);
    await screen.findByText('Note 1');

    await fireEvent.press(likeButton());

    expect(mockSetLike).toHaveBeenCalledWith(1, false);
    await waitFor(() => expect(likeButton()).not.toBeSelected());
    expect(screen.getByText('9')).toBeOnTheScreen();
  });

  it('saves optimistically and rolls back on failure', async () => {
    const request = deferred<never>();
    mockSetSave.mockReturnValue(request.promise);
    await renderWithProviders(<NoteDetailScreen noteId={1} />);
    await screen.findByText('Kyoto mornings');

    await fireEvent.press(screen.getByTestId('detail-save-button'));
    await waitFor(() => expect(screen.getByTestId('detail-save-button')).toBeSelected());
    expect(screen.getByText('3')).toBeOnTheScreen();

    request.reject(new ApiError(500, 'Server error'));

    await waitFor(() => expect(screen.getByTestId('detail-save-button')).not.toBeSelected());
    expect(screen.getByText('2')).toBeOnTheScreen();
  });
});
