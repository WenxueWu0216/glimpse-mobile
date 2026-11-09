import { useQuery } from '@tanstack/react-query';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { SAVED_KEY } from '../../api/noteCache';
import { fetchSaved } from '../../api/notes';
import type { Note } from '../../api/types';
import { NoteGrid } from '../../components/NoteGrid';
import { OfflineBanner } from '../../components/OfflineBanner';
import { FeedSkeleton } from '../../components/Skeleton';
import { StateView } from '../../components/StateView';
import { useTheme } from '../../theme/useTheme';

interface Props {
  onOpenNote: (note: Note) => void;
  onToggleLike: (note: Note) => void;
}

export function SavedScreen({ onOpenNote, onToggleLike }: Props) {
  const theme = useTheme();
  const { t } = useTranslation();
  const saved = useQuery({ queryKey: SAVED_KEY, queryFn: fetchSaved });

  let content;
  if (saved.isPending && saved.fetchStatus === 'paused') {
    content = (
      <StateView
        icon="cloud-offline-outline"
        title={t('offline.noCacheTitle')}
        body={t('offline.noCacheBody')}
      />
    );
  } else if (saved.isPending) {
    content = <FeedSkeleton />;
  } else if (saved.isError && !saved.data) {
    content = (
      <StateView
        icon="cloud-offline-outline"
        title={t('saved.errorTitle')}
        body={t('feed.errorBody')}
        actionLabel={t('feed.retry')}
        onAction={() => void saved.refetch()}
      />
    );
  } else {
    content = (
      <NoteGrid
        testID="saved-list"
        notes={saved.data ?? []}
        onOpenNote={onOpenNote}
        onToggleLike={onToggleLike}
        refreshing={saved.isRefetching}
        onRefresh={() => void saved.refetch()}
        ListEmptyComponent={
          <StateView
            testID="saved-empty"
            icon="bookmark-outline"
            title={t('saved.emptyTitle')}
            body={t('saved.emptyBody')}
          />
        }
      />
    );
  }
  return (
    <View style={[styles.fill, { backgroundColor: theme.background }]}>
      <OfflineBanner />
      {content}
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
});
