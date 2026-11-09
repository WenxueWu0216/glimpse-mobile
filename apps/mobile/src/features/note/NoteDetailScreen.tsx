import { Ionicons } from '@expo/vector-icons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
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
import { useNoteTranslation } from './useNoteTranslation';

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
  const translation = useNoteTranslation(note, i18n.language);

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

  // If translation fails the original text simply stays on screen.
  const shown = translation.translation ?? note;
  const translateLabel = translation.isTranslating
    ? t('note.translating')
    : translation.translation
      ? t('note.showOriginal')
      : translation.failed
        ? t('note.translateRetry')
        : t('note.translate');

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
            {shown.title}
          </Text>
          {shown.body ? (
            <Text style={[styles.body, { color: theme.text }]}>{shown.body}</Text>
          ) : null}
          {translation.available ? (
            <View style={styles.translateRow}>
              <Pressable
                testID="translate-button"
                onPress={translation.toggle}
                disabled={translation.isTranslating}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityState={{ busy: translation.isTranslating }}
                style={styles.translateButton}
              >
                {translation.isTranslating ? (
                  <ActivityIndicator size="small" color={theme.primary} />
                ) : (
                  <Ionicons name="language-outline" size={16} color={theme.primary} />
                )}
                <Text style={[styles.translateLabel, { color: theme.primary }]}>
                  {translateLabel}
                </Text>
              </Pressable>
              {translation.failed ? (
                <Text
                  style={[styles.translateError, { color: theme.textMuted }]}
                  accessibilityRole="alert"
                >
                  {t('note.translateFailed')}
                </Text>
              ) : null}
            </View>
          ) : null}
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
  translateRow: { gap: 4 },
  translateButton: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start' },
  translateLabel: { fontSize: 14, fontWeight: '600' },
  translateError: { fontSize: 13 },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 28,
    paddingHorizontal: 20,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
});
