import { Image } from 'expo-image';
import { memo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useTheme } from '../theme/useTheme';

interface Props {
  name: string;
  uri?: string | null;
  size?: number;
}

/** Round profile picture; falls back to the first letter of the name. */
export const Avatar = memo(function Avatar({ name, uri, size = 20 }: Props) {
  const theme = useTheme();
  const shape = { width: size, height: size, borderRadius: size / 2 };
  if (uri) {
    return (
      <Image
        source={uri}
        style={[shape, { backgroundColor: theme.skeleton }]}
        cachePolicy="memory-disk"
        accessibilityIgnoresInvertColors
      />
    );
  }
  return (
    <View style={[styles.fallback, shape, { backgroundColor: theme.chip }]}>
      <Text style={{ color: theme.textMuted, fontSize: size * 0.5, fontWeight: '600' }}>
        {name.trim().charAt(0).toUpperCase() || '?'}
      </Text>
    </View>
  );
});

const styles = StyleSheet.create({
  fallback: { alignItems: 'center', justifyContent: 'center' },
});
