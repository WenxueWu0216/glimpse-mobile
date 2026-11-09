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
