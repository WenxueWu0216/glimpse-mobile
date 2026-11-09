import { request } from './client';
import type { Note, NotePage } from './types';

export const PAGE_SIZE = 20;

export function fetchNotes(cursor: string | null): Promise<NotePage> {
  const query = cursor
    ? `?limit=${PAGE_SIZE}&cursor=${encodeURIComponent(cursor)}`
    : `?limit=${PAGE_SIZE}`;
  return request<NotePage>(`/notes${query}`);
}

export function fetchNote(id: number): Promise<Note> {
  return request<Note>(`/notes/${id}`);
}
