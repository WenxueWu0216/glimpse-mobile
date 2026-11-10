import { Ionicons } from '@expo/vector-icons';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { useSettingsStore, type Language, type ThemeMode } from '../../state/settingsStore';
import { useTheme } from '../../theme/useTheme';

const LANGUAGES: { value: Language; label: string }[] = [
  // Language names are shown in their own language so they are always readable.
  { value: 'en', label: 'English' },
  { value: 'zh', label: '简体中文' },
];
const THEME_MODES: ThemeMode[] = ['system', 'light', 'dark'];

function OptionRow({
  label,
  selected,
  onPress,
  testID,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  testID: string;
}) {
  const theme = useTheme();
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      style={[styles.row, { borderBottomColor: theme.border }]}
    >
      <Text style={[styles.rowLabel, { color: theme.text }]}>{label}</Text>
      {selected ? <Ionicons name="checkmark" size={20} color={theme.primary} /> : null}
    </Pressable>
  );
}

export function SettingsScreen() {
  const theme = useTheme();
  const { t } = useTranslation();
  const language = useSettingsStore((s) => s.language);
  const themeMode = useSettingsStore((s) => s.themeMode);
  const setLanguage = useSettingsStore((s) => s.setLanguage);
  const setThemeMode = useSettingsStore((s) => s.setThemeMode);

  return (
    <ScrollView
      style={{ backgroundColor: theme.background }}
      contentContainerStyle={styles.content}
      testID="settings-screen"
    >
      <Text style={[styles.heading, { color: theme.textMuted }]} accessibilityRole="header">
        {t('settings.language')}
      </Text>
      <View style={[styles.group, { backgroundColor: theme.card }]} accessibilityRole="radiogroup">
        {LANGUAGES.map((option) => (
          <OptionRow
            key={option.value}
            testID={`language-${option.value}`}
            label={option.label}
            selected={language === option.value}
            onPress={() => setLanguage(option.value)}
          />
        ))}
      </View>

      <Text style={[styles.heading, { color: theme.textMuted }]} accessibilityRole="header">
        {t('settings.appearance')}
      </Text>
      <View style={[styles.group, { backgroundColor: theme.card }]} accessibilityRole="radiogroup">
        {THEME_MODES.map((mode) => (
          <OptionRow
            key={mode}
            testID={`theme-${mode}`}
            label={t(`settings.theme.${mode}`)}
            selected={themeMode === mode}
            onPress={() => setThemeMode(mode)}
          />
        ))}
      </View>

      <Text style={[styles.note, { color: theme.textMuted }]}>{t('settings.translateNote')}</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, gap: 8 },
  heading: { fontSize: 13, fontWeight: '600', marginTop: 12, marginLeft: 4 },
  group: { borderRadius: 12, overflow: 'hidden' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    minHeight: 48,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  rowLabel: { fontSize: 16 },
  note: { fontSize: 13, lineHeight: 18, marginTop: 12, marginHorizontal: 4 },
});
