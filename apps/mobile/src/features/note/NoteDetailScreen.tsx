import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { FEED_KEY, findCachedNote, noteKey } from '../../api/noteCache';
import { fetchNote } from '../../api/notes';
import { Avatar } from '../../components/Avatar';
import { LikeButton } from '../../components/LikeButton';
import { SaveButton } from '../../components/SaveButton';
import { SkeletonBlock } from '../../components/Skeleton';
import { StateView } from '../../components/StateView';
import { TagChip } from '../../components/TagChip';
import { useTheme } from '../../theme/useTheme';
import { ImageCarousel } from './ImageCarousel';
import { useNoteActions } from './useNoteActions';

interface Props {
  noteId: number;
}

export function NoteDetailScreen({ noteId }: Props) {
  const theme = useTheme();
  const { t, i18n } = useTranslation();
  const insets = useSafeAreaInsets();
  const client = useQueryClient();
  const { toggleLike, toggleSave } = useNoteActions();

  const query = useQuery({
    queryKey: noteKey(noteId),
    queryFn: () => fetchNote(noteId),
    // Opening a note from the feed renders instantly from the copy already in
    // the feed cache. initialDataUpdatedAt tells React Query how old that copy
    // is, so it only refetches once the data is actually stale.
    initialData: () => findCachedNote(client, noteId),
    initialDataUpdatedAt: () => client.getQueryState(FEED_KEY)?.dataUpdatedAt,
  });
  const note = query.data;

  if (!note) {
    return (
      <View style={[styles.fill, { backgroundColor: theme.background }]}>
        {query.isError ? (
          <StateView
            icon="alert-circle-outline"
            title={t('note.errorTitle')}
            body={t('feed.errorBody')}
            actionLabel={t('feed.retry')}
            onAction={() => void query.refetch()}
          />
        ) : (
          <View style={styles.loading} testID="note-skeleton">
            <SkeletonBlock height={320} radius={0} />
            <View style={styles.content}>
              <SkeletonBlock height={22} width="70%" />
              <SkeletonBlock height={14} />
              <SkeletonBlock height={14} width="85%" />
            </View>
          </View>
        )}
      </View>
    );
  }

  const date = new Date(note.created_at).toLocaleDateString(i18n.language, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });

  return (
    <View style={[styles.fill, { backgroundColor: theme.card }]}>
      <ScrollView testID="note-detail" contentContainerStyle={styles.scroll}>
        <ImageCarousel images={note.images} />
        <View style={styles.content}>
          <View style={styles.author}>
            <Avatar name={note.author.name} uri={note.author.avatar_url} size={32} />
            <Text style={[styles.authorName, { color: theme.text }]}>{note.author.name}</Text>
          </View>
          <Text style={[styles.title, { color: theme.text }]} accessibilityRole="header">
            {note.title}
          </Text>
          {note.body ? <Text style={[styles.body, { color: theme.text }]}>{note.body}</Text> : null}
          {note.tags.length > 0 ? (
            <View style={styles.tags}>
              {note.tags.map((tag) => (
                <TagChip key={tag} label={tag} />
              ))}
            </View>
          ) : null}
          <Text style={[styles.date, { color: theme.textMuted }]}>{date}</Text>
        </View>
      </ScrollView>
      <View
        style={[
          styles.actions,
          {
            borderTopColor: theme.border,
            backgroundColor: theme.card,
            paddingBottom: Math.max(insets.bottom, 12),
          },
        ]}
      >
        <LikeButton
          testID="detail-like-button"
          liked={note.liked}
          count={note.like_count}
          size={24}
          onPress={() => toggleLike(note)}
        />
        <SaveButton
          testID="detail-save-button"
          saved={note.saved}
          count={note.save_count}
          size={24}
          onPress={() => toggleSave(note)}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  loading: { flex: 1 },
  scroll: { paddingBottom: 24 },
  content: { padding: 16, gap: 12 },
  author: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  authorName: { fontSize: 15, fontWeight: '600' },
  title: { fontSize: 20, fontWeight: '700', lineHeight: 26 },
  body: { fontSize: 16, lineHeight: 24 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  date: { fontSize: 13 },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 28,
    paddingHorizontal: 20,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
});
