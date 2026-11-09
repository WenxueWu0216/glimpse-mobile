import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { useNetworkStore } from '../state/networkStore';
import { useTheme } from '../theme/useTheme';

/** Thin bar shown under the header while the device has no connection. */
export function OfflineBanner() {
  const theme = useTheme();
  const { t } = useTranslation();
  // Selecting single fields means this component re-renders only when one of
  // them changes, not on every store update.
  const isOnline = useNetworkStore((s) => s.isOnline);
  const pending = useNetworkStore((s) => s.pendingActions);

  if (isOnline) return null;
  return (
    <View
      testID="offline-banner"
      style={[styles.banner, { backgroundColor: theme.banner }]}
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
    >
      <Ionicons name="cloud-offline-outline" size={15} color={theme.onBanner} />
      <Text style={[styles.text, { color: theme.onBanner }]}>
        {pending > 0 ? t('offline.bannerPending', { count: pending }) : t('offline.banner')}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  text: { fontSize: 13, fontWeight: '500' },
});
