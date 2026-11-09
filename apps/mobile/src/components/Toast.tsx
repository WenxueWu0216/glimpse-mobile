import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useToastStore } from '../state/toastStore';
import { useTheme } from '../theme/useTheme';

const VISIBLE_MS = 2500;

export function Toast() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const message = useToastStore((s) => s.message);
  const hide = useToastStore((s) => s.hide);

  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(hide, VISIBLE_MS);
    return () => clearTimeout(timer);
  }, [message, hide]);

  if (!message) return null;
  return (
    <View pointerEvents="none" style={[styles.wrap, { bottom: insets.bottom + 72 }]}>
      <View
        style={[styles.toast, { backgroundColor: theme.banner }]}
        accessibilityRole="alert"
        accessibilityLiveRegion="polite"
      >
        <Text style={{ color: theme.onBanner, fontSize: 14 }}>{message}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
  toast: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20, maxWidth: '86%' },
});
