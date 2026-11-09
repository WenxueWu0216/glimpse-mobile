import { fireEvent, render, screen } from '@testing-library/react-native';

import '../../i18n';
import { makeNote } from '../../test/factories';
import { coverAspectRatio, NoteCard } from '../NoteCard';

// Avatar is replaced by a render counter: it renders once per NoteCard render,
// which lets a test observe whether memo() actually skipped the card.
const mockAvatarRender = jest.fn();
jest.mock('../Avatar', () => {
  const { Text } = jest.requireActual<typeof import('react-native')>('react-native');
  return {
    Avatar: ({ name }: { name: string }) => {
      mockAvatarRender();
      return <Text>{name.charAt(0).toUpperCase()}</Text>;
    },
  };
});

describe('NoteCard', () => {
  beforeEach(() => mockAvatarRender.mockClear());

  it('shows the title, author and formatted like count', async () => {
    const note = makeNote({ title: 'Slow morning', like_count: 1234 });
    await render(<NoteCard note={note} onPress={jest.fn()} onToggleLike={jest.fn()} />);

    expect(screen.getByText('Slow morning')).toBeOnTheScreen();
    expect(screen.getByText('Mia Chen')).toBeOnTheScreen();
    expect(screen.getByText('1.2k')).toBeOnTheScreen();
  });

  it('opens the note when the card is pressed', async () => {
    const note = makeNote({ id: 7 });
    const onPress = jest.fn();
    await render(<NoteCard note={note} onPress={onPress} onToggleLike={jest.fn()} />);

    await fireEvent.press(screen.getByTestId('note-card-7'));

    expect(onPress).toHaveBeenCalledWith(note);
  });

  it('toggles the like without opening the note', async () => {
    const note = makeNote({ id: 7 });
    const onPress = jest.fn();
    const onToggleLike = jest.fn();
    await render(<NoteCard note={note} onPress={onPress} onToggleLike={onToggleLike} />);

    await fireEvent.press(screen.getByRole('button', { name: 'Like' }));

    expect(onToggleLike).toHaveBeenCalledWith(note);
    expect(onPress).not.toHaveBeenCalled();
  });

  it('exposes the liked state to assistive technology', async () => {
    const note = makeNote({ liked: true });
    await render(<NoteCard note={note} onPress={jest.fn()} onToggleLike={jest.fn()} />);

    expect(screen.getByRole('button', { name: 'Unlike' })).toBeSelected();
  });

  it('does not re-render when the parent re-renders with the same props', async () => {
    const note = makeNote();
    const onPress = jest.fn();
    const onToggleLike = jest.fn();
    const view = await render(
      <NoteCard note={note} onPress={onPress} onToggleLike={onToggleLike} />,
    );
    expect(mockAvatarRender).toHaveBeenCalledTimes(1);

    await view.rerender(<NoteCard note={note} onPress={onPress} onToggleLike={onToggleLike} />);
    expect(mockAvatarRender).toHaveBeenCalledTimes(1);

    // A changed note (new object identity) must still update the card.
    await view.rerender(
      <NoteCard note={{ ...note, like_count: 11 }} onPress={onPress} onToggleLike={onToggleLike} />,
    );
    expect(mockAvatarRender).toHaveBeenCalledTimes(2);
    expect(screen.getByText('11')).toBeOnTheScreen();
  });
});

describe('coverAspectRatio', () => {
  it('clamps extreme shapes so cards stay a reasonable height', () => {
    expect(coverAspectRatio(600, 800)).toBeCloseTo(0.75);
    expect(coverAspectRatio(600, 3000)).toBe(0.6);
    expect(coverAspectRatio(3000, 600)).toBe(1.5);
    expect(coverAspectRatio(0, 0)).toBe(1);
  });
});
