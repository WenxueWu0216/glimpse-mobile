import { fireEvent, screen, waitFor } from '@testing-library/react-native';

import { NetworkError } from '../../../api/client';
import { fetchNote, setLike } from '../../../api/notes';
import { MemoryStore } from '../../../offline/memoryStore';
import { getSyncQueue, resetOfflineRuntime } from '../../../offline/runtime';
import { useNetworkStore } from '../../../state/networkStore';
import { useToastStore } from '../../../state/toastStore';
import { makeNote } from '../../../test/factories';
import { renderWithProviders } from '../../../test/render';
import { NoteDetailScreen } from '../NoteDetailScreen';

jest.mock('../../../api/notes');
const mockFetchNote = jest.mocked(fetchNote);
const mockSetLike = jest.mocked(setLike);

const likeButton = () => screen.getByTestId('detail-like-button');

describe('like while offline', () => {
  beforeEach(() => {
    mockFetchNote.mockReset();
    mockSetLike.mockReset();
    resetOfflineRuntime(new MemoryStore());
    useNetworkStore.setState({ isOnline: true, pendingActions: 0 });
    useToastStore.setState({ message: null });
    mockFetchNote.mockResolvedValue(makeNote({ id: 1, like_count: 10 }));
  });

  it('queues the like instead of calling the API, and keeps it on screen', async () => {
    useNetworkStore.setState({ isOnline: false });
    await renderWithProviders(<NoteDetailScreen noteId={1} />);
    await screen.findByText('Note 1');

    await fireEvent.press(likeButton());

    await waitFor(async () => expect(await getSyncQueue().pendingCount()).toBe(1));
    expect(mockSetLike).not.toHaveBeenCalled();
    // The queue is checked through the store, not the UI, so give React a
    // chance to commit the optimistic update before asserting on the screen.
    await waitFor(() => expect(likeButton()).toBeSelected());
    expect(screen.getByText('11')).toBeOnTheScreen();
    expect(useToastStore.getState().message).toBeNull();
  });

  it('sends nothing when a like is undone before reconnecting', async () => {
    useNetworkStore.setState({ isOnline: false });
    await renderWithProviders(<NoteDetailScreen noteId={1} />);
    await screen.findByText('Note 1');

    await fireEvent.press(likeButton());
    await waitFor(() => expect(likeButton()).toBeSelected());
    await fireEvent.press(likeButton());
    await waitFor(() => expect(likeButton()).not.toBeSelected());

    await waitFor(async () => expect(await getSyncQueue().pendingCount()).toBe(0));
    expect(await screen.findByText('10')).toBeOnTheScreen();
  });

  it('queues the like when the request fails before the device noticed it is offline', async () => {
    mockSetLike.mockRejectedValueOnce(new NetworkError());
    await renderWithProviders(<NoteDetailScreen noteId={1} />);
    await screen.findByText('Note 1');

    await fireEvent.press(likeButton());

    await waitFor(async () => expect(await getSyncQueue().pendingCount()).toBe(1));
    // Not rolled back: it will be retried by the queue.
    await waitFor(() => expect(likeButton()).toBeSelected());
    expect(useToastStore.getState().message).toBeNull();
  });

  it('syncs the queued like once the queue is flushed', async () => {
    useNetworkStore.setState({ isOnline: false });
    mockSetLike.mockResolvedValue({ liked: true, like_count: 11 });
    await renderWithProviders(<NoteDetailScreen noteId={1} />);
    await screen.findByText('Note 1');
    await fireEvent.press(likeButton());
    await waitFor(async () => expect(await getSyncQueue().pendingCount()).toBe(1));

    const result = await getSyncQueue().flush();

    expect(result).toEqual({ synced: 1, dropped: 0, remaining: 0 });
    expect(mockSetLike).toHaveBeenCalledWith(1, true);
  });
});
