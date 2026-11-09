import { request } from './client';

export interface Translation {
  title: string;
  body: string;
  lang: string;
}

// The app never talks to the model provider directly: an API key shipped
// inside an app bundle can be extracted by anyone who downloads the app.
export function translateNote(noteId: number, targetLang: string): Promise<Translation> {
  return request<Translation>(
    `/notes/${noteId}/translate`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ target_lang: targetLang }),
    },
    30_000,
  );
}

export async function suggestTags(title: string, body: string): Promise<string[]> {
  const result = await request<{ tags: string[] }>(
    '/ai/suggest-tags',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, body }),
    },
    30_000,
  );
  return result.tags;
}
