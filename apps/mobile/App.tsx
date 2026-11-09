import { DarkTheme, DefaultTheme, NavigationContainer } from '@react-navigation/native';
import { QueryClientProvider } from '@tanstack/react-query';
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
import { useTheme } from './src/theme/useTheme';

export default function App() {
  const [queryClient] = useState(createQueryClient);
  const [ready, setReady] = useState(false);
  const theme = useTheme();

  useEffect(() => {
    const store = getOfflineStore();
    let cancelled = false;
    let cleanup = () => {};
    void hydrateQueryCache(queryClient, store)
      // A broken cache must never stop the app from starting.
      .catch(() => undefined)
      .then(() => {
        if (cancelled) return;
        const stopPersisting = persistQueryCache(queryClient, store);
        const stopNetwork = startNetworkSync(queryClient, getSyncQueue());
        cleanup = () => {
          stopPersisting();
          stopNetwork();
        };
        setReady(true);
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
