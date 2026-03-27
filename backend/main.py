import logging
import os
import re
import time
import uuid
import tempfile
from typing import List, Optional

from fastapi import FastAPI, File, HTTPException, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.responses import FileResponse
from langchain_core.output_parsers import StrOutputParser
from langchain_core.prompts import ChatPromptTemplate
from pydantic import BaseModel, EmailStr, Field

from auth_service import get_optional_user_from_request, login_user, register_user, require_user_from_request
from config import parse_cors_origins, sanitize_chat_message, upload_size_limit_bytes
from deck_builder import create_anki_deck
from db import init_db
from file_extractor import ALLOWED_EXTENSIONS, extract_content_from_bytes
from learning_service import (
    ensure_deck_saved,
    export_flashcards_csv,
    export_flashcards_pdf,
    get_deck_cards,
    get_due_reviews,
    get_leaderboard,
    get_user_analytics,
    record_quiz_attempt,
    update_srs_for_answer,
)
from llm_client import invoke_with_retry
from quiz_engine import generate_quiz_from_material
from rag_engine import query_vector_db

logging.basicConfig(
    level=os.getenv("LOG_LEVEL", "INFO"),
    format="%(asctime)s %(levelname)s %(name)s - %(message)s",
)
logger = logging.getLogger(__name__)

app = FastAPI(title="FlashDeck AI API")


@app.middleware("http")
async def request_log_middleware(request: Request, call_next):
    started_at = time.perf_counter()
    try:
        response = await call_next(request)
    except Exception:
        elapsed_ms = (time.perf_counter() - started_at) * 1000
        logger.exception("%s %s -> exception (%.2f ms)", request.method, request.url.path, elapsed_ms)
        raise

    elapsed_ms = (time.perf_counter() - started_at) * 1000
    logger.info("%s %s -> %s (%.2f ms)", request.method, request.url.path, response.status_code, elapsed_ms)
    return response


@app.on_event("startup")
def _startup() -> None:
    init_db()
    logger.info("Application database initialized")

allowed_origins = parse_cors_origins(os.getenv("CORS_ALLOW_ORIGINS"))
allow_credentials = os.getenv("CORS_ALLOW_CREDENTIALS", "false").lower() == "true"

# Allow CORS for React Frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=allow_credentials,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def home():
    return {"status": "FlashDeck Brain is Online 🧠", "version": "v3.0.0"}

@app.get("/health")
async def health_check():
    # 1. Check RAG Engine
    from rag_engine import check_health
    rag_status = check_health()
    
    status = "healthy" if rag_status else "degraded"
    
    return {
        "status": status,
        "components": {
            "rag_engine": "online" if rag_status else "offline",
            "llm_api": "connected" # Assumed if app is running
        }
    }

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.exception("Unhandled error on %s", request.url.path)
    debug_mode = os.getenv("DEBUG", "false").lower() == "true"
    return JSONResponse(
        status_code=500,
        content={
            "message": "Internal Server Error",
            "detail": str(exc) if debug_mode else "Unexpected server failure",
        },
    )

