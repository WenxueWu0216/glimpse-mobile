import { Ionicons } from '@expo/vector-icons';
import { memo } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { useTranslation } from 'react-i18next';

import { useTheme } from '../theme/useTheme';
import { formatCount } from '../utils/format';

interface Props {
  saved: boolean;
  count: number;
  onPress: () => void;
  size?: number;
  testID?: string;
}

export const SaveButton = memo(function SaveButton({
  saved,
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
      hitSlop={10}
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={saved ? t('note.unsave') : t('note.save')}
      accessibilityState={{ selected: saved }}
      style={styles.row}
    >
      <Ionicons
        name={saved ? 'bookmark' : 'bookmark-outline'}
        size={size}
        color={saved ? theme.primary : theme.textMuted}
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
