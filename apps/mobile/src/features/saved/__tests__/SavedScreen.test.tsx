import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';

import { patchNote } from '../../../api/noteCache';
import { fetchSaved } from '../../../api/notes';
import { useNetworkStore } from '../../../state/networkStore';
import { makeNote } from '../../../test/factories';
import { renderWithProviders } from '../../../test/render';
import { SavedScreen } from '../SavedScreen';

jest.mock('../../../api/notes');
const mockFetchSaved = jest.mocked(fetchSaved);

const renderSaved = () =>
  renderWithProviders(<SavedScreen onOpenNote={jest.fn()} onToggleLike={jest.fn()} />);

describe('SavedScreen', () => {
  beforeEach(() => {
    mockFetchSaved.mockReset();
    useNetworkStore.setState({ isOnline: true, pendingActions: 0 });
  });

  it('lists saved notes', async () => {
    mockFetchSaved.mockResolvedValueOnce([
      makeNote({ id: 4, title: 'Kept for later', saved: true }),
    ]);
    await renderSaved();

    expect(await screen.findByText('Kept for later')).toBeOnTheScreen();
  });

  it('shows an empty state when nothing is saved', async () => {
    mockFetchSaved.mockResolvedValueOnce([]);
    await renderSaved();

    expect(await screen.findByText('Nothing saved yet')).toBeOnTheScreen();
  });

  it('removes a note from the list as soon as it is unsaved elsewhere', async () => {
    mockFetchSaved.mockResolvedValueOnce([
      makeNote({ id: 4, title: 'First', saved: true }),
      makeNote({ id: 5, title: 'Second', saved: true }),
    ]);
    const { queryClient } = await renderSaved();
    await screen.findByText('First');

    await act(async () => patchNote(queryClient, 4, { saved: false }));

    await waitFor(() => expect(screen.queryByText('First')).not.toBeOnTheScreen());
    expect(screen.getByText('Second')).toBeOnTheScreen();
  });

  it('shows an error state with retry when loading fails', async () => {
    mockFetchSaved
      .mockRejectedValueOnce(new Error('boom'))
      .mockResolvedValueOnce([makeNote({ id: 4, title: 'Recovered', saved: true })]);
    await renderSaved();

    expect(await screen.findByText("Couldn't load saved notes")).toBeOnTheScreen();
    await fireEvent.press(screen.getByText('Try again'));
    expect(await screen.findByText('Recovered')).toBeOnTheScreen();
  });
});
