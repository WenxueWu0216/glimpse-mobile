import type { Note } from '../api/types';

export type ActionKind = 'like' | 'save';
export type CachedList = 'feed' | 'saved';

/** "Make note N liked/saved = value". Describes an end state, not a toggle. */
export interface PendingAction {
  noteId: number;
  kind: ActionKind;
  value: boolean;
}

export interface QueuedAction extends PendingAction {
  id: number;
}

export interface CachedTranslation {
  title: string;
  body: string;
}

/**
 * Everything the app persists on the device. The app only talks to this
 * interface: SQLite implements it on iOS/Android, and an in-memory version
 * backs the web build and unit tests.
 */
export interface OfflineStore {
  getNotes(list: CachedList): Promise<Note[]>;
  setNotes(list: CachedList, notes: Note[]): Promise<void>;

  listQueue(): Promise<QueuedAction[]>;
  addToQueue(action: PendingAction): Promise<void>;
  removeFromQueue(id: number): Promise<void>;

  getTranslation(noteId: number, lang: string): Promise<CachedTranslation | null>;
  setTranslation(noteId: number, lang: string, value: CachedTranslation): Promise<void>;

  getSetting(key: string): Promise<string | null>;
  setSetting(key: string, value: string): Promise<void>;
}
