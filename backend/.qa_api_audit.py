import json
import random
import tempfile
from pathlib import Path

import requests

BASE = "http://127.0.0.1:8001"
results = []

def add(endpoint, ok, status, note):
    results.append({"endpoint": endpoint, "pass": bool(ok), "status": status, "note": note})

def req_json(name, method, path, json_body=None, headers=None, timeout=60):
    url = f"{BASE}{path}"
    try:
        r = requests.request(method, url, json=json_body, headers=headers or {}, timeout=timeout)
        if r.ok:
            add(name, True, r.status_code, "ok")
            try:
                return r.json()
            except Exception:
                return None
        add(name, False, r.status_code, r.text[:300])
        return None
    except Exception as e:
        add(name, False, -1, str(e))
        return None

for p in ["/upload", "/generate-flashcards"]:
    try:
        r = requests.post(f"{BASE}{p}", timeout=30)
        # 422 with missing multipart field means route exists and validation is active.
        route_exists = r.status_code in (200, 400, 401, 403, 404, 405, 413, 422)
        add(p, route_exists and r.status_code != 404, r.status_code, r.text[:200])
    except Exception as e:
        add(p, False, -1, str(e))

email = f"qa_{random.randint(10000,99999)}@example.com"
signup = req_json("/auth/signup", "POST", "/auth/signup", {
    "email": email,
    "password": "StrongPass123!",
    "display_name": "QA User"
})
login = req_json("/auth/login", "POST", "/auth/login", {
    "email": email,
    "password": "StrongPass123!"
})
token = login.get("token") if isinstance(login, dict) else None
headers = {"Authorization": f"Bearer {token}"} if token else {}
req_json("/auth/me", "GET", "/auth/me", headers=headers)

cards = [
    {"q": "What is Python?", "a": "A programming language", "topic": "Programming"},
    {"q": "What is photosynthesis?", "a": "Plants convert light into energy", "topic": "Biology"},
]
for d in ["easy", "medium", "hard"]:
    req_json(f"/generate-quiz {d}", "POST", "/generate-quiz", {
        "cards": cards,
        "question_count": 3,
        "difficulty": d,
    }, timeout=90)

answers = [
    {"question": "What is Python?", "selected_index": 0, "correct_index": 0, "topic": "Programming", "explanation": "Python is a language"},
    {"question": "What is photosynthesis?", "selected_index": 1, "correct_index": 0, "topic": "Biology", "explanation": "Plants convert light"},
]
req_json("/submit-quiz", "POST", "/submit-quiz", {
    "difficulty": "medium",
    "score": 1,
    "total_questions": 2,
    "duration_seconds": 35,
    "answers": answers,
}, headers=headers)
req_json("/analytics", "GET", "/analytics", headers=headers)
req_json("/leaderboard", "GET", "/leaderboard?scope=global&limit=10")
req_json("/srs/review GET", "GET", "/srs/review?limit=10", headers=headers)
req_json("/srs/review POST", "POST", "/srs/review", {
    "question": "What is Python?",
    "answer": "A programming language",
    "topic": "Programming",
    "is_correct": True,
}, headers=headers)

try:
    r = requests.post(f"{BASE}/export", json={"deck_name": "QADeck", "format": "csv", "cards": cards}, headers=headers, timeout=60)
    ok = r.ok and ("text/csv" in r.headers.get("content-type", "") or "application/octet-stream" in r.headers.get("content-type", ""))
    add("/export csv", ok, r.status_code, f"content-type={r.headers.get('content-type','')} len={len(r.content)}")
except Exception as e:
    add("/export csv", False, -1, str(e))

try:
    tmp = Path(tempfile.gettempdir()) / f"flashdeck_qa_{random.randint(10000,99999)}.txt"
    tmp.write_text("Python is a programming language. Photosynthesis is biological process.", encoding="utf-8")
    with tmp.open("rb") as fh:
        files = {"files": (tmp.name, fh, "text/plain")}
        r = requests.post(f"{BASE}/generate", files=files, timeout=180)
    if r.ok:
        body = r.json()
        add("/generate (upload+flashcards)", bool(body.get("cards")), r.status_code, f"cards={len(body.get('cards', []))} quiz={len(body.get('quiz', []))}")
    else:
        add("/generate (upload+flashcards)", False, r.status_code, r.text[:300])
except Exception as e:
    add("/generate (upload+flashcards)", False, -1, str(e))

# Alias route upload checks with real file payload
for alias in ["/upload", "/generate-flashcards"]:
    try:
        tmp = Path(tempfile.gettempdir()) / f"flashdeck_alias_{random.randint(10000,99999)}.txt"
        tmp.write_text("FlashDeck alias route test content.", encoding="utf-8")
        with tmp.open("rb") as fh:
            files = {"files": (tmp.name, fh, "text/plain")}
            r = requests.post(f"{BASE}{alias}", files=files, timeout=180)
        if r.ok:
            body = r.json()
            add(f"{alias} multipart", bool(body.get("cards")), r.status_code, f"cards={len(body.get('cards', []))} quiz={len(body.get('quiz', []))}")
        else:
            add(f"{alias} multipart", False, r.status_code, r.text[:300])
    except Exception as e:
        add(f"{alias} multipart", False, -1, str(e))

print(json.dumps(results, indent=2))
