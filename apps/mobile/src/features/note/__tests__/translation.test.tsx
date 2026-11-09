import { fireEvent, screen, waitFor } from '@testing-library/react-native';

import { translateNote } from '../../../api/ai';
import { ApiError } from '../../../api/client';
import { fetchNote } from '../../../api/notes';
import { MemoryStore } from '../../../offline/memoryStore';
import { getOfflineStore, resetOfflineRuntime } from '../../../offline/runtime';
import { makeNote } from '../../../test/factories';
import { renderWithProviders } from '../../../test/render';
import { NoteDetailScreen } from '../NoteDetailScreen';

// The AI client is always mocked: tests never reach the backend or the model.
jest.mock('../../../api/ai');
jest.mock('../../../api/notes');
const mockTranslate = jest.mocked(translateNote);
const mockFetchNote = jest.mocked(fetchNote);

const zhNote = makeNote({ id: 1, lang: 'zh', title: '周末citywalk路线', body: '从老街出发。' });
const translated = {
  title: 'Weekend city walk route',
  body: 'Start from the old street.',
  lang: 'en',
};

const translateButton = () => screen.getByTestId('translate-button');

describe('note translation', () => {
  beforeEach(() => {
    mockTranslate.mockReset();
    mockFetchNote.mockReset();
    resetOfflineRuntime(new MemoryStore());
    mockFetchNote.mockResolvedValue(zhNote);
  });

  it('translates on demand and can switch back to the original', async () => {
    mockTranslate.mockResolvedValueOnce(translated);
    await renderWithProviders(<NoteDetailScreen noteId={1} />);
    await screen.findByText('周末citywalk路线');
    // Nothing is requested until the user asks.
    expect(mockTranslate).not.toHaveBeenCalled();

    await fireEvent.press(translateButton());

    expect(await screen.findByText('Weekend city walk route')).toBeOnTheScreen();
    expect(screen.getByText('Start from the old street.')).toBeOnTheScreen();
    expect(mockTranslate).toHaveBeenCalledWith(1, 'en');

    await fireEvent.press(screen.getByText('Show original'));
    expect(screen.getByText('周末citywalk路线')).toBeOnTheScreen();
  });

  it('hides the button when the note is already in the UI language', async () => {
    mockFetchNote.mockResolvedValue(makeNote({ id: 1, lang: 'en' }));
    await renderWithProviders(<NoteDetailScreen noteId={1} />);
    await screen.findByText('Note 1');

    expect(screen.queryByTestId('translate-button')).not.toBeOnTheScreen();
  });

  it('stores the translation on the device', async () => {
    mockTranslate.mockResolvedValueOnce(translated);
    await renderWithProviders(<NoteDetailScreen noteId={1} />);
    await screen.findByText('周末citywalk路线');

    await fireEvent.press(translateButton());
    await screen.findByText('Weekend city walk route');

    expect(await getOfflineStore().getTranslation(1, 'en')).toEqual({
      title: 'Weekend city walk route',
      body: 'Start from the old street.',
    });
  });

  it('uses the device cache without calling the API', async () => {
    await getOfflineStore().setTranslation(1, 'en', { title: 'Cached title', body: 'Cached body' });
    await renderWithProviders(<NoteDetailScreen noteId={1} />);
    await screen.findByText('周末citywalk路线');

    await fireEvent.press(translateButton());

    expect(await screen.findByText('Cached title')).toBeOnTheScreen();
    expect(mockTranslate).not.toHaveBeenCalled();
  });

  it('keeps the original text and offers a retry when translation fails', async () => {
    mockTranslate
      .mockRejectedValueOnce(new ApiError(503, 'Translation is temporarily unavailable'))
      .mockResolvedValueOnce(translated);
    await renderWithProviders(<NoteDetailScreen noteId={1} />);
    await screen.findByText('周末citywalk路线');

    await fireEvent.press(translateButton());

    expect(await screen.findByText(/Translation is unavailable right now/)).toBeOnTheScreen();
    expect(screen.getByText('周末citywalk路线')).toBeOnTheScreen();
    expect(await getOfflineStore().getTranslation(1, 'en')).toBeNull();

    await fireEvent.press(screen.getByText('Try translating again'));

    expect(await screen.findByText('Weekend city walk route')).toBeOnTheScreen();
    await waitFor(() =>
      expect(screen.queryByText(/Translation is unavailable/)).not.toBeOnTheScreen(),
    );
  });
});
