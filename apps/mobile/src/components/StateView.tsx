import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useTheme } from '../theme/useTheme';

interface Props {
  icon: ComponentProps<typeof Ionicons>['name'];
  title: string;
  body?: string;
  actionLabel?: string;
  onAction?: () => void;
  testID?: string;
}

/** Shared layout for empty and error states. */
export function StateView({ icon, title, body, actionLabel, onAction, testID }: Props) {
  const theme = useTheme();
  return (
    <View style={styles.container} testID={testID}>
      <Ionicons name={icon} size={44} color={theme.textMuted} />
      <Text style={[styles.title, { color: theme.text }]}>{title}</Text>
      {body ? <Text style={[styles.body, { color: theme.textMuted }]}>{body}</Text> : null}
      {actionLabel && onAction ? (
        <Pressable
          onPress={onAction}
          accessibilityRole="button"
          style={[styles.button, { backgroundColor: theme.primary }]}
        >
          <Text style={[styles.buttonLabel, { color: theme.onPrimary }]}>{actionLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 8 },
  title: { fontSize: 17, fontWeight: '600', marginTop: 8, textAlign: 'center' },
  body: { fontSize: 14, textAlign: 'center' },
  button: { marginTop: 12, paddingHorizontal: 22, paddingVertical: 10, borderRadius: 20 },
  buttonLabel: { fontSize: 15, fontWeight: '600' },
});
