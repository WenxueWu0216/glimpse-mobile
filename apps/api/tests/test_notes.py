import struct
import zlib


def _png(width: int = 3, height: int = 2) -> bytes:
    def chunk(kind: bytes, data: bytes) -> bytes:
        body = kind + data
        return struct.pack(">I", len(data)) + body + struct.pack(">I", zlib.crc32(body))

    raw = b"".join(b"\x00" + b"\xff\x00\x00" * width for _ in range(height))
    return (
        b"\x89PNG\r\n\x1a\n"
        + chunk(b"IHDR", struct.pack(">IIBBBBB", width, height, 8, 2, 0, 0, 0))
        + chunk(b"IDAT", zlib.compress(raw))
        + chunk(b"IEND", b"")
    )


def test_feed_paginates_with_cursor_without_gaps_or_duplicates(client):
    seen: list[int] = []
    cursor = None
    pages = 0
    while True:
        params = {"limit": 20} | ({"cursor": cursor} if cursor else {})
        page = client.get("/notes", params=params).json()
        seen += [n["id"] for n in page["items"]]
        pages += 1
        cursor = page["next_cursor"]
        if cursor is None:
            break
    assert pages == 3
    assert seen == list(range(45, 0, -1))


def test_feed_is_stable_when_new_notes_arrive_mid_scroll(client):
    first = client.get("/notes", params={"limit": 10}).json()
    client.post(
        "/notes",
        data={"title": "Fresh"},
        files=[("images", ("a.png", _png(), "image/png"))],
    )
    second = client.get("/notes", params={"limit": 10, "cursor": first["next_cursor"]}).json()
    first_ids = {n["id"] for n in first["items"]}
    assert first_ids.isdisjoint(n["id"] for n in second["items"])
    assert second["items"][0]["id"] == first["items"][-1]["id"] - 1


def test_invalid_cursor_and_limit_are_rejected(client):
    assert client.get("/notes", params={"cursor": "abc"}).status_code == 400
    assert client.get("/notes", params={"limit": 500}).status_code == 422


def test_note_detail_and_404(client):
    note = client.get("/notes/1").json()
    assert note["id"] == 1 and note["images"] and note["author"]["name"]
    assert client.get("/notes/9999").status_code == 404


def test_like_is_idempotent_and_per_user(client):
    base = client.get("/notes/1").json()["like_count"]
    for _ in range(2):  # replaying the same request must not double-count
        res = client.put("/notes/1/like").json()
        assert res == {"liked": True, "like_count": base + 1}
    other = client.get("/notes/1", headers={"X-User-Id": "someone-else"}).json()
    assert other["liked"] is False and other["like_count"] == base + 1
    for _ in range(2):
        assert client.delete("/notes/1/like").json() == {"liked": False, "like_count": base}
    assert client.put("/notes/9999/like").status_code == 404


def test_save_and_saved_list(client):
    client.put("/notes/3/save")
    client.put("/notes/7/save")
    saved = client.get("/me/saved").json()["items"]
    assert [n["id"] for n in saved] == [7, 3]
    assert all(n["saved"] for n in saved)
    client.delete("/notes/3/save")
    assert [n["id"] for n in client.get("/me/saved").json()["items"]] == [7]


def test_create_note_with_image_upload(client, settings):
    res = client.post(
        "/notes",
        data={"title": "  Hello  ", "body": "First post", "tags": "#Coffee, travel coffee"},
        files=[
            ("images", ("a.png", _png(3, 2), "image/png")),
            ("images", ("b.png", _png(4, 5), "image/png")),
        ],
    )
    assert res.status_code == 201
    note = res.json()
    assert note["title"] == "Hello"
    assert note["tags"] == ["coffee", "travel"]
    assert [(i["width"], i["height"]) for i in note["images"]] == [(3, 2), (4, 5)]
    assert len(list(settings.upload_dir.iterdir())) == 2
    # The uploaded file is served back and the note is first in the feed.
    assert client.get(note["images"][0]["url"]).content == _png(3, 2)
    assert client.get("/notes").json()["items"][0]["id"] == note["id"]


def test_create_note_validation(client):
    png = ("images", ("a.png", _png(), "image/png"))
    assert client.post("/notes", data={"title": "No image"}).status_code == 422
    assert client.post("/notes", data={"title": "   "}, files=[png]).status_code == 422
    bad_type = ("images", ("a.gif", b"GIF89a", "image/gif"))
    assert client.post("/notes", data={"title": "x"}, files=[bad_type]).status_code == 415
    fake = ("images", ("a.png", b"not really a png", "image/png"))
    assert client.post("/notes", data={"title": "x"}, files=[fake]).status_code == 415
