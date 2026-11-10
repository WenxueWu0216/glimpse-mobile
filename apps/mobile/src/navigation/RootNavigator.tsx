import { Ionicons } from '@expo/vector-icons';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useNavigation } from '@react-navigation/native';
import {
  createNativeStackNavigator,
  type NativeStackNavigationProp,
  type NativeStackScreenProps,
} from '@react-navigation/native-stack';
import { useCallback } from 'react';
import { Pressable } from 'react-native';
import { useTranslation } from 'react-i18next';

import type { Note } from '../api/types';
import { ComposerScreen } from '../features/composer/ComposerScreen';
import { FeedScreen } from '../features/feed/FeedScreen';
import { NoteDetailScreen } from '../features/note/NoteDetailScreen';
import { useNoteActions } from '../features/note/useNoteActions';
import { SavedScreen } from '../features/saved/SavedScreen';
import { SettingsScreen } from '../features/settings/SettingsScreen';
import { useTheme } from '../theme/useTheme';
import type { RootStackParamList, TabParamList } from './types';

// Native stack uses the platform's own navigation controllers
// (UINavigationController / Fragments), so transitions and the back gesture
// run natively instead of being animated from JavaScript.
const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<TabParamList>();

type RootNavigation = NativeStackNavigationProp<RootStackParamList>;

/** Screens get plain callbacks; only these thin wrappers know about navigation. */
function useOpenNote() {
  const navigation = useNavigation<RootNavigation>();
  return useCallback(
    (note: Note) => navigation.navigate('NoteDetail', { noteId: note.id }),
    [navigation],
  );
}

function FeedRoute() {
  const openNote = useOpenNote();
  const { toggleLike } = useNoteActions();
  return <FeedScreen onOpenNote={openNote} onToggleLike={toggleLike} />;
}

function SavedRoute() {
  const openNote = useOpenNote();
  const { toggleLike } = useNoteActions();
  return <SavedScreen onOpenNote={openNote} onToggleLike={toggleLike} />;
}

function NoteDetailRoute({ route }: NativeStackScreenProps<RootStackParamList, 'NoteDetail'>) {
  return <NoteDetailScreen noteId={route.params.noteId} />;
}

function ComposerRoute({ navigation }: NativeStackScreenProps<RootStackParamList, 'Composer'>) {
  return <ComposerScreen onPublished={() => navigation.goBack()} />;
}

function ComposeButton() {
  const navigation = useNavigation<RootNavigation>();
  const theme = useTheme();
  const { t } = useTranslation();
  return (
    <Pressable
      testID="compose-button"
      onPress={() => navigation.navigate('Composer')}
      hitSlop={10}
      accessibilityRole="button"
      accessibilityLabel={t('composer.open')}
      style={{ paddingHorizontal: 14 }}
    >
      <Ionicons name="add-circle" size={28} color={theme.primary} />
    </Pressable>
  );
}

function Tabs() {
  const { t } = useTranslation();
  return (
    <Tab.Navigator>
      <Tab.Screen
        name="Feed"
        component={FeedRoute}
        options={{
          title: t('tabs.feed'),
          headerTitle: t('feed.title'),
          headerRight: ComposeButton,
          tabBarButtonTestID: 'tab-feed',
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons name={focused ? 'compass' : 'compass-outline'} size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Saved"
        component={SavedRoute}
        options={{
          title: t('tabs.saved'),
          tabBarButtonTestID: 'tab-saved',
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons name={focused ? 'bookmark' : 'bookmark-outline'} size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Settings"
        component={SettingsScreen}
        options={{
          title: t('tabs.settings'),
          tabBarButtonTestID: 'tab-settings',
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons name={focused ? 'settings' : 'settings-outline'} size={size} color={color} />
          ),
        }}
      />
    </Tab.Navigator>
  );
}

export function RootNavigator() {
  const { t } = useTranslation();
  return (
    <Stack.Navigator screenOptions={{ headerBackButtonDisplayMode: 'minimal' }}>
      <Stack.Screen name="Tabs" component={Tabs} options={{ headerShown: false }} />
      <Stack.Screen name="NoteDetail" component={NoteDetailRoute} options={{ title: '' }} />
      <Stack.Screen
        name="Composer"
        component={ComposerRoute}
        options={{ title: t('composer.title'), presentation: 'modal' }}
      />
    </Stack.Navigator>
  );
}
