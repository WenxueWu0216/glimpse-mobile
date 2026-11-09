import { request } from './client';
import type { LikeState, Note, NoteDraft, NotePage, SaveState } from './types';

export const PAGE_SIZE = 20;
const UPLOAD_TIMEOUT_MS = 60_000;

export function fetchNotes(cursor: string | null): Promise<NotePage> {
  const query = cursor
    ? `?limit=${PAGE_SIZE}&cursor=${encodeURIComponent(cursor)}`
    : `?limit=${PAGE_SIZE}`;
  return request<NotePage>(`/notes${query}`);
}

export function fetchNote(id: number): Promise<Note> {
  return request<Note>(`/notes/${id}`);
}

export async function fetchSaved(): Promise<Note[]> {
  return (await request<NotePage>('/me/saved')).items;
}

// PUT = "make it liked", DELETE = "make it not liked". Sending the desired end
// state (instead of "toggle") makes the request safe to retry or replay later.
export function setLike(id: number, liked: boolean): Promise<LikeState> {
  return request<LikeState>(`/notes/${id}/like`, { method: liked ? 'PUT' : 'DELETE' });
}

export function setSave(id: number, saved: boolean): Promise<SaveState> {
  return request<SaveState>(`/notes/${id}/save`, { method: saved ? 'PUT' : 'DELETE' });
}

export function createNote(draft: NoteDraft): Promise<Note> {
  const form = new FormData();
  form.append('title', draft.title);
  form.append('body', draft.body);
  form.append('tags', draft.tags.join(','));
  form.append('lang', draft.lang);
  for (const image of draft.images) {
    if (image.file) {
      form.append('images', image.file, image.fileName);
    } else {
      // React Native's FormData streams a local file when given this
      // { uri, name, type } shape; it is not part of the web FormData types.
      form.append('images', {
        uri: image.uri,
        name: image.fileName,
        type: image.mimeType,
      } as unknown as Blob);
    }
  }
  // No Content-Type header: fetch must add the multipart boundary itself.
  return request<Note>('/notes', { method: 'POST', body: form }, UPLOAD_TIMEOUT_MS);
}