@app.post("/generate")
async def generate_deck(request: Request, files: List[UploadFile] = File(...)):
    logger.info("Processing %s uploaded file(s)", len(files))
    deck_id = str(uuid.uuid4())
    max_upload_size = upload_size_limit_bytes()
    user = get_optional_user_from_request(request)
    
    try:
        # 1. Analyze Documents
        all_content = []
        is_vision_mode = False
        
        for file in files:
            filename = file.filename or "unnamed.pdf"
            ext = _get_extension(filename)
            if ext not in ALLOWED_EXTENSIONS:
                allowed_str = ", ".join(sorted(ALLOWED_EXTENSIONS))
                raise HTTPException(status_code=400, detail=f"Unsupported file type for {filename}. Allowed: {allowed_str}")

            raw = await _read_upload_bytes(file, max_upload_size)
            if not raw:
                raise HTTPException(status_code=400, detail=f"Uploaded file is empty: {filename}")

            try:
                result_payload = extract_content_from_bytes(filename, raw)
                content = result_payload["content"]
                mode = result_payload["mode"]
                
                if mode == "image":
                    is_vision_mode = True
                    # If any file is vision, we might treat all as vision or mix.
                    # Current Graph expects explicit mode. 
                    # If we mix, we should probably normalize to text if possible, or list of images.
                    # For simplicty: If Vision mode, we extend list of images.
                    # If text mode, we extend list of text strings?
                    if isinstance(content, list): 
                        all_content.extend(content)
                    else:
                        # Convert text to image? No.
                        # Conflict handling:
                        logger.warning("Mixed content types detected for %s; ignoring incompatible payload", filename)
                else:
                    # Text Mode
                    if isinstance(content, str):
                        all_content.append(content)
                
            except Exception as e:
                logger.exception("Failed processing file %s", filename)
                # We continue with other files? Or fail?
                # Fail for now to be safe
                raise HTTPException(status_code=400, detail=f"File Read Failed: {filename} - {e}")

        # Normalize content for Graph
        # If is_vision_mode, all_content should be list of b64.
        # If text mode, all_content is List[str].
        # But Graph expects `original_text` as Union[str, List[str]].
        # If it's a List[str] (Text Mode), the chunker handles it?
        # Let's see agent_graph.py:88: text = str(content) -> join list?
        
        final_input_content = all_content
        if not is_vision_mode:
            # Join text modules with newlines
            final_input_content = "\n\n".join(all_content)
            
        logger.info("Combined content size metric: %s", len(final_input_content))

        # 2. Run Multi-Agent Graph
        from agent_graph import app_graph
        try:
            inputs = {
                "original_text": final_input_content, 
                "partial_cards": [], 
                "final_cards": [],
                "deck_id": deck_id,
                "flowcharts": [],
                "transcriptions": [],
            }
            result = app_graph.invoke(inputs)
            cards_data = result.get("final_cards", [])
            flowcharts = _sanitize_flowcharts(result.get("flowcharts", []))
            
            # Normalize
            cards = []
            for c in cards_data:
                if isinstance(c, dict):
                    cards.append({"q": c.get("q", ""), "a": c.get("a", "")})
                else:
                    cards.append({"q": c.q, "a": c.a})
                    
        except Exception as e:
            logger.exception("Agent graph failed")
            raise HTTPException(status_code=500, detail=f"Agent Processing Failed: {str(e)}")

        source_text = final_input_content if isinstance(final_input_content, str) else "\n".join(
            [c.get("a", "") for c in cards if isinstance(c, dict)]
        )

        if not cards:
            logger.warning("Agent pipeline returned no cards; using fallback flashcard generation")
            cards = _fallback_flashcards_from_text(source_text)

        if not flowcharts:
            logger.warning("Agent pipeline returned no flowcharts; using fallback flowchart generation")
            flowcharts = [_fallback_flowchart_from_text(source_text)]

        logger.info("Agents finished; generated %s cards", len(cards))

        # 3. Generate quiz questions from same learning material.
        quiz = []
        try:
            quiz = generate_quiz_from_material(cards=cards, source_text=source_text, question_count=10)
            logger.info("Generated %s quiz question(s)", len(quiz))
        except Exception:
            logger.exception("Quiz generation failed; returning flashcards only")

        # 4. Create Anki Deck
        deck_name = f"FlashDeck_{deck_id[:8]}" 
        output_file = create_anki_deck(cards, deck_name=deck_name)

        # Persist cards for analytics/export/SRS endpoints without changing response shape.
        try:
            ensure_deck_saved(
                deck_id=deck_id,
                deck_name=deck_name,
                cards=cards,
                user_id=user["id"] if user else None,
            )
        except Exception:
            logger.exception("Deck persistence failed for deck_id=%s", deck_id)
        
        # 5. Return Output
        return {
            "status": "success",
            "deck_name": deck_name,
            "deck_id": deck_id,
            "cards": cards,
            "quiz": quiz,
            "difficulty": "medium",
            "flowcharts": flowcharts,
            "download_path": output_file
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Unexpected generate error")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/upload")
async def upload_files(request: Request, files: List[UploadFile] = File(...)):
    """Backward-compatible alias for clients that call /upload."""
    return await generate_deck(request, files)


