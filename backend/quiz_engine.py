from typing import Dict, List

from langchain_core.output_parsers import JsonOutputParser
from langchain_core.prompts import ChatPromptTemplate
from pydantic import BaseModel, Field

from llm_client import create_llm, invoke_with_retry


class QuizQuestion(BaseModel):
    question: str = Field(description="Question text")
    options: List[str] = Field(description="Exactly 4 options")
    correct_index: int = Field(description="Index of correct option from 0 to 3")
    explanation: str = Field(description="Short explanation of why the answer is correct")


class QuizSet(BaseModel):
    quiz: List[QuizQuestion]


def generate_quiz_from_material(
    cards: List[Dict[str, str]],
    source_text: str,
    question_count: int = 10,
    difficulty: str = "medium",
) -> List[Dict[str, object]]:
    """Generate MCQ quiz data from extracted content and generated flashcards."""
    llm = create_llm()
    parser = JsonOutputParser(pydantic_object=QuizSet)
    normalized_difficulty = _normalize_difficulty(difficulty)

    cards_preview = cards[: min(30, len(cards))]
    prompt = ChatPromptTemplate.from_messages(
        [
            (
                "system",
                "You are a strict quiz generator. Return valid JSON only. "
                "Generate high-quality MCQs for studying. Each question must have exactly 4 options and one correct answer.",
            ),
            (
                "user",
                "Create {count} MCQ questions from this study material at {difficulty} difficulty.\n\n"
                "Flashcards: {cards}\n\n"
                "Source Content: {source}\n\n"
                "JSON format:\n"
                "{{\"quiz\": [{{\"question\":\"...\",\"options\":[\"A\",\"B\",\"C\",\"D\"],\"correct_index\":0,\"explanation\":\"...\"}}]}}"
            ),
        ]
    )

    chain = prompt | llm | parser
    result = invoke_with_retry(
        chain.invoke,
        {
            "count": max(1, min(question_count, 20)),
            "difficulty": normalized_difficulty,
            "cards": cards_preview,
            "source": source_text[:12000],
        },
    )

    quiz_items = result.get("quiz", []) if isinstance(result, dict) else []
    normalized_items = _normalize_quiz_items(quiz_items)
    for item in normalized_items:
        item["difficulty"] = normalized_difficulty
    return normalized_items


def _normalize_quiz_items(items: List[Dict[str, object]]) -> List[Dict[str, object]]:
    normalized: List[Dict[str, object]] = []
    for item in items:
        if not isinstance(item, dict):
            continue

        question = str(item.get("question", "")).strip()
        options_raw = item.get("options", [])
        explanation = str(item.get("explanation", "")).strip()

        if not question or not isinstance(options_raw, list):
            continue

        options = [str(opt).strip() for opt in options_raw if str(opt).strip()]
        if len(options) < 4:
            continue
        options = options[:4]

        correct_index = _coerce_int(item.get("correct_index", 0), default=0)

        if correct_index < 0 or correct_index > 3:
            correct_index = 0

        normalized.append(
            {
                "question": question,
                "options": options,
                "correct_index": correct_index,
                "explanation": explanation or "Review related flashcards for this concept.",
            }
        )

    return normalized


def is_correct_answer(question: Dict[str, object], selected_index: int) -> bool:
    """Validate a selected option index for a quiz question object."""
    if not isinstance(question, dict):
        return False
    try:
        correct_index = _coerce_int(question.get("correct_index", -1), default=-1)
        return int(selected_index) == correct_index
    except Exception:
        return False


def _coerce_int(value: object, default: int = 0) -> int:
    if isinstance(value, bool):
        return int(value)
    if isinstance(value, int):
        return value
    if isinstance(value, float):
        return int(value)
    if isinstance(value, str):
        stripped = value.strip()
        if not stripped:
            return default
        try:
            return int(stripped)
        except ValueError:
            return default
    return default


def _normalize_difficulty(value: str) -> str:
    normalized = (value or "medium").strip().lower()
    if normalized not in {"easy", "medium", "hard"}:
        return "medium"
    return normalized
