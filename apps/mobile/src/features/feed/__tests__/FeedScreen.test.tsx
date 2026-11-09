import { fireEvent, screen, waitFor } from '@testing-library/react-native';

import { fetchNotes } from '../../../api/notes';
import { makePage } from '../../../test/factories';
import { renderWithProviders } from '../../../test/render';
import { FeedScreen } from '../FeedScreen';

// The API module is replaced with a mock: tests never touch the network.
jest.mock('../../../api/notes');
const mockFetchNotes = jest.mocked(fetchNotes);

function renderFeed() {
  return renderWithProviders(<FeedScreen onOpenNote={jest.fn()} onToggleLike={jest.fn()} />);
}

describe('FeedScreen', () => {
  afterEach(() => mockFetchNotes.mockReset());

  it('shows a skeleton while the first page loads, then the notes', async () => {
    mockFetchNotes.mockResolvedValueOnce(makePage(3, 3, null));
    await renderFeed();

    expect(screen.getByTestId('feed-skeleton')).toBeOnTheScreen();
    expect(await screen.findByText('Note 3')).toBeOnTheScreen();
    expect(screen.queryByTestId('feed-skeleton')).not.toBeOnTheScreen();
    expect(mockFetchNotes).toHaveBeenCalledWith(null);
  });

  it('requests the next page with the cursor from the previous one', async () => {
    mockFetchNotes
      .mockResolvedValueOnce(makePage(6, 3, '4'))
      .mockResolvedValueOnce(makePage(3, 3, null));
    await renderFeed();
    await screen.findByText('Note 6');

    await fireEvent(screen.getByTestId('feed-list'), 'endReached');

    await waitFor(() => expect(mockFetchNotes).toHaveBeenLastCalledWith('4'));
    await waitFor(() => expect(mockFetchNotes).toHaveBeenCalledTimes(2));
  });

  it('stops paginating after the last page', async () => {
    mockFetchNotes.mockResolvedValueOnce(makePage(2, 2, null));
    await renderFeed();
    await screen.findByText('Note 2');

    await fireEvent(screen.getByTestId('feed-list'), 'endReached');
    await fireEvent(screen.getByTestId('feed-list'), 'endReached');

    expect(mockFetchNotes).toHaveBeenCalledTimes(1);
  });

  it('does not request the same page twice while it is already loading', async () => {
    let resolveSecond: (page: ReturnType<typeof makePage>) => void = () => {};
    mockFetchNotes
      .mockResolvedValueOnce(makePage(6, 3, '4'))
      .mockReturnValueOnce(new Promise((resolve) => (resolveSecond = resolve)));
    await renderFeed();
    await screen.findByText('Note 6');

    await fireEvent(screen.getByTestId('feed-list'), 'endReached');
    await fireEvent(screen.getByTestId('feed-list'), 'endReached');

    expect(mockFetchNotes).toHaveBeenCalledTimes(2);
    resolveSecond(makePage(3, 3, null));
    await waitFor(() =>
      expect(screen.queryByLabelText('Loading more notes')).not.toBeOnTheScreen(),
    );
  });

  it('pull-to-refresh refetches only the first page', async () => {
    mockFetchNotes
      .mockResolvedValueOnce(makePage(6, 3, '4'))
      .mockResolvedValueOnce(makePage(3, 3, null))
      .mockResolvedValueOnce(makePage(7, 3, null));
    await renderFeed();
    await screen.findByText('Note 6');
    await fireEvent(screen.getByTestId('feed-list'), 'endReached');
    await waitFor(() => expect(mockFetchNotes).toHaveBeenCalledTimes(2));

    await fireEvent(screen.getByTestId('feed-list'), 'refresh');

    expect(await screen.findByText('Note 7')).toBeOnTheScreen();
    expect(mockFetchNotes).toHaveBeenCalledTimes(3);
    expect(mockFetchNotes).toHaveBeenLastCalledWith(null);
    expect(screen.queryByText('Note 3')).not.toBeOnTheScreen();
  });

  it('keeps the current notes when pull-to-refresh fails', async () => {
    mockFetchNotes
      .mockResolvedValueOnce(makePage(3, 3, null))
      .mockRejectedValueOnce(new Error('offline'));
    await renderFeed();
    await screen.findByText('Note 3');

    await fireEvent(screen.getByTestId('feed-list'), 'refresh');

    await waitFor(() => expect(mockFetchNotes).toHaveBeenCalledTimes(2));
    expect(screen.getByText('Note 3')).toBeOnTheScreen();
  });

  it('shows an empty state when there are no notes', async () => {
    mockFetchNotes.mockResolvedValueOnce({ items: [], next_cursor: null });
    await renderFeed();

    expect(await screen.findByText('No notes yet')).toBeOnTheScreen();
  });

  it('shows an error state and recovers on retry', async () => {
    mockFetchNotes
      .mockRejectedValueOnce(new Error('boom'))
      .mockResolvedValueOnce(makePage(1, 1, null));
    await renderFeed();

    expect(await screen.findByText("Couldn't load the feed")).toBeOnTheScreen();
    await fireEvent.press(screen.getByText('Try again'));

    expect(await screen.findByText('Note 1')).toBeOnTheScreen();
  });
});
