import { DarkTheme, DefaultTheme, NavigationContainer } from '@react-navigation/native';
import { QueryClientProvider } from '@tanstack/react-query';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo, useState } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { Toast } from './src/components/Toast';
import './src/i18n';
import { RootNavigator } from './src/navigation/RootNavigator';
import { startNetworkSync } from './src/offline/networkSync';
import { hydrateQueryCache, persistQueryCache } from './src/offline/persistence';
import { getOfflineStore, getSyncQueue } from './src/offline/runtime';
import { createQueryClient } from './src/queryClient';
import { connectSettings } from './src/state/settingsPersistence';
import { useTheme } from './src/theme/useTheme';

// Keep the native splash screen up until cached data and settings are loaded,
// so the first frame the user sees is real content in the right theme.
void SplashScreen.preventAutoHideAsync().catch(() => undefined);

export default function App() {
  const [queryClient] = useState(createQueryClient);
  const [ready, setReady] = useState(false);
  const theme = useTheme();

  useEffect(() => {
    const store = getOfflineStore();
    let cancelled = false;
    let cleanup = () => {};
    void Promise.all([
      // A broken cache must never stop the app from starting.
      hydrateQueryCache(queryClient, store).catch(() => undefined),
      connectSettings(store).catch(() => () => {}),
    ]).then(([, stopSettings]) => {
      if (cancelled) return stopSettings();
      const stopPersisting = persistQueryCache(queryClient, store);
      const stopNetwork = startNetworkSync(queryClient, getSyncQueue());
      cleanup = () => {
        stopSettings();
        stopPersisting();
        stopNetwork();
      };
      setReady(true);
      SplashScreen.hide();
    });
    return () => {
      cancelled = true;
      cleanup();
    };
  }, [queryClient]);

  const navigationTheme = useMemo(() => {
    const base = theme.dark ? DarkTheme : DefaultTheme;
    return {
      ...base,
      colors: {
        ...base.colors,
        primary: theme.primary,
        background: theme.background,
        card: theme.card,
        text: theme.text,
        border: theme.border,
      },
    };
  }, [theme]);

  if (!ready) return null;

  return (
    <QueryClientProvider client={queryClient}>
      <SafeAreaProvider>
        <NavigationContainer theme={navigationTheme}>
          <RootNavigator />
        </NavigationContainer>
        <Toast />
        <StatusBar style={theme.dark ? 'light' : 'dark'} />
      </SafeAreaProvider>
    </QueryClientProvider>
  );
}
