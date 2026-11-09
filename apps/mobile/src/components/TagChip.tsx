import { memo } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';

import { useTheme } from '../theme/useTheme';

interface Props {
  label: string;
  selected?: boolean;
  onPress?: (label: string) => void;
}

export const TagChip = memo(function TagChip({ label, selected = false, onPress }: Props) {
  const theme = useTheme();
  return (
    <Pressable
      disabled={!onPress}
      onPress={() => onPress?.(label)}
      accessibilityRole={onPress ? 'button' : 'text'}
      accessibilityState={onPress ? { selected } : undefined}
      style={[styles.chip, { backgroundColor: selected ? theme.primary : theme.chip }]}
    >
      <Text style={[styles.label, { color: selected ? theme.onPrimary : theme.textMuted }]}>
        #{label}
      </Text>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  chip: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 14 },
  label: { fontSize: 13 },
});
