import { Ionicons } from '@expo/vector-icons';
import { memo } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { useTranslation } from 'react-i18next';

import { useTheme } from '../theme/useTheme';
import { formatCount } from '../utils/format';

interface Props {
  liked: boolean;
  count: number;
  onPress: () => void;
  size?: number;
  testID?: string;
}

export const LikeButton = memo(function LikeButton({
  liked,
  count,
  onPress,
  size = 16,
  testID,
}: Props) {
  const theme = useTheme();
  const { t } = useTranslation();
  return (
    <Pressable
      onPress={onPress}
      // hitSlop enlarges the touch target without changing the layout:
      // a 16pt icon is far below the ~44pt minimum for comfortable tapping.
      hitSlop={10}
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={liked ? t('note.unlike') : t('note.like')}
      accessibilityState={{ selected: liked }}
      accessibilityValue={{ text: t('note.likes', { count }) }}
      style={styles.row}
    >
      <Ionicons
        name={liked ? 'heart' : 'heart-outline'}
        size={size}
        color={liked ? theme.primary : theme.textMuted}
      />
      <Text style={[styles.count, { color: theme.textMuted, fontSize: size * 0.78 }]}>
        {formatCount(count)}
      </Text>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  count: { fontVariant: ['tabular-nums'] },
});
