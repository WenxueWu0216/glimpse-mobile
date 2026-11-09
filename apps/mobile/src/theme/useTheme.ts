import { useColorScheme } from 'react-native';

import { useSettingsStore } from '../state/settingsStore';
import { darkTheme, lightTheme, type Theme } from './colors';

/** Resolves the active palette: an explicit user choice wins over the OS setting. */
export function useTheme(): Theme {
  const system = useColorScheme();
  const mode = useSettingsStore((s) => s.themeMode);
  const scheme = mode === 'system' ? system : mode;
  return scheme === 'dark' ? darkTheme : lightTheme;
}
