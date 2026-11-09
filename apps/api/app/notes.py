"""Notes: cursor-paginated feed, detail, create with image upload, like/save."""

import sqlite3
import struct
import uuid
from datetime import UTC, datetime
from pathlib import Path

from fastapi import (
    APIRouter,
    Depends,
    File,
    Form,
    Header,
    HTTPException,
    Query,
    Request,
    UploadFile,
)

from .db import get_db
from .schemas import LikeState, Note, NotePage, SaveState

router = APIRouter()

MAX_IMAGES = 9
MAX_IMAGE_BYTES = 8 * 1024 * 1024
ALLOWED_TYPES = {"image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp"}


def current_user(
    db: sqlite3.Connection = Depends(get_db),
    x_user_id: str = Header(default="demo"),
) -> str:
    """Demo auth: the client sends a device-scoped id; no passwords in this project."""
    user_id = x_user_id.strip()[:64] or "demo"
    db.execute(
        "INSERT OR IGNORE INTO users (id, name, avatar_url) VALUES (?, ?, NULL)",
        (user_id, "You" if user_id == "demo" else f"user-{user_id[:6]}"),
    )
    return user_id


def _absolute(url: str, request: Request) -> str:
    return url if url.startswith("http") else str(request.base_url).rstrip("/") + url


def load_notes(
    db: sqlite3.Connection, ids: list[int], user_id: str, request: Request
) -> list[Note]:
    """Hydrate notes in a fixed number of queries (no N+1), preserving `ids` order."""
    if not ids:
        return []
    marks = ",".join("?" * len(ids))
    rows = db.execute(
        f"""
        SELECT n.*, u.name AS author_name, u.avatar_url AS author_avatar,
            n.like_base + (SELECT COUNT(*) FROM likes l WHERE l.note_id = n.id) AS like_count,
            n.save_base + (SELECT COUNT(*) FROM saves s WHERE s.note_id = n.id) AS save_count,
            EXISTS(SELECT 1 FROM likes l WHERE l.note_id = n.id AND l.user_id = ?) AS liked,
            EXISTS(SELECT 1 FROM saves s WHERE s.note_id = n.id AND s.user_id = ?) AS saved
        FROM notes n JOIN users u ON u.id = n.author_id
        WHERE n.id IN ({marks})
        """,
        (user_id, user_id, *ids),
    ).fetchall()
    images: dict[int, list[dict]] = {}
    for r in db.execute(
        f"SELECT * FROM note_images WHERE note_id IN ({marks}) ORDER BY note_id, position", ids
    ):
        images.setdefault(r["note_id"], []).append(
            {
                "url": _absolute(r["url"], request),
                "width": r["width"],
                "height": r["height"],
                "color": r["color"],
            }
        )
    tags: dict[int, list[str]] = {}
    for r in db.execute(
        f"SELECT note_id, tag FROM note_tags WHERE note_id IN ({marks}) ORDER BY rowid", ids
    ):
        tags.setdefault(r["note_id"], []).append(r["tag"])

    by_id = {
        r["id"]: Note(
            id=r["id"],
            title=r["title"],
            body=r["body"],
            lang=r["lang"],
            author={
                "id": r["author_id"],
                "name": r["author_name"],
                "avatar_url": r["author_avatar"],
            },
            images=images.get(r["id"], []),
            tags=tags.get(r["id"], []),
            like_count=r["like_count"],
            save_count=r["save_count"],
            liked=bool(r["liked"]),
            saved=bool(r["saved"]),
            created_at=r["created_at"],
        )
        for r in rows
    }
    return [by_id[i] for i in ids if i in by_id]


def _require_note(db: sqlite3.Connection, note_id: int) -> None:
    if not db.execute("SELECT 1 FROM notes WHERE id = ?", (note_id,)).fetchone():
        raise HTTPException(404, "Note not found")