@app.post("/generate-flashcards")
async def generate_flashcards(request: Request, files: List[UploadFile] = File(...)):
    """Backward-compatible alias for clients that call /generate-flashcards."""
    return await generate_deck(request, files)


@app.post("/generate-flowchart")
async def generate_flowchart(request: Request, files: List[UploadFile] = File(...)):
    """Backward-compatible alias for clients that call /generate-flowchart."""
    result = await generate_deck(request, files)
    return {
        "status": result.get("status", "success"),
        "deck_name": result.get("deck_name", ""),
        "deck_id": result.get("deck_id"),
        "flowcharts": result.get("flowcharts", []),
        "cards": result.get("cards", []),
    }

class ChatRequest(BaseModel):
    message: str
    deck_id: Optional[str] = None


class AuthSignupRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    display_name: str = Field(default="User", min_length=1, max_length=80)


class AuthLoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)


class QuizGenerateRequest(BaseModel):
    deck_id: Optional[str] = None
    cards: List[dict] = Field(default_factory=list)
    source_text: str = ""
    question_count: int = Field(default=10, ge=1, le=30)
    difficulty: str = Field(default="medium")


class QuizSubmitRequest(BaseModel):
    deck_id: Optional[str] = None
    difficulty: str = Field(default="medium")
    score: int = Field(ge=0)
    total_questions: int = Field(ge=1)
    duration_seconds: int = Field(default=0, ge=0)
    answers: List[dict] = Field(default_factory=list)


class ExportRequest(BaseModel):
    deck_id: Optional[str] = None
    deck_name: str = "FlashDeck"
    cards: List[dict] = Field(default_factory=list)
    format: str = Field(default="csv")


class SRSReviewSubmitRequest(BaseModel):
    deck_id: Optional[str] = None
    question: str
    answer: str
    topic: str = "General"
    is_correct: bool

@app.post("/chat")
async def chat_with_deck(req: ChatRequest):
    try:
        message = sanitize_chat_message(req.message)
        if not message:
            raise HTTPException(status_code=400, detail="Message cannot be empty")

        logger.info("Received chat query for deck %s", req.deck_id)
        logger.info("Retrieving contextual chunks")
        
        # 1. Retrieve Context
        docs = query_vector_db(message, req.deck_id)
        logger.info("Retrieved %s relevant chunk(s)", len(docs))
        context_text = "\n\n".join([d.page_content for d in docs])
        
        if not context_text:
            context_text = "No relevant context found in the uploaded documents."
            
        # 2. Generate Answer
        from agent_graph import llm
        
        prompt = ChatPromptTemplate.from_template("""
        You are FlashDeck AI Tutor.
        Answer the user's question using ONLY the provided context from their documents.
        Keep the reply concise, direct, and professional.
        Do NOT add any preface, disclaimer, or extra sections.
        If context is insufficient, say so in one short sentence.
        Limit response to 40-80 words.

        Context:
        {context}

        Question (quoted user input): "{question}"

        Answer (Concise and helpful):
        """)
        
        chain = prompt | llm | StrOutputParser()
        logger.info("Generating chat answer via LLM")
        started_at = time.perf_counter()
        try:
            answer = invoke_with_retry(chain.invoke, {"context": context_text, "question": message})
            elapsed_ms = (time.perf_counter() - started_at) * 1000
            logger.info("Answer generated")
            logger.info("Chat LLM latency: %.2f ms", elapsed_ms)
        except Exception as llm_err:
            err_text = str(llm_err).lower()
            if "rate limit" in err_text or "429" in err_text or "timeout" in err_text:
                logger.warning("Chat fallback triggered due to upstream issue: %s", llm_err)
                answer = _fallback_chat_answer(message=message, context_text=context_text)
            else:
                raise
        
        return {"answer": answer, "sources": [d.metadata.get("source", "unknown") for d in docs]}
        
    except HTTPException:
        raise
    except Exception as e:
        err_text = str(e).lower()
        if "rate limit" in err_text or "429" in err_text:
            raise HTTPException(status_code=429, detail="Upstream model rate limited the request")
        if "timeout" in err_text:
            raise HTTPException(status_code=504, detail="Upstream model request timed out")
        logger.exception("Chat endpoint failed")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/auth/signup")
