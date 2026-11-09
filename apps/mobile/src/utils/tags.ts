export const MAX_TAGS = 10;

/** "#Coffee Shop!" -> "coffeeshop". Returns '' when nothing usable is left. */
export function normalizeTag(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[\s#,.!?;:'"()[\]{}<>/\\|@$%^&*+=~`]+/g, '')
    .slice(0, 30);
}

/** Adds a tag unless it is empty, a duplicate, or the list is full. */
export function addTag(tags: string[], raw: string): string[] {
  const tag = normalizeTag(raw);
  if (!tag || tags.includes(tag) || tags.length >= MAX_TAGS) return tags;
  return [...tags, tag];
}