@router.get("/notes", response_model=NotePage)
def list_notes(
    request: Request,
    cursor: str | None = None,
    limit: int = Query(20, ge=1, le=50),
    db: sqlite3.Connection = Depends(get_db),
    user_id: str = Depends(current_user),
) -> NotePage:
    """Newest first. `cursor` is the id of the last note the client already has.

    Keyset pagination (WHERE id < cursor) stays stable when new notes are posted
    while the user scrolls, unlike OFFSET which would shift and duplicate rows.
    """
    try:
        before = int(cursor) if cursor else None
    except ValueError:
        raise HTTPException(400, "Invalid cursor") from None
    sql = "SELECT id FROM notes"
    params: list[int] = []
    if before is not None:
        sql += " WHERE id < ?"
        params.append(before)
    # Fetch one extra row to learn whether another page exists.
    rows = db.execute(sql + " ORDER BY id DESC LIMIT ?", (*params, limit + 1)).fetchall()
    ids = [r["id"] for r in rows[:limit]]
    next_cursor = str(ids[-1]) if len(rows) > limit else None
    return NotePage(items=load_notes(db, ids, user_id, request), next_cursor=next_cursor)


@router.get("/me/saved", response_model=NotePage)
def list_saved(
    request: Request,
    db: sqlite3.Connection = Depends(get_db),
    user_id: str = Depends(current_user),
) -> NotePage:
    rows = db.execute(
        "SELECT note_id FROM saves WHERE user_id = ? ORDER BY created_at DESC, note_id DESC",
        (user_id,),
    ).fetchall()
    ids = [r["note_id"] for r in rows]
    return NotePage(items=load_notes(db, ids, user_id, request), next_cursor=None)


@router.get("/notes/{note_id}", response_model=Note)
def get_note(
    note_id: int,
    request: Request,
    db: sqlite3.Connection = Depends(get_db),
    user_id: str = Depends(current_user),
) -> Note:
    notes = load_notes(db, [note_id], user_id, request)
    if not notes:
        raise HTTPException(404, "Note not found")
    return notes[0]


def _image_size(data: bytes) -> tuple[int, int] | None:
    """Read pixel dimensions from PNG/JPEG/WebP headers without an imaging library."""
    if data[:8] == b"\x89PNG\r\n\x1a\n" and len(data) >= 24:
        w, h = struct.unpack(">II", data[16:24])
        return w, h
    if data[:2] == b"\xff\xd8":
        i = 2
        while i + 9 < len(data):
            if data[i] != 0xFF:
                i += 1
                continue
            marker = data[i + 1]
            if 0xC0 <= marker <= 0xCF and marker not in (0xC4, 0xC8, 0xCC):
                h, w = struct.unpack(">HH", data[i + 5 : i + 9])
                return w, h
            if marker in (0xD8, 0x01) or 0xD0 <= marker <= 0xD7:
                i += 2
                continue
            i += 2 + struct.unpack(">H", data[i + 2 : i + 4])[0]
        return None
    if data[:4] == b"RIFF" and data[8:12] == b"WEBP" and len(data) >= 30:
        kind = data[12:16]
        if kind == b"VP8X":
            w = 1 + int.from_bytes(data[24:27], "little")
            h = 1 + int.from_bytes(data[27:30], "little")
            return w, h
        if kind == b"VP8 ":
            w, h = struct.unpack("<HH", data[26:30])
            return w & 0x3FFF, h & 0x3FFF
        if kind == b"VP8L":
            bits = int.from_bytes(data[21:25], "little")
            return (bits & 0x3FFF) + 1, ((bits >> 14) & 0x3FFF) + 1
    return None


def _clean_tags(raw: str) -> list[str]:
    seen: list[str] = []
    for part in raw.replace("#", " ").replace(",", " ").split():
        tag = part.strip().lower()[:30]
        if tag and tag not in seen:
            seen.append(tag)
    return seen[:10]


