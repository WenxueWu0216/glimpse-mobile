import type { Note } from '../api/types';
import type {
  CachedList,
  CachedTranslation,
  OfflineStore,
  PendingAction,
  QueuedAction,
} from './types';

/** Non-persistent store used on web and in tests. */
export class MemoryStore implements OfflineStore {
  private notes: Record<CachedList, Note[]> = { feed: [], saved: [] };
  private queue: QueuedAction[] = [];
  private nextId = 1;
  private translations = new Map<string, CachedTranslation>();
  private settings = new Map<string, string>();

  async getNotes(list: CachedList) {
    return this.notes[list];
  }

  async setNotes(list: CachedList, notes: Note[]) {
    this.notes[list] = notes;
  }

  async listQueue() {
    return [...this.queue];
  }

  async addToQueue(action: PendingAction) {
    this.queue.push({ ...action, id: this.nextId++ });
  }

  async removeFromQueue(id: number) {
    this.queue = this.queue.filter((item) => item.id !== id);
  }

  async getTranslation(noteId: number, lang: string) {
    return this.translations.get(`${noteId}:${lang}`) ?? null;
  }

  async setTranslation(noteId: number, lang: string, value: CachedTranslation) {
    this.translations.set(`${noteId}:${lang}`, value);
  }

  async getSetting(key: string) {
    return this.settings.get(key) ?? null;
  }

  async setSetting(key: string, value: string) {
    this.settings.set(key, value);
  }
}
