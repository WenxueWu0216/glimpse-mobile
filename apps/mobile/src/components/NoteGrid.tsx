import { FlashList, type ListRenderItem } from '@shopify/flash-list';
import { useCallback, type ReactElement } from 'react';
import { StyleSheet } from 'react-native';

import type { Note } from '../api/types';
import { NoteCard } from './NoteCard';

interface Props {
  notes: Note[];
  onOpenNote: (note: Note) => void;
  onToggleLike: (note: Note) => void;
  onEndReached?: () => void;
  refreshing?: boolean;
  onRefresh?: () => void;
  ListEmptyComponent?: ReactElement;
  ListFooterComponent?: ReactElement | null;
  testID?: string;
}

const keyExtractor = (note: Note) => String(note.id);

/** Two-column masonry grid of notes, shared by the feed and the saved tab. */
export function NoteGrid({ notes, onOpenNote, onToggleLike, testID, ...listProps }: Props) {
  // useCallback keeps the same function between renders. Without it every
  // render would hand each NoteCard a "new" prop and defeat memo().
  const renderItem = useCallback<ListRenderItem<Note>>(
    ({ item }) => <NoteCard note={item} onPress={onOpenNote} onToggleLike={onToggleLike} />,
    [onOpenNote, onToggleLike],
  );

  return (
    <FlashList
      testID={testID}
      data={notes}
      renderItem={renderItem}
      keyExtractor={keyExtractor}
      // FlashList recycles a small pool of cell views instead of mounting one
      // per row like FlatList. `masonry` places each card in the shorter of
      // the two columns, giving the staggered layout.
      masonry
      numColumns={2}
      contentContainerStyle={styles.content}
      onEndReachedThreshold={0.6}
      {...listProps}
    />
  );
}

const styles = StyleSheet.create({
  content: { padding: 4 },
});
