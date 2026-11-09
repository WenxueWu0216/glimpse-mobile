import { act, fireEvent, screen } from '@testing-library/react-native';

import { suggestTags } from '../../../api/ai';
import { renderWithProviders } from '../../../test/render';
import { ComposerScreen } from '../ComposerScreen';
import { SUGGEST_DEBOUNCE_MS } from '../useSuggestedTags';

jest.mock('../../../api/ai');
jest.mock('../../../api/notes');
jest.mock('expo-image-picker');
const mockSuggest = jest.mocked(suggestTags);

/** Let the debounce timer fire and the resulting request settle. */
async function pauseTyping() {
  await act(async () => {
    await jest.advanceTimersByTimeAsync(SUGGEST_DEBOUNCE_MS + 50);
  });
}

describe('AI tag suggestions in the composer', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    mockSuggest.mockReset();
  });
  afterEach(() => jest.useRealTimers());

  it('asks once after typing pauses, not on every keystroke', async () => {
    mockSuggest.mockResolvedValue(['coffee', 'lisbon']);
    await renderWithProviders(<ComposerScreen onPublished={jest.fn()} />);
    const title = screen.getByTestId('composer-title');

    await fireEvent.changeText(title, 'Morning');
    await fireEvent.changeText(title, 'Morning coffee');
    await fireEvent.changeText(title, 'Morning coffee in Lisbon');
    expect(mockSuggest).not.toHaveBeenCalled();
    await pauseTyping();

    expect(mockSuggest).toHaveBeenCalledTimes(1);
    expect(mockSuggest).toHaveBeenCalledWith('Morning coffee in Lisbon', '');
    expect(await screen.findByText('#coffee')).toBeOnTheScreen();
    expect(screen.getByText('#lisbon')).toBeOnTheScreen();
  });

  it('adds a suggestion as a tag when tapped and removes it from the suggestions', async () => {
    mockSuggest.mockResolvedValue(['coffee', 'lisbon']);
    await renderWithProviders(<ComposerScreen onPublished={jest.fn()} />);
    await fireEvent.changeText(screen.getByTestId('composer-title'), 'Morning coffee in Lisbon');
    await pauseTyping();

    await fireEvent.press(await screen.findByText('#coffee'));

    // Still exactly one "#coffee": now as a selected tag, no longer suggested.
    expect(screen.getAllByText('#coffee')).toHaveLength(1);
    expect(screen.getByRole('button', { name: '#coffee' })).toBeSelected();
    expect(screen.getByRole('button', { name: '#lisbon' })).not.toBeSelected();
  });

  it('does not call the API for very short drafts', async () => {
    await renderWithProviders(<ComposerScreen onPublished={jest.fn()} />);
    await fireEvent.changeText(screen.getByTestId('composer-title'), 'Hi');
    await pauseTyping();

    expect(mockSuggest).not.toHaveBeenCalled();
  });

  it('shows no suggestions, and no error, when the request fails', async () => {
    mockSuggest.mockRejectedValue(new Error('503'));
    await renderWithProviders(<ComposerScreen onPublished={jest.fn()} />);
    await fireEvent.changeText(screen.getByTestId('composer-title'), 'Morning coffee in Lisbon');
    await pauseTyping();

    expect(mockSuggest).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId('composer-suggested-tags')).not.toBeOnTheScreen();
    expect(screen.getByTestId('composer-title').props.value).toBe('Morning coffee in Lisbon');
  });
});
