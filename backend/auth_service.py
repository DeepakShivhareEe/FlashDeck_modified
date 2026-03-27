import os
import uuid
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import HTTPException, Request, status
from jose import JWTError, jwt
from passlib.context import CryptContext

from db import get_conn, utc_now_iso

# Prefer pbkdf2_sha256 for broad runtime compatibility; keep bcrypt for legacy hash verification.
pwd_context = CryptContext(schemes=["pbkdf2_sha256", "bcrypt"], deprecated="auto")
JWT_SECRET = os.getenv("JWT_SECRET", "change_me_in_production")
JWT_ALGORITHM = "HS256"
JWT_EXPIRE_MINUTES = int(os.getenv("JWT_EXPIRE_MINUTES", "1440"))


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(password: str, password_hash: str) -> bool:
    return pwd_context.verify(password, password_hash)


def create_access_token(user_id: str, email: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(minutes=JWT_EXPIRE_MINUTES)
    payload = {"sub": user_id, "email": email, "exp": expire}
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def register_user(email: str, password: str, display_name: str) -> dict:
    user_id = str(uuid.uuid4())
    with get_conn() as conn:
        existing = conn.execute("SELECT id FROM users WHERE email = ?", (email.lower(),)).fetchone()
        if existing:
            raise HTTPException(status_code=409, detail="Email already registered")

        conn.execute(
            "INSERT INTO users (id, email, password_hash, display_name, created_at) VALUES (?, ?, ?, ?, ?)",
            (user_id, email.lower(), hash_password(password), display_name.strip() or "User", utc_now_iso()),
        )

    token = create_access_token(user_id=user_id, email=email.lower())
    return {
        "token": token,
        "user": {
            "id": user_id,
            "email": email.lower(),
            "display_name": display_name.strip() or "User",
        },
    }


def login_user(email: str, password: str) -> dict:
    with get_conn() as conn:
        row = conn.execute(
            "SELECT id, email, password_hash, display_name FROM users WHERE email = ?",
            (email.lower(),),
        ).fetchone()

    if not row or not verify_password(password, row["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    token = create_access_token(user_id=row["id"], email=row["email"])
    return {
        "token": token,
        "user": {
            "id": row["id"],
            "email": row["email"],
            "display_name": row["display_name"],
        },
    }


def decode_token(token: str) -> Optional[dict]:
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user_id = payload.get("sub")
        email = payload.get("email")
        if not user_id:
            return None
        return {"id": user_id, "email": email}
    except JWTError:
        return None


def get_optional_user_from_request(request: Request) -> Optional[dict]:
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.lower().startswith("bearer "):
        return None
    token = auth_header.split(" ", 1)[1].strip()
    if not token:
        return None
    return decode_token(token)


def require_user_from_request(request: Request) -> dict:
    user = get_optional_user_from_request(request)
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication required")

    with get_conn() as conn:
        row = conn.execute(
            "SELECT id, email, display_name FROM users WHERE id = ?",
            (user["id"],),
        ).fetchone()
    if not row:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid user session")

    return {"id": row["id"], "email": row["email"], "display_name": row["display_name"]}
