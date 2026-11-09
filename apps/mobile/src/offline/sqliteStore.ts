import { openDatabaseAsync, type SQLiteDatabase } from 'expo-sqlite';

import type { Note } from '../api/types';
import type {
  ActionKind,
  CachedList,
  CachedTranslation,
  OfflineStore,
  PendingAction,
  QueuedAction,
} from './types';

const SCHEMA = `
PRAGMA journal_mode = WAL;
CREATE TABLE IF NOT EXISTS cached_notes (
  list TEXT NOT NULL,
  position INTEGER NOT NULL,
  json TEXT NOT NULL,
  PRIMARY KEY (list, position)
);
CREATE TABLE IF NOT EXISTS sync_queue (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  note_id INTEGER NOT NULL,
  kind TEXT NOT NULL,
  value INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS translations (
  note_id INTEGER NOT NULL,
  lang TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  PRIMARY KEY (note_id, lang)
);
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
`;

interface QueueRow {
  id: number;
  note_id: number;
  kind: ActionKind;
  value: number;
}

/**
 * SQLite-backed store (expo-sqlite). Notes are stored as JSON blobs: the app
 * always reads a whole list back, so separate columns would add migrations
 * without enabling any query we need.
 */
export class SqliteStore implements OfflineStore {
  private db: Promise<SQLiteDatabase> | null = null;

  constructor(private readonly name = 'glimpse.db') {}

  /** Opens the database once; every method awaits the same promise. */
  private open(): Promise<SQLiteDatabase> {
    this.db ??= openDatabaseAsync(this.name).then(async (db) => {
      await db.execAsync(SCHEMA);
      return db;
    });
    return this.db;
  }

  async getNotes(list: CachedList): Promise<Note[]> {
    const db = await this.open();
    const rows = await db.getAllAsync<{ json: string }>(
      'SELECT json FROM cached_notes WHERE list = ? ORDER BY position',
      [list],
    );
    return rows.map((row) => JSON.parse(row.json) as Note);
  }

  async setNotes(list: CachedList, notes: Note[]): Promise<void> {
    const db = await this.open();
    // One transaction: a crash mid-write must not leave half a list behind,
    // and a single commit is much faster than one fsync per row.
    await db.withTransactionAsync(async () => {
      await db.runAsync('DELETE FROM cached_notes WHERE list = ?', [list]);
      for (const [position, note] of notes.entries()) {
        await db.runAsync('INSERT INTO cached_notes (list, position, json) VALUES (?, ?, ?)', [
          list,
          position,
          JSON.stringify(note),
        ]);
      }
    });
  }

  async listQueue(): Promise<QueuedAction[]> {
    const db = await this.open();
    const rows = await db.getAllAsync<QueueRow>('SELECT * FROM sync_queue ORDER BY id');
    return rows.map((row) => ({
      id: row.id,
      noteId: row.note_id,
      kind: row.kind,
      value: row.value === 1,
    }));
  }

  async addToQueue(action: PendingAction): Promise<void> {
    const db = await this.open();
    await db.runAsync('INSERT INTO sync_queue (note_id, kind, value) VALUES (?, ?, ?)', [
      action.noteId,
      action.kind,
      action.value ? 1 : 0,
    ]);
  }

  async removeFromQueue(id: number): Promise<void> {
    const db = await this.open();
    await db.runAsync('DELETE FROM sync_queue WHERE id = ?', [id]);
  }

  async getTranslation(noteId: number, lang: string): Promise<CachedTranslation | null> {
    const db = await this.open();
    return db.getFirstAsync<CachedTranslation>(
      'SELECT title, body FROM translations WHERE note_id = ? AND lang = ?',
      [noteId, lang],
    );
  }

  async setTranslation(noteId: number, lang: string, value: CachedTranslation): Promise<void> {
    const db = await this.open();
    await db.runAsync(
      'INSERT OR REPLACE INTO translations (note_id, lang, title, body) VALUES (?, ?, ?, ?)',
      [noteId, lang, value.title, value.body],
    );
  }

  async getSetting(key: string): Promise<string | null> {
    const db = await this.open();
    const row = await db.getFirstAsync<{ value: string }>(
      'SELECT value FROM settings WHERE key = ?',
      [key],
    );
    return row?.value ?? null;
  }

  async setSetting(key: string, value: string): Promise<void> {
    const db = await this.open();
    await db.runAsync('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', [key, value]);
  }
}
