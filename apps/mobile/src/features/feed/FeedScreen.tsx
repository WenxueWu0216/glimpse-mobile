import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import type { Note } from '../../api/types';
import { NoteGrid } from '../../components/NoteGrid';
import { OfflineBanner } from '../../components/OfflineBanner';
import { FeedSkeleton } from '../../components/Skeleton';
import { StateView } from '../../components/StateView';
import { useTheme } from '../../theme/useTheme';
import { useFeed } from './useFeed';

interface Props {
  onOpenNote: (note: Note) => void;
  onToggleLike: (note: Note) => void;
}

export function FeedScreen({ onOpenNote, onToggleLike }: Props) {
  const theme = useTheme();
  const { t } = useTranslation();
  const feed = useFeed();

  if (feed.isLoading) {
    return (
      <View style={[styles.fill, { backgroundColor: theme.background }]}>
        <FeedSkeleton />
      </View>
    );
  }

  if (feed.isPaused) {
    return (
      <View style={[styles.fill, { backgroundColor: theme.background }]}>
        <OfflineBanner />
        <StateView
          testID="feed-offline-empty"
          icon="cloud-offline-outline"
          title={t('offline.noCacheTitle')}
          body={t('offline.noCacheBody')}
        />
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
      <OfflineBanner />
      <NoteGrid
        testID="feed-list"
        notes={feed.notes}
        onOpenNote={onOpenNote}
        onToggleLike={onToggleLike}
        onEndReached={feed.loadMore}
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
  footer: { paddingVertical: 16 },
});
