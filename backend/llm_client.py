import logging
import os
from typing import Any, Callable

from dotenv import load_dotenv
from langchain_openai import ChatOpenAI
from pydantic import SecretStr
from tenacity import retry, retry_if_exception_type, stop_after_attempt, wait_exponential

logger = logging.getLogger(__name__)


def _load_env() -> None:
    """Load environment variables from the repository root .env file."""
    base_dir = os.path.dirname(os.path.abspath(__file__))
    env_path = os.path.join(os.path.dirname(base_dir), ".env")
    load_dotenv(env_path)


def create_llm() -> ChatOpenAI:
    """
    Build the shared chat model used by graph and chat endpoints.

    Integration notes:
    1. Set GROQ_API_KEY in .env (never hardcode keys in source).
    2. Optionally set GROQ_MODEL and LLM_TIMEOUT_SECONDS.
    """
    _load_env()
    api_key = os.getenv("GROQ_API_KEY")
    if not api_key:
        raise ValueError("Missing GROQ_API_KEY. Set it in .env before starting the backend.")

    return ChatOpenAI(
        model=os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile"),
        api_key=SecretStr(api_key),
        base_url="https://api.groq.com/openai/v1",
        temperature=float(os.getenv("LLM_TEMPERATURE", "0.2")),
        timeout=float(os.getenv("LLM_TIMEOUT_SECONDS", "45")),
        max_retries=2,
    )


@retry(
    reraise=True,
    stop=stop_after_attempt(3),
    wait=wait_exponential(multiplier=1, min=1, max=8),
    retry=retry_if_exception_type(Exception),
)
def invoke_with_retry(invoke_fn: Callable[..., Any], *args: Any, **kwargs: Any) -> Any:
    """Retry wrappers for transient LLM/provider failures."""
    return invoke_fn(*args, **kwargs)
