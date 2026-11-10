import i18n, { deviceLanguage } from '../i18n';
import type { OfflineStore } from '../offline/types';
import { useSettingsStore, type Language, type ThemeMode } from './settingsStore';

const THEME_KEY = 'themeMode';
const LANGUAGE_KEY = 'language';

const isThemeMode = (value: string | null): value is ThemeMode =>
  value === 'system' || value === 'light' || value === 'dark';
const isLanguage = (value: string | null): value is Language => value === 'en' || value === 'zh';

/**
 * Restore saved preferences at startup, then write every later change back.
 * A first launch (nothing saved) follows the device language.
 * Returns an unsubscribe function.
 */
export async function connectSettings(store: OfflineStore): Promise<() => void> {
  const [theme, language] = await Promise.all([
    store.getSetting(THEME_KEY).catch(() => null),
    store.getSetting(LANGUAGE_KEY).catch(() => null),
  ]);
  useSettingsStore.setState({
    themeMode: isThemeMode(theme) ? theme : 'system',
    language: isLanguage(language) ? language : deviceLanguage(),
  });

  await i18n.changeLanguage(useSettingsStore.getState().language);

  return useSettingsStore.subscribe((state, previous) => {
    if (state.language !== previous.language) {
      void i18n.changeLanguage(state.language);
      void store.setSetting(LANGUAGE_KEY, state.language).catch(() => undefined);
    }
    if (state.themeMode !== previous.themeMode) {
      void store.setSetting(THEME_KEY, state.themeMode).catch(() => undefined);
    }
  });
}