@router.post("/notes", response_model=Note, status_code=201)
async def create_note(
    request: Request,
    title: str = Form(..., min_length=1, max_length=100),
    body: str = Form("", max_length=5000),
    tags: str = Form(""),
    lang: str = Form("en", max_length=10),
    images: list[UploadFile] = File(...),
    db: sqlite3.Connection = Depends(get_db),
    user_id: str = Depends(current_user),
) -> Note:
    """Multipart upload: text fields plus 1-9 image files."""
    if not title.strip():
        raise HTTPException(422, "Title is required")
    if not 1 <= len(images) <= MAX_IMAGES:
        raise HTTPException(422, f"Attach between 1 and {MAX_IMAGES} images")

    upload_dir: Path = request.app.state.settings.upload_dir
    upload_dir.mkdir(parents=True, exist_ok=True)
    stored: list[tuple[str, int, int]] = []
    for image in images:
        ext = ALLOWED_TYPES.get(image.content_type or "")
        if not ext:
            raise HTTPException(415, "Images must be JPEG, PNG or WebP")
        data = await image.read()
        if len(data) > MAX_IMAGE_BYTES:
            raise HTTPException(413, "Image too large")
        size = _image_size(data)
        if not size:
            raise HTTPException(415, "Could not read image")
        # Server-generated filename: never trust the client-provided one.
        name = f"{uuid.uuid4().hex}{ext}"
        (upload_dir / name).write_bytes(data)
        stored.append((f"/uploads/{name}", *size))

    cur = db.execute(
        "INSERT INTO notes (author_id, title, body, lang, created_at) VALUES (?, ?, ?, ?, ?)",
        (user_id, title.strip(), body.strip(), lang, datetime.now(UTC).isoformat()),
    )
    note_id = cur.lastrowid
    assert note_id is not None
    db.executemany(
        "INSERT INTO note_images (note_id, position, url, width, height) VALUES (?, ?, ?, ?, ?)",
        [(note_id, i, url, w, h) for i, (url, w, h) in enumerate(stored)],
    )
    db.executemany(
        "INSERT INTO note_tags (note_id, tag) VALUES (?, ?)",
        [(note_id, t) for t in _clean_tags(tags)],
    )
    return load_notes(db, [note_id], user_id, request)[0]


def _like_state(db: sqlite3.Connection, note_id: int, user_id: str) -> LikeState:
    count = db.execute(
        "SELECT like_base + (SELECT COUNT(*) FROM likes WHERE note_id = n.id)"
        " FROM notes n WHERE id = ?",
        (note_id,),
    ).fetchone()[0]
    liked = db.execute(
        "SELECT 1 FROM likes WHERE note_id = ? AND user_id = ?", (note_id, user_id)
    ).fetchone()
    return LikeState(liked=bool(liked), like_count=count)


def _save_state(db: sqlite3.Connection, note_id: int, user_id: str) -> SaveState:
    count = db.execute(
        "SELECT save_base + (SELECT COUNT(*) FROM saves WHERE note_id = n.id)"
        " FROM notes n WHERE id = ?",
        (note_id,),
    ).fetchone()[0]
    saved = db.execute(
        "SELECT 1 FROM saves WHERE note_id = ? AND user_id = ?", (note_id, user_id)
    ).fetchone()
    return SaveState(saved=bool(saved), save_count=count)


# PUT/DELETE are idempotent on purpose: the mobile offline queue may replay a
# request after a timeout, and replaying must not double-count.
@router.put("/notes/{note_id}/like", response_model=LikeState)
def like(
    note_id: int,
    db: sqlite3.Connection = Depends(get_db),
    user_id: str = Depends(current_user),
) -> LikeState:
    _require_note(db, note_id)
    db.execute("INSERT OR IGNORE INTO likes (user_id, note_id) VALUES (?, ?)", (user_id, note_id))
    return _like_state(db, note_id, user_id)


@router.delete("/notes/{note_id}/like", response_model=LikeState)
def unlike(
    note_id: int,
    db: sqlite3.Connection = Depends(get_db),
    user_id: str = Depends(current_user),
) -> LikeState:
    _require_note(db, note_id)
    db.execute("DELETE FROM likes WHERE user_id = ? AND note_id = ?", (user_id, note_id))
    return _like_state(db, note_id, user_id)


@router.put("/notes/{note_id}/save", response_model=SaveState)
def save(
    note_id: int,
    db: sqlite3.Connection = Depends(get_db),
    user_id: str = Depends(current_user),
) -> SaveState:
    _require_note(db, note_id)
    db.execute(
        "INSERT OR IGNORE INTO saves (user_id, note_id, created_at) VALUES (?, ?, ?)",
        (user_id, note_id, datetime.now(UTC).isoformat()),
    )
    return _save_state(db, note_id, user_id)


@router.delete("/notes/{note_id}/save", response_model=SaveState)
def unsave(
    note_id: int,
    db: sqlite3.Connection = Depends(get_db),
    user_id: str = Depends(current_user),
) -> SaveState:
    _require_note(db, note_id)
    db.execute("DELETE FROM saves WHERE user_id = ? AND note_id = ?", (user_id, note_id))
    return _save_state(db, note_id, user_id)
