import json
import os
import tempfile
import urllib.error
import urllib.request
import uuid
from pathlib import Path

import fitz

BASE_URL = os.getenv("FLASHDECK_BASE_URL", "http://127.0.0.1:8001")


def _request_json(method: str, path: str, payload: dict | None = None):
    url = f"{BASE_URL}{path}"
    headers = {"Accept": "application/json"}

    body = None
    if payload is not None:
        body = json.dumps(payload).encode("utf-8")
        headers["Content-Type"] = "application/json"

    request = urllib.request.Request(url, data=body, method=method, headers=headers)
    try:
        with urllib.request.urlopen(request, timeout=120) as resp:
            return resp.status, resp.read().decode("utf-8")
    except urllib.error.HTTPError as exc:
        return exc.code, exc.read().decode("utf-8")


def _request_multipart(path: str, file_path: Path):
    boundary = f"----FlashDeckBoundary{uuid.uuid4().hex}"
    file_bytes = file_path.read_bytes()

    body = bytearray()
    body.extend(f"--{boundary}\r\n".encode("utf-8"))
    body.extend(
        f'Content-Disposition: form-data; name="files"; filename="{file_path.name}"\r\n'.encode("utf-8")
    )
    body.extend(b"Content-Type: application/pdf\r\n\r\n")
    body.extend(file_bytes)
    body.extend(f"\r\n--{boundary}--\r\n".encode("utf-8"))

    headers = {
        "Content-Type": f"multipart/form-data; boundary={boundary}",
        "Accept": "application/json",
    }
    req = urllib.request.Request(f"{BASE_URL}{path}", data=bytes(body), method="POST", headers=headers)

    try:
        with urllib.request.urlopen(req, timeout=240) as resp:
            return resp.status, resp.read().decode("utf-8")
    except urllib.error.HTTPError as exc:
        return exc.code, exc.read().decode("utf-8")


def _create_sample_pdf(file_path: Path):
    doc = fitz.open()
    page = doc.new_page()
    page.insert_text((72, 72), "FlashDeck sample content. France capital is Paris. HTTP 200 means success.")
    doc.save(file_path)
    doc.close()


def _test_home():
    print("[TEST] GET /")
    code, body = _request_json("GET", "/")
    ok = code == 200 and "FlashDeck" in body
    print(f"  status={code}; result={'PASS' if ok else 'FAIL'}")
    return ok


def _test_health():
    print("[TEST] GET /health")
    code, body = _request_json("GET", "/health")
    payload = json.loads(body)
    ok = code == 200 and payload.get("status") in {"healthy", "degraded"}
    print(f"  status={code}; payload_status={payload.get('status')}; result={'PASS' if ok else 'FAIL'}")
    return ok


def _test_chat_empty():
    print("[TEST] POST /chat with empty message")
    code, _ = _request_json("POST", "/chat", {"message": "   ", "deck_id": "test"})
    ok = code == 400
    print(f"  status={code}; result={'PASS' if ok else 'FAIL'}")
    return ok


def _test_chat_valid():
    print("[TEST] POST /chat valid")
    code, body = _request_json("POST", "/chat", {"message": "What is FlashDeck?", "deck_id": "test"})
    payload = json.loads(body)
    ok = code == 200 and isinstance(payload.get("answer"), str) and len(payload.get("answer", "")) > 0
    print(f"  status={code}; answer_len={len(payload.get('answer', ''))}; result={'PASS' if ok else 'FAIL'}")
    return ok


def _test_generate_with_quiz():
    print("[TEST] POST /generate with sample PDF")
    with tempfile.TemporaryDirectory() as tmp:
        pdf_path = Path(tmp) / "sample.pdf"
        _create_sample_pdf(pdf_path)
        code, body = _request_multipart("/generate", pdf_path)

    payload = json.loads(body)
    quiz = payload.get("quiz", []) if isinstance(payload.get("quiz", []), list) else []
    quiz_ok = True
    if quiz:
        q0 = quiz[0]
        quiz_ok = (
            isinstance(q0, dict)
            and isinstance(q0.get("question"), str)
            and isinstance(q0.get("options"), list)
            and len(q0.get("options", [])) == 4
            and isinstance(q0.get("correct_index"), int)
            and isinstance(q0.get("explanation"), str)
        )

    ok = (
        code == 200
        and payload.get("status") == "success"
        and isinstance(payload.get("cards"), list)
        and "deck_id" in payload
        and quiz_ok
    )
    print(f"  status={code}; cards={len(payload.get('cards', []))}; quiz={len(quiz)}; result={'PASS' if ok else 'FAIL'}")
    return ok


def main():
    tests = [
        _test_home,
        _test_health,
        _test_chat_empty,
        _test_chat_valid,
        _test_generate_with_quiz,
    ]

    passed = 0
    for test in tests:
        try:
            if test():
                passed += 1
        except Exception as exc:
            print(f"  result=FAIL; exception={exc}")

    print("\n=== Summary ===")
    print(f"Passed: {passed}/{len(tests)}")
    if passed != len(tests):
        raise SystemExit(1)


if __name__ == "__main__":
    main()
