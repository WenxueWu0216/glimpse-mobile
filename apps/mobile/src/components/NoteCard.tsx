import { Image } from 'expo-image';
import { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { Note } from '../api/types';
import { useTheme } from '../theme/useTheme';
import { Avatar } from './Avatar';
import { LikeButton } from './LikeButton';

interface Props {
  note: Note;
  onPress: (note: Note) => void;
  onToggleLike: (note: Note) => void;
}

/** Keeps very tall or very wide photos from producing extreme card heights. */
export function coverAspectRatio(width: number, height: number): number {
  if (width <= 0 || height <= 0) return 1;
  return Math.min(Math.max(width / height, 0.6), 1.5);
}

function NoteCardBase({ note, onPress, onToggleLike }: Props) {
  const theme = useTheme();
  const cover = note.images[0];
  return (
    <Pressable
      onPress={() => onPress(note)}
      testID={`note-card-${note.id}`}
      accessibilityRole="button"
      accessibilityLabel={note.title}
      style={[styles.card, { backgroundColor: theme.card }]}
    >
      {cover ? (
        <Image
          source={cover.url}
          // The server sends pixel dimensions, so the card reserves the right
          // height before the image downloads and the layout never jumps.
          style={{
            aspectRatio: coverAspectRatio(cover.width, cover.height),
            backgroundColor: cover.color,
          }}
          contentFit="cover"
          transition={150}
          cachePolicy="memory-disk"
          // FlashList reuses cell views; recyclingKey stops a recycled cell
          // from briefly showing the previous note's photo.
          recyclingKey={String(note.id)}
          accessibilityIgnoresInvertColors
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
            onPress={() => onToggleLike(note)}
            testID={`like-button-${note.id}`}
          />
        </View>
      </View>
    </Pressable>
  );
}

/**
 * memo() skips re-rendering a card whose props are unchanged. It only works
 * because the feed passes stable callbacks and React Query keeps the object
 * identity of notes that did not change (structural sharing).
 */
export const NoteCard = memo(NoteCardBase);

const styles = StyleSheet.create({
  card: { margin: 4, borderRadius: 10, overflow: 'hidden' },
  body: { padding: 8, gap: 8 },
  title: { fontSize: 14, fontWeight: '600', lineHeight: 19 },
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 6 },
  author: { flexDirection: 'row', alignItems: 'center', gap: 5, flex: 1 },
  authorName: { fontSize: 12, flexShrink: 1 },
});
