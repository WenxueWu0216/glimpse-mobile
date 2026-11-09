import { ApiError } from '../api/client';
import type { LikeState, SaveState } from '../api/types';
import type { OfflineStore, PendingAction, QueuedAction } from './types';

export interface SyncApi {
  setLike(noteId: number, liked: boolean): Promise<LikeState>;
  setSave(noteId: number, saved: boolean): Promise<SaveState>;
}

export interface SyncListener {
  /** The server accepted the action; `state` is its authoritative answer. */
  onSynced?(action: QueuedAction, state: LikeState | SaveState): void;
  /** The server refused the action for good (e.g. the note was deleted). */
  onDropped?(action: QueuedAction): void;
  onPendingChange?(pending: number): void;
}

export interface FlushResult {
  synced: number;
  dropped: number;
  remaining: number;
}

/**
 * Durable queue of likes/saves made while offline.
 *
 * - enqueue() coalesces: one entry per (note, kind). Liking then unliking a
 *   note offline cancels out and sends nothing.
 * - flush() replays entries oldest-first. The API calls are idempotent
 *   (PUT/DELETE of an end state), so replaying after a lost response is safe.
 * - A network failure or 5xx stops the flush and keeps the entry for later;
 *   a 4xx can never succeed, so the entry is dropped and the UI rolled back.
 */
export class SyncQueue {
  private listener: SyncListener = {};
  private flushing: Promise<FlushResult> | null = null;
  /** Id of the entry whose request is currently on the wire. */
  private inFlightId: number | null = null;
  /** Serialises store access so two quick taps cannot interleave. */
  private chain: Promise<unknown> = Promise.resolve();

  constructor(
    private readonly store: OfflineStore,
    private readonly api: SyncApi,
  ) {}

  setListener(listener: SyncListener): void {
    this.listener = listener;
  }

  private exclusive<T>(task: () => Promise<T>): Promise<T> {
    const run = this.chain.then(task, task);
    this.chain = run.catch(() => undefined);
    return run;
  }

  async pendingCount(): Promise<number> {
    return (await this.store.listQueue()).length;
  }

  async has(noteId: number, kind: PendingAction['kind']): Promise<boolean> {
    const queue = await this.store.listQueue();
    return queue.some((item) => item.noteId === noteId && item.kind === kind);
  }

  enqueue(action: PendingAction): Promise<void> {
    return this.exclusive(async () => {
      const queue = await this.store.listQueue();
      const existing = queue.find(
        (item) => item.noteId === action.noteId && item.kind === action.kind,
      );
      if (existing && existing.id === this.inFlightId) {
        // Too late to cancel: that request is already being sent. Queue the
        // new end state behind it so the server finishes in the right state.
        if (existing.value === action.value) return;
        await this.store.addToQueue(action);
      } else if (existing) {
        // Same end state already queued: nothing to add.
        if (existing.value === action.value) return;
        // Opposite of a queued action: the two cancel each other out.
        await this.store.removeFromQueue(existing.id);
      } else {
        await this.store.addToQueue(action);
      }
      await this.notifyPending();
    });
  }

  /** Concurrent callers share one flush instead of sending everything twice. */
  flush(): Promise<FlushResult> {
    this.flushing ??= this.runFlush().finally(() => {
      this.flushing = null;
    });
    return this.flushing;
  }

  private async runFlush(): Promise<FlushResult> {
    let synced = 0;
    let dropped = 0;
    for (;;) {
      // Re-read each round: enqueue() may have cancelled an entry meanwhile.
      const next = (await this.store.listQueue())[0];
      if (!next) break;
      this.inFlightId = next.id;
      try {
        const state =
          next.kind === 'like'
            ? await this.api.setLike(next.noteId, next.value)
            : await this.api.setSave(next.noteId, next.value);
        await this.exclusive(() => this.store.removeFromQueue(next.id));
        synced += 1;
        this.listener.onSynced?.(next, state);
      } catch (error) {
        if (error instanceof ApiError && error.status >= 400 && error.status < 500) {
          await this.exclusive(() => this.store.removeFromQueue(next.id));
          dropped += 1;
          this.listener.onDropped?.(next);
        } else {
          // Still offline or the server is unhealthy: try again later, and
          // keep the order by not skipping ahead.
          break;
        }
      } finally {
        this.inFlightId = null;
      }
    }
    const remaining = await this.notifyPending();
    return { synced, dropped, remaining };
  }

  private async notifyPending(): Promise<number> {
    const pending = await this.pendingCount();
    this.listener.onPendingChange?.(pending);
    return pending;
  }
}
