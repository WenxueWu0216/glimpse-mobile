import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import * as ImagePicker from 'expo-image-picker';

import { FEED_KEY, type FeedData } from '../../../api/noteCache';
import { createNote } from '../../../api/notes';
import { makeNote, makePage } from '../../../test/factories';
import { createTestQueryClient, renderWithProviders } from '../../../test/render';
import { ComposerScreen } from '../ComposerScreen';

jest.mock('../../../api/notes');
jest.mock('expo-image-picker');
const mockCreateNote = jest.mocked(createNote);
const mockPicker = jest.mocked(ImagePicker.launchImageLibraryAsync);

function pickerReturns(...uris: string[]) {
  mockPicker.mockResolvedValueOnce({
    canceled: false,
    assets: uris.map((uri) => ({ uri, width: 10, height: 10, mimeType: 'image/jpeg' })),
  });
}

const publishButton = () => screen.getByTestId('composer-publish');

describe('ComposerScreen', () => {
  beforeEach(() => {
    mockCreateNote.mockReset();
    mockPicker.mockReset();
  });

  it('keeps Publish disabled until there is a photo and a title', async () => {
    pickerReturns('file:///a.jpg');
    await renderWithProviders(<ComposerScreen onPublished={jest.fn()} />);
    expect(publishButton()).toBeDisabled();

    await fireEvent.changeText(screen.getByTestId('composer-title'), 'Hello');
    expect(publishButton()).toBeDisabled();

    await fireEvent.press(screen.getByTestId('composer-add-photo'));
    await waitFor(() => expect(publishButton()).toBeEnabled());
  });

  it('turns typed words into tags and removes a tag when tapped', async () => {
    await renderWithProviders(<ComposerScreen onPublished={jest.fn()} />);
    const input = screen.getByTestId('composer-tags');

    await fireEvent.changeText(input, '#Coffee ');
    await fireEvent.changeText(input, 'travel,');
    await fireEvent.changeText(input, 'coffee ');

    expect(screen.getAllByText('#coffee')).toHaveLength(1);
    expect(screen.getByText('#travel')).toBeOnTheScreen();

    await fireEvent.press(screen.getByText('#coffee'));
    expect(screen.queryByText('#coffee')).not.toBeOnTheScreen();
  });

  it('uploads the draft, adds the note to the feed and closes', async () => {
    const client = createTestQueryClient();
    client.setQueryData<FeedData>(FEED_KEY, { pages: [makePage(3, 3, null)], pageParams: [null] });
    const created = makeNote({ id: 42, title: 'Hello' });
    mockCreateNote.mockResolvedValueOnce(created);
    pickerReturns('file:///a.jpg', 'file:///b.jpg');
    const onPublished = jest.fn();
    await renderWithProviders(<ComposerScreen onPublished={onPublished} />, client);

    await fireEvent.press(screen.getByTestId('composer-add-photo'));
    await screen.findByText('2/9');
    await fireEvent.changeText(screen.getByTestId('composer-title'), '  Hello ');
    await fireEvent.changeText(screen.getByTestId('composer-body'), 'First post');
    await fireEvent.changeText(screen.getByTestId('composer-tags'), 'coffee ');
    // A tag still being typed is included without needing a trailing space.
    await fireEvent.changeText(screen.getByTestId('composer-tags'), 'kyoto');
    await fireEvent.press(publishButton());

    await waitFor(() => expect(onPublished).toHaveBeenCalledWith(created));
    expect(mockCreateNote.mock.calls[0]?.[0]).toMatchObject({
      title: 'Hello',
      body: 'First post',
      tags: ['coffee', 'kyoto'],
      lang: 'en',
      images: [{ uri: 'file:///a.jpg' }, { uri: 'file:///b.jpg' }],
    });
    expect(client.getQueryData<FeedData>(FEED_KEY)?.pages[0]?.items[0]?.id).toBe(42);
  });

  it('keeps the draft and shows an error when publishing fails', async () => {
    mockCreateNote.mockRejectedValueOnce(new Error('offline'));
    pickerReturns('file:///a.jpg');
    const onPublished = jest.fn();
    await renderWithProviders(<ComposerScreen onPublished={onPublished} />);

    await fireEvent.press(screen.getByTestId('composer-add-photo'));
    await fireEvent.changeText(screen.getByTestId('composer-title'), 'Hello');
    await waitFor(() => expect(publishButton()).toBeEnabled());
    await fireEvent.press(publishButton());

    expect(await screen.findByText(/Couldn't publish/)).toBeOnTheScreen();
    expect(screen.getByTestId('composer-title').props.value).toBe('Hello');
    expect(onPublished).not.toHaveBeenCalled();
  });

  it('does nothing when the picker is cancelled', async () => {
    mockPicker.mockResolvedValueOnce({ canceled: true, assets: null });
    await renderWithProviders(<ComposerScreen onPublished={jest.fn()} />);

    await fireEvent.press(screen.getByTestId('composer-add-photo'));

    expect(await screen.findByText('0/9')).toBeOnTheScreen();
  });
});
