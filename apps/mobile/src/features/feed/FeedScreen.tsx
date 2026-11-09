import { FlashList, type ListRenderItem } from '@shopify/flash-list';
import { useCallback } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import type { Note } from '../../api/types';
import { NoteCard } from '../../components/NoteCard';
import { FeedSkeleton } from '../../components/Skeleton';
import { StateView } from '../../components/StateView';
import { useTheme } from '../../theme/useTheme';
import { useFeed } from './useFeed';

interface Props {
  onOpenNote: (note: Note) => void;
  onToggleLike: (note: Note) => void;
}

const keyExtractor = (note: Note) => String(note.id);

export function FeedScreen({ onOpenNote, onToggleLike }: Props) {
  const theme = useTheme();
  const { t } = useTranslation();
  const feed = useFeed();

  // useCallback keeps the same function between renders. Without it every
  // render would hand each NoteCard a "new" prop and defeat memo().
  const renderItem = useCallback<ListRenderItem<Note>>(
    ({ item }) => <NoteCard note={item} onPress={onOpenNote} onToggleLike={onToggleLike} />,
    [onOpenNote, onToggleLike],
  );

  if (feed.isLoading) {
    return (
      <View style={[styles.fill, { backgroundColor: theme.background }]}>
        <FeedSkeleton />
      </View>
    );
  }

  if (feed.isError && feed.notes.length === 0) {
    return (
      <View style={[styles.fill, { backgroundColor: theme.background }]}>
        <StateView
          testID="feed-error"
          icon="cloud-offline-outline"
          title={t('feed.errorTitle')}
          body={t('feed.errorBody')}
          actionLabel={t('feed.retry')}
          onAction={() => void feed.retry()}
        />
      </View>
    );
  }

  return (
    <View style={[styles.fill, { backgroundColor: theme.background }]}>
      <FlashList
        testID="feed-list"
        data={feed.notes}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        // FlashList recycles a small pool of cell views instead of mounting one
        // per row like FlatList. `masonry` places each card in the shorter of
        // the two columns, giving the staggered layout.
        masonry
        numColumns={2}
        contentContainerStyle={styles.content}
        onEndReached={feed.loadMore}
        onEndReachedThreshold={0.6}
        refreshing={feed.refreshing}
        onRefresh={() => void feed.refresh()}
        ListEmptyComponent={
          <StateView
            testID="feed-empty"
            icon="images-outline"
            title={t('feed.emptyTitle')}
            body={t('feed.emptyBody')}
          />
        }
        ListFooterComponent={
          feed.isFetchingNextPage ? (
            <ActivityIndicator
              style={styles.footer}
              color={theme.textMuted}
              accessibilityLabel={t('feed.loadingMore')}
            />
          ) : null
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  content: { padding: 4 },
  footer: { paddingVertical: 16 },
});
