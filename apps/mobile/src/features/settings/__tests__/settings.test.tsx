import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import i18n from '../../../i18n';
import { MemoryStore } from '../../../offline/memoryStore';
import { connectSettings } from '../../../state/settingsPersistence';
import { useSettingsStore } from '../../../state/settingsStore';
import { en } from '../../../i18n/en';
import { zh } from '../../../i18n/zh';
import { SettingsScreen } from '../SettingsScreen';

describe('settings', () => {
  let stop = () => {};
  let store: MemoryStore;

  beforeEach(async () => {
    store = new MemoryStore();
    await store.setSetting('language', 'en');
    stop = await connectSettings(store);
  });
  afterEach(async () => {
    stop();

    await i18n.changeLanguage('en');
    useSettingsStore.setState({ language: 'en', themeMode: 'system' });
  });

  it('switches the UI to Chinese and remembers the choice', async () => {
    await render(<SettingsScreen />);
    expect(screen.getByText('Language')).toBeOnTheScreen();

    await fireEvent.press(screen.getByTestId('language-zh'));

    expect(await screen.findByText('语言')).toBeOnTheScreen();
    expect(screen.getByText('外观')).toBeOnTheScreen();
    expect(screen.getByTestId('language-zh')).toBeChecked();
    await waitFor(async () => expect(await store.getSetting('language')).toBe('zh'));
  });

  it('remembers the chosen appearance', async () => {
    await render(<SettingsScreen />);

    await fireEvent.press(screen.getByTestId('theme-dark'));

    expect(screen.getByTestId('theme-dark')).toBeChecked();
    expect(screen.getByTestId('theme-system')).not.toBeChecked();
    await waitFor(async () => expect(await store.getSetting('themeMode')).toBe('dark'));
  });

  it('restores saved preferences on the next launch', async () => {
    stop();
    await store.setSetting('language', 'zh');
    await store.setSetting('themeMode', 'dark');

    stop = await connectSettings(store);

    expect(useSettingsStore.getState()).toMatchObject({ language: 'zh', themeMode: 'dark' });
    expect(i18n.language).toBe('zh');
  });

  it('ignores corrupted stored values', async () => {
    stop();
    await store.setSetting('themeMode', 'neon');
    stop = await connectSettings(store);

    expect(useSettingsStore.getState().themeMode).toBe('system');
  });
});

describe('translations', () => {
  const keys = (value: object, prefix = ''): string[] =>
    Object.entries(value).flatMap(([key, child]) =>
      typeof child === 'object' ? keys(child as object, `${prefix}${key}.`) : [`${prefix}${key}`],
    );

  it('English and Chinese define exactly the same keys', () => {
    expect(keys(zh).sort()).toEqual(keys(en).sort());
  });

  it('has no empty strings', () => {
    const values = (value: object): string[] =>
      Object.values(value).flatMap((child) =>
        typeof child === 'object' ? values(child as object) : [String(child)],
      );
    expect([...values(en), ...values(zh)].filter((text) => text.trim() === '')).toEqual([]);
  });
});
