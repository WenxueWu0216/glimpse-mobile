import { useEffect, useState } from 'react';
import { Animated, StyleSheet, View, type DimensionValue } from 'react-native';
import { useTranslation } from 'react-i18next';

import { useTheme } from '../theme/useTheme';

interface BlockProps {
  height: number;
  width?: DimensionValue;
  radius?: number;
}

/** A grey block that pulses while content loads. */
export function SkeletonBlock({ height, width = '100%', radius = 6 }: BlockProps) {
  const theme = useTheme();
  const [opacity] = useState(() => new Animated.Value(1));

  useEffect(() => {
    // useNativeDriver runs the animation on the UI thread, so it stays smooth
    // even while the JS thread is busy parsing the first page of the feed.
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.45, duration: 650, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 1, duration: 650, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);

  return (
    <Animated.View
      style={{ height, width, borderRadius: radius, backgroundColor: theme.skeleton, opacity }}
    />
  );
}

const COLUMN_HEIGHTS = [
  [210, 150, 240],
  [160, 230, 180],
] as const;

/** Placeholder with the same two-column shape as the real feed. */
export function FeedSkeleton() {
  const theme = useTheme();
  const { t } = useTranslation();
  return (
    <View style={styles.row} testID="feed-skeleton" accessibilityLabel={t('feed.loading')}>
      {COLUMN_HEIGHTS.map((heights, column) => (
        <View key={column} style={styles.column}>
          {heights.map((height, i) => (
            <View key={i} style={[styles.card, { backgroundColor: theme.card }]}>
              <SkeletonBlock height={height} radius={0} />
              <View style={styles.body}>
                <SkeletonBlock height={12} />
                <SkeletonBlock height={12} width="60%" />
              </View>
            </View>
          ))}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', padding: 4 },
  column: { flex: 1 },
  card: { margin: 4, borderRadius: 10, overflow: 'hidden' },
  body: { padding: 8, gap: 8 },
});
