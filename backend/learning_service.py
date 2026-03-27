import csv
import io
import uuid
from collections import Counter
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional

from reportlab.lib.pagesizes import A4
from reportlab.lib.utils import simpleSplit
from reportlab.pdfgen import canvas

from db import get_conn, utc_now_iso


def ensure_deck_saved(deck_id: str, deck_name: str, cards: List[Dict[str, Any]], user_id: Optional[str] = None) -> None:
    with get_conn() as conn:
        conn.execute(
            """
            INSERT INTO decks (id, user_id, deck_name, created_at)
            VALUES (?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET deck_name = excluded.deck_name
            """,
            (deck_id, user_id, deck_name, utc_now_iso()),
        )

        existing_count = conn.execute(
            "SELECT COUNT(1) AS cnt FROM flashcards WHERE deck_id = ?",
            (deck_id,),
        ).fetchone()["cnt"]

        if existing_count == 0:
            for card in cards:
                conn.execute(
                    """
                    INSERT INTO flashcards (deck_id, question, answer, topic, created_at)
                    VALUES (?, ?, ?, ?, ?)
                    """,
                    (
                        deck_id,
                        str(card.get("q", "")).strip(),
                        str(card.get("a", "")).strip(),
                        str(card.get("topic", "General")).strip() or "General",
                        utc_now_iso(),
                    ),
                )


def get_deck_cards(deck_id: str) -> List[Dict[str, str]]:
    with get_conn() as conn:
        rows = conn.execute(
            "SELECT question, answer, COALESCE(topic, 'General') AS topic FROM flashcards WHERE deck_id = ?",
            (deck_id,),
        ).fetchall()

    return [{"q": row["question"], "a": row["answer"], "topic": row["topic"]} for row in rows]


def record_quiz_attempt(
    user_id: Optional[str],
    deck_id: Optional[str],
    difficulty: str,
    score: int,
    total_questions: int,
    duration_seconds: int,
    answers: List[Dict[str, Any]],
) -> str:
    attempt_id = str(uuid.uuid4())
    total = max(total_questions, 1)
    accuracy = round((score / total) * 100, 2)

    with get_conn() as conn:
        conn.execute(
            """
            INSERT INTO quiz_attempts (id, user_id, deck_id, difficulty, score, total_questions, accuracy, duration_seconds, submitted_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (attempt_id, user_id, deck_id, difficulty, score, total_questions, accuracy, duration_seconds, utc_now_iso()),
        )

        for answer in answers:
            selected_index = _coerce_int(answer.get("selected_index"), 0)
            correct_index = _coerce_int(answer.get("correct_index"), 0)
            is_correct = 1 if selected_index == correct_index else 0
            conn.execute(
                """
                INSERT INTO quiz_answers (attempt_id, question, selected_index, correct_index, is_correct, topic, explanation)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    attempt_id,
                    str(answer.get("question", "")),
                    selected_index,
                    correct_index,
                    is_correct,
                    str(answer.get("topic", "General")),
                    str(answer.get("explanation", "")),
                ),
            )

    return attempt_id


def get_user_analytics(user_id: str) -> Dict[str, Any]:
    with get_conn() as conn:
        summary = conn.execute(
            """
            SELECT
                COUNT(1) AS total_quizzes,
                COALESCE(AVG(score), 0) AS avg_score,
                COALESCE(AVG(accuracy), 0) AS avg_accuracy
            FROM quiz_attempts
            WHERE user_id = ?
            """,
            (user_id,),
        ).fetchone()

        rows = conn.execute(
            """
            SELECT
                DATE(submitted_at) AS day,
                COUNT(1) AS attempts,
                COALESCE(AVG(accuracy), 0) AS accuracy
            FROM quiz_attempts
            WHERE user_id = ?
            GROUP BY DATE(submitted_at)
            ORDER BY day DESC
            LIMIT 14
            """,
            (user_id,),
        ).fetchall()

        weak_topics_rows = conn.execute(
            """
            SELECT
                COALESCE(topic, 'General') AS topic,
                COUNT(1) AS wrong_count
            FROM quiz_answers qa
            JOIN quiz_attempts q ON q.id = qa.attempt_id
            WHERE q.user_id = ? AND qa.is_correct = 0
            GROUP BY COALESCE(topic, 'General')
            ORDER BY wrong_count DESC
            LIMIT 5
            """,
            (user_id,),
        ).fetchall()

    trend = [
        {
            "day": row["day"],
            "attempts": row["attempts"],
            "accuracy": round(float(row["accuracy"]), 2),
        }
        for row in reversed(rows)
    ]

    return {
        "total_quizzes": summary["total_quizzes"],
        "average_score": round(float(summary["avg_score"]), 2),
        "accuracy_percent": round(float(summary["avg_accuracy"]), 2),
        "weak_topics": [{"topic": row["topic"], "wrong_count": row["wrong_count"]} for row in weak_topics_rows],
        "trend": trend,
    }