def auth_signup(req: AuthSignupRequest):
    return register_user(email=req.email, password=req.password, display_name=req.display_name)


@app.post("/auth/login")
def auth_login(req: AuthLoginRequest):
    return login_user(email=req.email, password=req.password)


@app.get("/auth/me")
def auth_me(request: Request):
    user = require_user_from_request(request)
    return {"user": user}


@app.post("/generate-quiz")
def generate_quiz(req: QuizGenerateRequest):
    try:
        cards = req.cards
        source_text = req.source_text

        if req.deck_id and not cards:
            cards = get_deck_cards(req.deck_id)
            if not cards:
                raise HTTPException(status_code=404, detail="Deck not found or has no cards")

        if not source_text and cards:
            source_text = "\n".join(str(card.get("a", "")) for card in cards)

        if not cards and not source_text:
            raise HTTPException(status_code=400, detail="Provide deck_id or cards/source_text to generate quiz")

        quiz = generate_quiz_from_material(
            cards=cards,
            source_text=source_text,
            question_count=req.question_count,
            difficulty=req.difficulty,
        )
        normalized_difficulty = (req.difficulty or "medium").strip().lower()
        if normalized_difficulty not in {"easy", "medium", "hard"}:
            normalized_difficulty = "medium"

        return {"status": "success", "difficulty": normalized_difficulty, "quiz": quiz}
    except HTTPException:
        raise
    except Exception as e:
        err_text = str(e).lower()
        if "rate limit" in err_text or "429" in err_text:
            raise HTTPException(status_code=429, detail="Upstream model rate limited the request")
        if "timeout" in err_text:
            raise HTTPException(status_code=504, detail="Upstream model request timed out")
        logger.exception("Quiz generation endpoint failed")
        raise HTTPException(status_code=500, detail="Quiz generation failed")


@app.post("/submit-quiz")
def submit_quiz(req: QuizSubmitRequest, request: Request):
    user = get_optional_user_from_request(request)
    user_id = user["id"] if user else None

    attempt_id = record_quiz_attempt(
        user_id=user_id,
        deck_id=req.deck_id,
        difficulty=req.difficulty,
        score=req.score,
        total_questions=req.total_questions,
        duration_seconds=req.duration_seconds,
        answers=req.answers,
    )

    # If a user is authenticated, update SRS scheduling from submitted answers.
    srs_updates = []
    if user_id:
        for answer in req.answers:
            try:
                selected = int(answer.get("selected_index", -1))
            except (TypeError, ValueError):
                selected = -1
            try:
                correct = int(answer.get("correct_index", -2))
            except (TypeError, ValueError):
                correct = -2
            update = update_srs_for_answer(
                user_id=user_id,
                deck_id=req.deck_id,
                question=str(answer.get("question", "")),
                answer=str(answer.get("answer", answer.get("explanation", ""))),
                topic=str(answer.get("topic", "General")),
                is_correct=selected == correct,
            )
            srs_updates.append(update)

    return {
        "status": "success",
        "attempt_id": attempt_id,
        "recorded": True,
        "srs_updates": srs_updates,
    }


@app.get("/analytics")
def analytics(request: Request):
    user = require_user_from_request(request)
    data = get_user_analytics(user["id"])
    return {"status": "success", "analytics": data}


