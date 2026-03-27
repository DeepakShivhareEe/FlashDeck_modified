import os
import sqlite3
from contextlib import contextmanager
from datetime import datetime, timezone
from pathlib import Path
from typing import Iterator

BASE_DIR = Path(__file__).resolve().parent
DB_PATH = BASE_DIR / "flashdeck_app.db"


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def init_db() -> None:
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    with sqlite3.connect(DB_PATH) as conn:
        conn.execute("PRAGMA journal_mode=WAL;")
        conn.execute("PRAGMA foreign_keys=ON;")
        conn.executescript(
            """
            CREATE TABLE IF NOT EXISTS users (
                id TEXT PRIMARY KEY,
                email TEXT NOT NULL UNIQUE,
                password_hash TEXT NOT NULL,
                display_name TEXT NOT NULL,
                created_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS decks (
                id TEXT PRIMARY KEY,
                user_id TEXT,
                deck_name TEXT NOT NULL,
                created_at TEXT NOT NULL,
                FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE SET NULL
            );

            CREATE TABLE IF NOT EXISTS flashcards (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                deck_id TEXT NOT NULL,
                question TEXT NOT NULL,
                answer TEXT NOT NULL,
                topic TEXT,
                created_at TEXT NOT NULL,
                FOREIGN KEY(deck_id) REFERENCES decks(id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS quiz_attempts (
                id TEXT PRIMARY KEY,
                user_id TEXT,
                deck_id TEXT,
                difficulty TEXT NOT NULL,
                score INTEGER NOT NULL,
                total_questions INTEGER NOT NULL,
                accuracy REAL NOT NULL,
                duration_seconds INTEGER NOT NULL,
                submitted_at TEXT NOT NULL,
                FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE SET NULL,
                FOREIGN KEY(deck_id) REFERENCES decks(id) ON DELETE SET NULL
            );

            CREATE TABLE IF NOT EXISTS quiz_answers (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                attempt_id TEXT NOT NULL,
                question TEXT NOT NULL,
                selected_index INTEGER NOT NULL,
                correct_index INTEGER NOT NULL,
                is_correct INTEGER NOT NULL,
                topic TEXT,
                explanation TEXT,
                FOREIGN KEY(attempt_id) REFERENCES quiz_attempts(id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS srs_reviews (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id TEXT NOT NULL,
                deck_id TEXT,
                card_key TEXT NOT NULL,
                question TEXT NOT NULL,
                answer TEXT NOT NULL,
                topic TEXT,
                last_reviewed TEXT,
                next_review TEXT NOT NULL,
                repetitions INTEGER NOT NULL,
                interval_days INTEGER NOT NULL,
                ease_factor REAL NOT NULL,
                UNIQUE(user_id, card_key)
            );

            CREATE INDEX IF NOT EXISTS idx_quiz_attempts_user_submitted
            ON quiz_attempts(user_id, submitted_at);

            CREATE INDEX IF NOT EXISTS idx_quiz_attempts_submitted
            ON quiz_attempts(submitted_at);

            CREATE INDEX IF NOT EXISTS idx_flashcards_deck
            ON flashcards(deck_id);

            CREATE INDEX IF NOT EXISTS idx_srs_reviews_user_next
            ON srs_reviews(user_id, next_review);
            """
        )
        conn.commit()


@contextmanager
def get_conn() -> Iterator[sqlite3.Connection]:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys=ON;")
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()