def get_leaderboard(scope: str = "global", limit: int = 20) -> List[Dict[str, Any]]:
    if scope not in {"global", "weekly"}:
        scope = "global"

    params: List[Any] = []
    where_clause = ""
    if scope == "weekly":
        week_ago = (datetime.now(timezone.utc) - timedelta(days=7)).isoformat()
        where_clause = "WHERE qa.submitted_at >= ?"
        params.append(week_ago)

    query = f"""
        SELECT
            u.id AS user_id,
            u.display_name,
            COUNT(qa.id) AS quizzes,
            COALESCE(AVG(qa.score), 0) AS avg_score,
            COALESCE(AVG(qa.accuracy), 0) AS avg_accuracy,
            COALESCE(SUM(qa.score), 0) AS total_score
        FROM users u
        LEFT JOIN quiz_attempts qa ON qa.user_id = u.id
        {where_clause}
        GROUP BY u.id, u.display_name
        ORDER BY avg_accuracy DESC, total_score DESC, quizzes DESC
        LIMIT ?
    """
    params.append(limit)

    with get_conn() as conn:
        rows = conn.execute(query, tuple(params)).fetchall()

    ranked = []
    for index, row in enumerate(rows, start=1):
        ranked.append(
            {
                "rank": index,
                "user_id": row["user_id"],
                "display_name": row["display_name"],
                "quizzes": row["quizzes"],
                "average_score": round(float(row["avg_score"]), 2),
                "accuracy_percent": round(float(row["avg_accuracy"]), 2),
                "total_score": row["total_score"],
            }
        )
    return ranked


def update_srs_for_answer(
    user_id: str,
    deck_id: Optional[str],
    question: str,
    answer: str,
    topic: str,
    is_correct: bool,
) -> Dict[str, Any]:
    card_key = f"{deck_id or 'none'}::{question.strip().lower()}"
    now = datetime.now(timezone.utc)

    with get_conn() as conn:
        row = conn.execute(
            """
            SELECT repetitions, interval_days, ease_factor
            FROM srs_reviews
            WHERE user_id = ? AND card_key = ?
            """,
            (user_id, card_key),
        ).fetchone()

        repetitions = row["repetitions"] if row else 0
        interval = row["interval_days"] if row else 1
        ease = float(row["ease_factor"]) if row else 2.5

        if is_correct:
            repetitions += 1
            if repetitions == 1:
                interval = 1
            elif repetitions == 2:
                interval = 3
            else:
                interval = max(1, round(interval * ease))
            ease = min(2.8, ease + 0.05)
        else:
            repetitions = 0
            interval = 1
            ease = max(1.3, ease - 0.2)

        next_review = now + timedelta(days=interval)

        conn.execute(
            """
            INSERT INTO srs_reviews (
                user_id, deck_id, card_key, question, answer, topic,
                last_reviewed, next_review, repetitions, interval_days, ease_factor
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(user_id, card_key)
            DO UPDATE SET
                deck_id = excluded.deck_id,
                question = excluded.question,
                answer = excluded.answer,
                topic = excluded.topic,
                last_reviewed = excluded.last_reviewed,
                next_review = excluded.next_review,
                repetitions = excluded.repetitions,
                interval_days = excluded.interval_days,
                ease_factor = excluded.ease_factor
            """,
            (
                user_id,
                deck_id,
                card_key,
                question,
                answer,
                topic,
                now.isoformat(),
                next_review.isoformat(),
                repetitions,
                interval,
                ease,
            ),
        )

    return {
        "card_key": card_key,
        "next_review": next_review.isoformat(),
        "interval_days": interval,
        "ease_factor": round(ease, 2),
        "repetitions": repetitions,
    }


def get_due_reviews(user_id: str, limit: int = 30) -> List[Dict[str, Any]]:
    now_iso = datetime.now(timezone.utc).isoformat()
    with get_conn() as conn:
        rows = conn.execute(
            """
            SELECT card_key, deck_id, question, answer, topic, next_review, repetitions, interval_days, ease_factor
            FROM srs_reviews
            WHERE user_id = ? AND next_review <= ?
            ORDER BY next_review ASC
            LIMIT ?
            """,
            (user_id, now_iso, limit),
        ).fetchall()

    return [dict(row) for row in rows]


def export_flashcards_csv(cards: List[Dict[str, Any]]) -> bytes:
    buffer = io.StringIO()
    writer = csv.writer(buffer)
    writer.writerow(["Question", "Answer", "Topic"])
    for card in cards:
        writer.writerow([card.get("q", ""), card.get("a", ""), card.get("topic", "General")])
    return buffer.getvalue().encode("utf-8")


def export_flashcards_pdf(deck_name: str, cards: List[Dict[str, Any]]) -> bytes:
    buffer = io.BytesIO()
    pdf = canvas.Canvas(buffer, pagesize=A4)
    width, height = A4
    y = height - 40

    pdf.setFont("Helvetica-Bold", 14)
    pdf.drawString(40, y, f"FlashDeck Export: {deck_name}")
    y -= 28

    pdf.setFont("Helvetica", 11)
    for index, card in enumerate(cards, start=1):
        question = f"Q{index}: {card.get('q', '')}"
        answer = f"A{index}: {card.get('a', '')}"

        for line in simpleSplit(question, "Helvetica", 11, width - 80):
            if y < 80:
                pdf.showPage()
                pdf.setFont("Helvetica", 11)
                y = height - 40
            pdf.drawString(40, y, line)
            y -= 14

        for line in simpleSplit(answer, "Helvetica", 11, width - 80):
            if y < 80:
                pdf.showPage()
                pdf.setFont("Helvetica", 11)
                y = height - 40
            pdf.drawString(40, y, line)
            y -= 14

        y -= 8

    pdf.save()
    return buffer.getvalue()


def _coerce_int(value: Any, default: int = 0) -> int:
    try:
        return int(value)
    except (TypeError, ValueError):
        return default
