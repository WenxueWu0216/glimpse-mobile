import { create } from 'zustand';

export type ThemeMode = 'system' | 'light' | 'dark';
export type Language = 'en' | 'zh';

interface SettingsState {
  themeMode: ThemeMode;
  language: Language;
  setThemeMode: (mode: ThemeMode) => void;
  setLanguage: (language: Language) => void;
}

/**
 * Zustand holds *client* state (preferences, connectivity). Anything that comes
 * from the server lives in React Query instead, so there is one source of truth
 * for each kind of data.
 */
export const useSettingsStore = create<SettingsState>((set) => ({
  themeMode: 'system',
  language: 'en',
  setThemeMode: (themeMode) => set({ themeMode }),
  setLanguage: (language) => set({ language }),
}));