@app.get("/leaderboard")
def leaderboard(scope: str = "global", limit: int = 20):
    return {
        "status": "success",
        "scope": scope,
        "rows": get_leaderboard(scope=scope, limit=max(1, min(limit, 100))),
    }


@app.post("/export")
def export_flashcards(req: ExportRequest, request: Request):
    cards = req.cards
    if req.deck_id and not cards:
        cards = get_deck_cards(req.deck_id)
    if not cards:
        raise HTTPException(status_code=400, detail="No flashcards available to export")

    export_format = req.format.strip().lower()
    if export_format not in {"csv", "pdf", "anki"}:
        raise HTTPException(status_code=400, detail="Unsupported export format. Use csv, pdf, or anki")

    if export_format == "csv":
        payload = export_flashcards_csv(cards)
        suffix = ".csv"
        media_type = "text/csv"
        tmp = tempfile.NamedTemporaryFile(delete=False, suffix=suffix)
        tmp.write(payload)
        tmp.flush()
        tmp.close()
    elif export_format == "pdf":
        payload = export_flashcards_pdf(req.deck_name, cards)
        suffix = ".pdf"
        media_type = "application/pdf"
        tmp = tempfile.NamedTemporaryFile(delete=False, suffix=suffix)
        tmp.write(payload)
        tmp.flush()
        tmp.close()
    else:
        tmp = tempfile.NamedTemporaryFile(delete=False, suffix=".apkg")
        tmp.close()
        create_anki_deck(cards, deck_name=req.deck_name, output_filename=tmp.name)
        suffix = ".apkg"
        media_type = "application/octet-stream"

    file_name = f"{req.deck_name.replace(' ', '_')}{suffix}"
    return FileResponse(path=tmp.name, media_type=media_type, filename=file_name)


@app.get("/srs/review")
def srs_review(request: Request, limit: int = 30):
    user = require_user_from_request(request)
    due = get_due_reviews(user_id=user["id"], limit=max(1, min(limit, 200)))
    return {"status": "success", "count": len(due), "items": due}


@app.post("/srs/review")
def srs_submit_review(req: SRSReviewSubmitRequest, request: Request):
    user = require_user_from_request(request)
    update = update_srs_for_answer(
        user_id=user["id"],
        deck_id=req.deck_id,
        question=req.question,
        answer=req.answer,
        topic=req.topic,
        is_correct=req.is_correct,
    )
    return {"status": "success", "update": update}


def _get_extension(filename: str) -> str:
    idx = filename.rfind(".")
    return filename[idx:].lower() if idx != -1 else ""


def _fallback_flashcards_from_text(text: str, max_cards: int = 12) -> List[dict]:
    sentences = [s.strip() for s in re.split(r"(?<=[.!?])\s+", text or "") if len(s.strip()) >= 20]
    cards = []
    for idx, sentence in enumerate(sentences[:max_cards], start=1):
        cards.append({
            "q": f"Key concept {idx}: what should you remember?",
            "a": sentence,
            "topic": "General",
        })
    if not cards:
        cards.append(
            {
                "q": "What is the main idea in this document?",
                "a": (text or "No extractable content found.")[:300],
                "topic": "General",
            }
        )
    return cards


def _fallback_flowchart_from_text(text: str) -> str:
    sentences = [s.strip() for s in re.split(r"(?<=[.!?])\s+", text or "") if s.strip()]
    steps = sentences[:4] if sentences else ["Document uploaded", "Text extracted", "Insights generated", "Review output"]
    labels = [re.sub(r"[^\w\s-]", "", step)[:40] or "Step" for step in steps]
    lines = ["graph TD"]
    for idx, label in enumerate(labels, start=1):
        node = chr(64 + idx)
        lines.append(f"    {node}[{label}]")
    for idx in range(1, len(labels)):
        left = chr(64 + idx)
        right = chr(64 + idx + 1)
        lines.append(f"    {left} --> {right}")
    return "\n".join(lines)


