import os
from typing import List


DEFAULT_CORS_ORIGINS = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
]


def parse_cors_origins(raw_value: str | None) -> List[str]:
    """Parse comma-separated CORS origins from env into a clean list."""
    if not raw_value:
        return DEFAULT_CORS_ORIGINS.copy()

    origins = [item.strip() for item in raw_value.split(",") if item.strip()]
    return origins or DEFAULT_CORS_ORIGINS.copy()


def sanitize_chat_message(message: str, max_chars: int = 4000) -> str:
    """Normalize and size-limit user prompt text before LLM usage."""
    cleaned = (message or "").strip()
    if not cleaned:
        return ""
    return cleaned[:max_chars]


def upload_size_limit_bytes() -> int:
    """Maximum single-file upload size in bytes. 0 disables the limit."""
    value = os.getenv("MAX_UPLOAD_SIZE_MB", "100").strip()
    try:
        mb = int(value)
    except ValueError:
        mb = 100

    if mb <= 0:
        return 0
    return mb * 1024 * 1024
