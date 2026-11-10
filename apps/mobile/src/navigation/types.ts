import type { NavigatorScreenParams } from '@react-navigation/native';

export type TabParamList = {
  Feed: undefined;
  Saved: undefined;
  Settings: undefined;
};

export type RootStackParamList = {
  Tabs: NavigatorScreenParams<TabParamList> | undefined;
  NoteDetail: { noteId: number };
  Composer: undefined;
};
