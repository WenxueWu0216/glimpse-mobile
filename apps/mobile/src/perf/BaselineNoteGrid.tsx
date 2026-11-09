/**
 * BENCHMARK BASELINE – not used by the app.
 *
 * The straightforward way to build the feed, kept so the optimised version
 * (components/NoteGrid.tsx) can be measured against it:
 *   - ScrollView: every loaded note stays mounted (no virtualisation/recycling)
 *   - cards are not memoised and receive new inline callbacks on every render
 *   - react-native Image: no disk cache, no recycling key
 *
 * Enable with EXPO_PUBLIC_FEED_IMPL=baseline (see docs/PERFORMANCE.md).
 */
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { ComponentProps } from 'react';

import type { Note } from '../api/types';
import { Avatar } from '../components/Avatar';
import { LikeButton } from '../components/LikeButton';
import { coverAspectRatio } from '../components/NoteCard';
import type { NoteGrid } from '../components/NoteGrid';
import { useTheme } from '../theme/useTheme';

function BaselineNoteCard({
  note,
  onPress,
  onToggleLike,
}: {
  note: Note;
  onPress: () => void;
  onToggleLike: () => void;
}) {
  const theme = useTheme();
  const cover = note.images[0];
  return (
    <Pressable
      onPress={onPress}
      testID={`note-card-${note.id}`}
      style={[styles.card, { backgroundColor: theme.card }]}
    >
      {cover ? (
        <Image
          source={{ uri: cover.url }}
          style={{
            aspectRatio: coverAspectRatio(cover.width, cover.height),
            backgroundColor: cover.color,
          }}
        />
      ) : null}
      <View style={styles.body}>
        <Text numberOfLines={2} style={[styles.title, { color: theme.text }]}>
          {note.title}
        </Text>
        <View style={styles.footer}>
          <View style={styles.author}>
            <Avatar name={note.author.name} uri={note.author.avatar_url} size={18} />
            <Text numberOfLines={1} style={[styles.authorName, { color: theme.textMuted }]}>
              {note.author.name}
            </Text>
          </View>
          <LikeButton
            liked={note.liked}
            count={note.like_count}
            onPress={onToggleLike}
            testID={`like-button-${note.id}`}
          />
        </View>
      </View>
    </Pressable>
  );
}

export function BaselineNoteGrid({
  notes,
  onOpenNote,
  onToggleLike,
  onEndReached,
  ListEmptyComponent,
  ListFooterComponent,
  testID,
}: ComponentProps<typeof NoteGrid>) {
  if (notes.length === 0) return ListEmptyComponent ?? null;
  const columns: [Note[], Note[]] = [[], []];
  notes.forEach((note, i) => columns[i % 2 === 0 ? 0 : 1].push(note));
  return (
    <ScrollView
      testID={testID}
      contentContainerStyle={styles.content}
      scrollEventThrottle={100}
      onScroll={({ nativeEvent: e }) => {
        const remaining = e.contentSize.height - e.contentOffset.y - e.layoutMeasurement.height;
        if (remaining < e.layoutMeasurement.height * 0.6) onEndReached?.();
      }}
    >
      <View style={styles.row}>
        {columns.map((column, i) => (
          <View key={i} style={styles.column}>
            {column.map((note) => (
              <BaselineNoteCard
                key={note.id}
                note={note}
                onPress={() => onOpenNote(note)}
                onToggleLike={() => onToggleLike(note)}
              />
            ))}
          </View>
        ))}
      </View>
      {ListFooterComponent}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 4 },
  row: { flexDirection: 'row' },
  column: { flex: 1 },
  card: { margin: 4, borderRadius: 10, overflow: 'hidden' },
  body: { padding: 8, gap: 8 },
  title: { fontSize: 14, fontWeight: '600', lineHeight: 19 },
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 6 },
  author: { flexDirection: 'row', alignItems: 'center', gap: 5, flex: 1 },
  authorName: { fontSize: 12, flexShrink: 1 },
});
