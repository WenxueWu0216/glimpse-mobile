import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';

import { FeedScreen } from '../features/feed/FeedScreen';
import type { RootStackParamList } from './types';

const Stack = createNativeStackNavigator<RootStackParamList>();

function FeedRoute() {
  const noop = useCallback(() => {}, []);
  return <FeedScreen onOpenNote={noop} onToggleLike={noop} />;
}

export function RootNavigator() {
  const { t } = useTranslation();
  return (
    <Stack.Navigator>
      <Stack.Screen name="Feed" component={FeedRoute} options={{ title: t('feed.title') }} />
    </Stack.Navigator>
  );
}
