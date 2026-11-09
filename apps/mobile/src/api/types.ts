export interface Author {
  id: string;
  name: string;
  avatar_url: string | null;
}

export interface NoteImage {
  url: string;
  width: number;
  height: number;
  /** Dominant-ish colour shown while the image loads. */
  color: string;
}

export interface Note {
  id: number;
  title: string;
  body: string;
  lang: string;
  author: Author;
  images: NoteImage[];
  tags: string[];
  like_count: number;
  save_count: number;
  liked: boolean;
  saved: boolean;
  created_at: string;
}

export interface NotePage {
  items: Note[];
  next_cursor: string | null;
}

export interface LikeState {
  liked: boolean;
  like_count: number;
}

export interface SaveState {
  saved: boolean;
  save_count: number;
}

/** A photo chosen in the composer, before upload. */
export interface DraftImage {
  uri: string;
  mimeType: string;
  fileName: string;
  /** Present on web, where the picker returns a real File object. */
  file?: Blob;
}

export interface NoteDraft {
  title: string;
  body: string;
  tags: string[];
  lang: string;
  images: DraftImage[];
}
