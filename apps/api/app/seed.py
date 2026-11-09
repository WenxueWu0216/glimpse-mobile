"""Seed the database with demo notes.

    python -m app.seed --count 600

Photos come from picsum.photos (free, deterministic per seed); only URLs and
dimensions are stored, so seeding is instant and needs no network access.
"""

import argparse
import random
from datetime import UTC, datetime, timedelta

from .config import get_settings
from .db import connect, init_db

AUTHORS = [
    ("u_mia", "Mia Chen"),
    ("u_leo", "Leo Martín"),
    ("u_sakura", "さくら"),
    ("u_noah", "Noah Kim"),
    ("u_lin", "林小满"),
    ("u_emma", "Emma Dubois"),
    ("u_arjun", "Arjun Rao"),
    ("u_sofia", "Sofía Reyes"),
]

# (lang, title, body, tags)
TEMPLATES = [
    (
        "en",
        "A slow morning at {place}",
        "Flat white, a window seat and nowhere to be. The pastries sell out by ten, so go early.",
        ["coffee", "cafe", "weekend"],
    ),
    (
        "en",
        "3 days in {place}: what I'd do again",
        "Day one was all walking. Day two we found "
        "a tiny noodle shop with no sign. Day three, the ferry at sunset.",
        ["travel", "itinerary"],
    ),
    (
        "en",
        "My tiny balcony garden, month {n}",
        "The basil finally took off. Tomatoes are sulking. Tips welcome!",
        ["plants", "home", "garden"],
    ),
    (
        "en",
        "Desk setup for small apartments",
        "A folding desk, one good lamp, and cable clips changed everything.",
        ["desksetup", "home", "productivity"],
    ),
    (
        "en",
        "Weeknight pasta with {n} ingredients",
        "Garlic, chili, lemon zest, a lot of parmesan. That's it.",
        ["food", "recipe", "pasta"],
    ),
    (
        "zh",
        "{place}周末citywalk路线",
        "从老街出发，一路走到江边。中途的那家咖啡店一定要去，二楼靠窗的位置最好。",
        ["citywalk", "周末", "探店"],
    ),
    (
        "zh",
        "租房改造第{n}天",
        "换了窗帘和灯，整个房间温柔了很多。预算不到五百块。",
        ["租房改造", "家居", "生活"],
    ),
    (
        "zh",
        "一人食：十分钟番茄鸡蛋面",
        "番茄一定要炒出沙，最后淋一点香油。简单但是治愈。",
        ["美食", "一人食", "食谱"],
    ),
    (
        "zh",
        "今日穿搭｜通勤也可以很舒服",
        "衬衫加针织背心，平底鞋走一天也不累。",
        ["穿搭", "通勤", "ootd"],
    ),
    (
        "ja",
        "{place}の朝ごはんカフェ",
        "厚切りトーストとゆで卵のモーニング。窓際の席がおすすめです。",
        ["カフェ", "朝ごはん", "おでかけ"],
    ),
    (
        "ja",
        "ベランダ菜園 {n}週目",
        "ミニトマトに花が咲きました。水やりは朝がいいみたい。",
        ["家庭菜園", "暮らし"],
    ),
    (
        "es",
        "Un domingo en {place}",
        "Mercado por la mañana, siesta, y helado al atardecer. No hace falta más.",
        ["viajes", "domingo", "comida"],
    ),
    (
        "es",
        "Mi rutina de skincare sencilla",
        "Limpiador, hidratante y protector solar. Menos es más.",
        ["skincare", "rutina"],
    ),
    (
        "fr",
        "Brunch maison du dimanche",
        "Œufs brouillés, pain au levain et confiture de figues. Simple et parfait.",
        ["brunch", "cuisine", "dimanche"],
    ),
    (
        "ko",
        "{place} 카페 투어",
        "창가 자리에서 마신 라떼가 제일 좋았어요. 디저트는 일찍 가야 있어요.",
        ["카페", "주말", "일상"],
    ),
    (
        "en",
        "Film photos from {place}",
        "Shot on a thrifted point-and-shoot. Half the roll was blurry and I love it anyway.",
        ["film", "photography", "travel"],
    ),
    (
        "en",
        "What I read this month ({n} books)",
        "One novel I couldn't put down and one I couldn't finish.",
        ["books", "reading"],
    ),
    (
        "en",
        "Thrifted outfit under ${n}0",
        "Wool coat, vintage denim, and boots that needed new laces.",
        ["ootd", "thrift", "fashion"],
    ),
]

PLACES = [
    "Lisbon",
    "Kyoto",
    "Shanghai",
    "Oaxaca",
    "Seoul",
    "Porto",
    "Chengdu",
    "Montréal",
    "Taipei",
    "Copenhagen",
    "Hangzhou",
    "Buenos Aires",
]
COLORS = ["#d9c7b8", "#b8c7d9", "#c9d9b8", "#e3c0c0", "#cfc3e0", "#e6d7a8", "#b9d6d2", "#d8d8d8"]
# Portrait-leaning aspect ratios so the two masonry columns look uneven.
SIZES = [(600, 600), (600, 750), (600, 800), (600, 900), (600, 450), (600, 680)]


def seed(db_path: str, count: int, reset: bool = False, rng_seed: int = 7) -> int:
    init_db(db_path)
    conn = connect(db_path)
    rng = random.Random(rng_seed)
    try:
        if reset:
            for table in ("likes", "saves", "note_tags", "note_images", "notes", "users"):
                conn.execute(f"DELETE FROM {table}")
            conn.execute("DELETE FROM sqlite_sequence WHERE name = 'notes'")
        for user_id, name in AUTHORS:
            conn.execute(
                "INSERT OR IGNORE INTO users (id, name, avatar_url) VALUES (?, ?, ?)",
                (user_id, name, f"https://picsum.photos/seed/{user_id}/96/96"),
            )
        start = datetime.now(UTC) - timedelta(minutes=30 * count)
        for i in range(count):
            lang, title, body, tags = rng.choice(TEMPLATES)
            n = rng.randint(2, 9)
            place = rng.choice(PLACES)
            cur = conn.execute(
                "INSERT INTO notes (author_id, title, body, lang, created_at, like_base, save_base)"
                " VALUES (?, ?, ?, ?, ?, ?, ?)",
                (
                    rng.choice(AUTHORS)[0],
                    title.format(place=place, n=n),
                    body.format(place=place, n=n),
                    lang,
                    (start + timedelta(minutes=30 * i)).isoformat(),
                    int(rng.paretovariate(1.2) * 12),
                    rng.randint(0, 80),
                ),
            )
            note_id = cur.lastrowid
            for pos in range(rng.choice([1, 1, 2, 3, 4])):
                w, h = rng.choice(SIZES)
                conn.execute(
                    "INSERT INTO note_images (note_id, position, url, width, height, color)"
                    " VALUES (?, ?, ?, ?, ?, ?)",
                    (
                        note_id,
                        pos,
                        f"https://picsum.photos/seed/glimpse-{note_id}-{pos}/{w}/{h}",
                        w,
                        h,
                        rng.choice(COLORS),
                    ),
                )
            conn.executemany(
                "INSERT INTO note_tags (note_id, tag) VALUES (?, ?)", [(note_id, t) for t in tags]
            )
        conn.commit()
        return conn.execute("SELECT COUNT(*) FROM notes").fetchone()[0]
    finally:
        conn.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--count", type=int, default=600)
    parser.add_argument("--reset", action="store_true", help="delete existing data first")
    args = parser.parse_args()
    total = seed(get_settings().db_path, args.count, reset=args.reset)
    print(f"Database now has {total} notes")
