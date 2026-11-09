import { Image } from 'expo-image';
import { useCallback, useState } from 'react';
import {
  FlatList,
  StyleSheet,
  useWindowDimensions,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { useTranslation } from 'react-i18next';

import type { NoteImage } from '../../api/types';
import { useTheme } from '../../theme/useTheme';

interface Props {
  images: NoteImage[];
}

/** Swipeable full-width photos with page dots. */
export function ImageCarousel({ images }: Props) {
  const theme = useTheme();
  const { t } = useTranslation();
  // useWindowDimensions re-renders on rotation / split-screen, unlike
  // Dimensions.get() which is read once.
  const { width } = useWindowDimensions();
  const [index, setIndex] = useState(0);

  // All pages share one height, taken from the first photo and clamped.
  const first = images[0];
  const ratio = first ? Math.min(Math.max(first.width / first.height, 0.75), 1.6) : 1;
  const height = Math.round(width / ratio);

  const onScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const next = Math.round(event.nativeEvent.contentOffset.x / width);
      // Passing the same value bails out of the re-render, so setting state
      // from a scroll handler is cheap here.
      setIndex(next);
    },
    [width],
  );

  return (
    <View>
      <FlatList
        testID="note-carousel"
        data={images}
        keyExtractor={(image) => image.url}
        horizontal
        // pagingEnabled snaps the scroll position to multiples of the list width.
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={32}
        getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
        renderItem={({ item, index: i }) => (
          <Image
            source={item.url}
            style={{ width, height, backgroundColor: item.color }}
            contentFit="cover"
            cachePolicy="memory-disk"
            accessibilityLabel={t('note.photoOf', { index: i + 1, total: images.length })}
          />
        )}
      />
      {images.length > 1 ? (
        <View style={styles.dots}>
          {images.map((image, i) => (
            <View
              key={image.url}
              style={[styles.dot, { backgroundColor: i === index ? theme.primary : theme.border }]}
            />
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 6, paddingTop: 10 },
  dot: { width: 6, height: 6, borderRadius: 3 },
});