def _sanitize_flowcharts(raw_flowcharts) -> List[str]:
    if isinstance(raw_flowcharts, str):
        flowcharts = [raw_flowcharts]
    elif isinstance(raw_flowcharts, list):
        flowcharts = raw_flowcharts
    else:
        flowcharts = []

    cleaned = []
    for chart in flowcharts:
        if not isinstance(chart, str):
            continue
        code = chart.replace("\r", "").strip()
        code = re.sub(r"^```(?:mermaid)?\s*", "", code, flags=re.IGNORECASE)
        code = re.sub(r"\s*```$", "", code, flags=re.IGNORECASE)
        code = re.sub(r"<\/?p>", " ", code, flags=re.IGNORECASE)
        code = re.sub(r"<br\s*/?>", " ", code, flags=re.IGNORECASE)
        # Fix empty node labels like A[] that render as blank boxes.
        step_counter = 1
        def _fill_empty_label(match):
            nonlocal step_counter
            node = match.group(1)
            label = f"Step {step_counter}"
            step_counter += 1
            return f"{node}[{label}]"
        code = re.sub(r"\b([A-Za-z0-9_]+)\[\s*\]", _fill_empty_label, code)
        if not re.match(r"^(graph|flowchart|sequenceDiagram|classDiagram|stateDiagram|erDiagram|journey|gantt|pie|mindmap|timeline|gitGraph)\b", code, flags=re.IGNORECASE):
            continue
        cleaned.append(code)

    # Deduplicate while preserving order.
    if cleaned:
        return list(dict.fromkeys(cleaned))

    return [_fallback_flowchart_from_text("Document uploaded. Content extracted. Insights generated. Review results.")]


def _fallback_chat_answer(message: str, context_text: str) -> str:
    context_preview = (context_text or "").strip()
    if not context_preview:
        return "I could not find enough relevant context in your uploaded document to answer this precisely."

    snippets = _extract_relevant_snippets(message, context_preview, limit=2)
    if not snippets:
        snippets = [context_preview[:180].strip()]

    concise = " ".join(snippets)
    concise = re.sub(r"\s+", " ", concise).strip()
    if len(concise) > 260:
        concise = concise[:257].rstrip() + "..."
    return concise


def _extract_relevant_snippets(question: str, context_text: str, limit: int = 2) -> List[str]:
    sentences = [s.strip() for s in re.split(r"(?<=[.!?])\s+", context_text or "") if s.strip()]
    if not sentences:
        return []

    tokens = set(re.findall(r"[a-zA-Z0-9]+", (question or "").lower()))
    stop = {
        "the", "is", "are", "a", "an", "of", "to", "in", "on", "for", "and", "or", "with", "what", "how", "why",
        "when", "where", "which", "who", "whom", "this", "that", "it", "as", "at", "by", "from",
    }
    keywords = {t for t in tokens if t not in stop and len(t) > 2}

    def score(sentence: str) -> int:
        words = set(re.findall(r"[a-zA-Z0-9]+", sentence.lower()))
        return len(words & keywords)

    ranked = sorted(sentences, key=lambda s: (score(s), len(s)), reverse=True)
    picked = [s for s in ranked if score(s) > 0][:limit]
    return picked


async def _read_upload_bytes(file: UploadFile, max_size_bytes: int) -> bytes:
    """Read upload content in chunks to handle large files safely."""
    chunk_size = 1024 * 1024
    buffer = bytearray()

    while True:
        chunk = await file.read(chunk_size)
        if not chunk:
            break

        buffer.extend(chunk)
        if max_size_bytes > 0 and len(buffer) > max_size_bytes:
            max_mb = max_size_bytes // (1024 * 1024)
            raise HTTPException(
                status_code=413,
                detail=f"File too large ({file.filename}). Max allowed is {max_mb} MB. Set MAX_UPLOAD_SIZE_MB=0 to disable limit.",
            )

    return bytes(buffer)


