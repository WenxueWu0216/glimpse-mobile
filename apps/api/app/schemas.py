from pydantic import BaseModel


class Author(BaseModel):
    id: str
    name: str
    avatar_url: str | None


class NoteImage(BaseModel):
    url: str
    width: int
    height: int
    color: str


class Note(BaseModel):
    id: int
    title: str
    body: str
    lang: str
    author: Author
    images: list[NoteImage]
    tags: list[str]
    like_count: int
    save_count: int
    liked: bool
    saved: bool
    created_at: str


class NotePage(BaseModel):
    items: list[Note]
    next_cursor: str | None


class LikeState(BaseModel):
    liked: bool
    like_count: int


class SaveState(BaseModel):
    saved: bool
    save_count: int
