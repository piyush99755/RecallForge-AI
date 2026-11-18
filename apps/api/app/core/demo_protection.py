import base64
import hashlib
import hmac
import json
import secrets
import threading
import time
import uuid
from collections import deque
from dataclasses import dataclass
from typing import Any, Callable

from fastapi import Depends, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import Settings, get_settings
from app.db.models import ConceptProgress
from app.learning.progress import calculate_mastery_level

DEMO_TOKEN_PREFIX = "rfdemo"
DEFAULT_DEMO_SESSION_TTL_SECONDS = 2700  # 45 minutes
MAX_DEMO_SESSION_TTL_SECONDS = 3600      # 60 minutes


def _b64url_encode(raw: bytes) -> str:
    return base64.urlsafe_b64encode(raw).rstrip(b"=").decode("ascii")


def _b64url_decode(encoded: str) -> bytes:
    padding = "=" * ((4 - len(encoded) % 4) % 4)
    return base64.urlsafe_b64decode((encoded + padding).encode("ascii"))


def issue_demo_session_token(
    signing_secret: str,
    ttl_seconds: int = DEFAULT_DEMO_SESSION_TTL_SECONDS,
    now_ts: int | None = None,
) -> dict[str, Any]:
    """
    Creates a short-lived HMAC-SHA256 signed demo session token.
    Never embeds any server secrets inside the token payload.
    """
    if not signing_secret or not signing_secret.strip():
        raise ValueError("DEMO_SESSION_SIGNING_SECRET must be non-empty.")

    effective_ttl = max(60, min(int(ttl_seconds), MAX_DEMO_SESSION_TTL_SECONDS))
    issued_at = int(now_ts if now_ts is not None else time.time())
    expires_at = issued_at + effective_ttl

    payload = {
        "mode": "demo",
        "scope": "employer-demo",
        "iat": issued_at,
        "exp": expires_at,
        "jti": secrets.token_hex(8),
    }

    payload_bytes = json.dumps(
        payload, separators=(",", ":"), sort_keys=True
    ).encode("utf-8")
    payload_b64 = _b64url_encode(payload_bytes)
    signing_input = f"{DEMO_TOKEN_PREFIX}.{payload_b64}".encode("ascii")

    signature = hmac.new(
        signing_secret.strip().encode("utf-8"),
        signing_input,
        hashlib.sha256,
    ).digest()
    sig_b64 = _b64url_encode(signature)

    token = f"{DEMO_TOKEN_PREFIX}.{payload_b64}.{sig_b64}"
    return {
        "token": token,
        "expires_at": expires_at,
        "expires_in": effective_ttl,
        "claims": payload,
    }


def verify_demo_session_token(
    token: str,
    signing_secret: str,
    now_ts: float | None = None,
) -> dict[str, Any]:
    """
    Verifies a short-lived HMAC-SHA256 demo session token.
    Raises HTTPException(401) if malformed, tampered, wrong scope/mode, or expired.
    """
    if not signing_secret or not signing_secret.strip():
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Demo session signing secret is not configured.",
        )

    parts = (token or "").strip().split(".")
    if len(parts) != 3 or parts[0] != DEMO_TOKEN_PREFIX:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid demo session. Please start a new session.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    _, payload_b64, sig_b64 = parts
    signing_input = f"{DEMO_TOKEN_PREFIX}.{payload_b64}".encode("ascii")
    expected_sig = hmac.new(
        signing_secret.strip().encode("utf-8"),
        signing_input,
        hashlib.sha256,
    ).digest()

    try:
        provided_sig = _b64url_decode(sig_b64)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid demo session. Please start a new session.",
            headers={"WWW-Authenticate": "Bearer"},
        ) from exc

    if not secrets.compare_digest(provided_sig, expected_sig):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid demo session. Please start a new session.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    try:
        payload_raw = _b64url_decode(payload_b64)
        claims = json.loads(payload_raw.decode("utf-8"))
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid demo session. Please start a new session.",
            headers={"WWW-Authenticate": "Bearer"},
        ) from exc

    if (
        not isinstance(claims, dict)
        or claims.get("mode") != "demo"
        or claims.get("scope") != "employer-demo"
    ):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid demo session scope.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    exp = claims.get("exp")
    iat = claims.get("iat")
    if not isinstance(exp, (int, float)) or not isinstance(iat, (int, float)):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid demo session expiration.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if exp - iat > MAX_DEMO_SESSION_TTL_SECONDS + 60:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid demo session lifetime.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    current_time = float(now_ts if now_ts is not None else time.time())
    if current_time >= float(exp):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Demo session expired — start a new session.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return claims


# =====================================================================
# In-Process Sliding-Window Rate Limiter for Demo Mode
# =====================================================================


class DemoRateLimiter:
    """
    Lightweight, thread-safe in-process sliding-window rate limiter for Public Demo Mode.
    Note: Instance-local per worker process (suitable for single-instance Render demo MVP).
    """

    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._buckets: dict[tuple[str, str], deque[float]] = {}

    def reset(self) -> None:
        with self._lock:
            self._buckets.clear()

    def check_and_record(
        self,
        bucket: str,
        client_key: str,
        max_requests: int,
        window_seconds: int,
        now_ts: float | None = None,
    ) -> None:
        now = float(now_ts if now_ts is not None else time.time())
        cutoff = now - float(window_seconds)
        key = (bucket, client_key)

        with self._lock:
            q = self._buckets.get(key)
            if q is None:
                q = deque()
                self._buckets[key] = q

            while q and q[0] <= cutoff:
                q.popleft()

            if len(q) >= max_requests:
                retry_after = max(1, int(q[0] + window_seconds - now))
                raise HTTPException(
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    detail=(
                        f"Demo rate limit reached ({max_requests} requests per "
                        f"{max(1, window_seconds // 60)} minutes). Please wait a moment and try again."
                    ),
                    headers={"Retry-After": str(retry_after)},
                )

            q.append(now)


demo_rate_limiter = DemoRateLimiter()


def extract_client_ip(request: Request | None) -> str:
    if request is None:
        return "local"
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        first_hop = forwarded.split(",")[0].strip()
        if first_hop:
            return first_hop
    if request.client and request.client.host:
        return request.client.host
    return "unknown"


def extract_bearer_jti(request: Request | None) -> str | None:
    if request is None:
        return None
    auth_header = request.headers.get("authorization") or ""
    if not auth_header.lower().startswith("bearer "):
        return None
    token = auth_header[7:].strip()
    parts = token.split(".")
    if len(parts) != 3 or parts[0] != DEMO_TOKEN_PREFIX:
        return None
    try:
        claims = json.loads(_b64url_decode(parts[1]).decode("utf-8"))
        jti = claims.get("jti")
        return str(jti) if jti else None
    except Exception:
        return None


def enforce_demo_rate_limit(
    bucket: str,
    max_requests: int,
    window_seconds: int = 600,
    request: Request | None = None,
    settings: Settings | None = None,
) -> None:
    active_settings = settings or get_settings()
    if not active_settings.is_demo_mode:
        return

    ip_key = f"ip:{extract_client_ip(request)}"
    demo_rate_limiter.check_and_record(
        bucket=bucket,
        client_key=ip_key,
        max_requests=max_requests,
        window_seconds=window_seconds,
    )

    jti = extract_bearer_jti(request)
    if jti:
        demo_rate_limiter.check_and_record(
            bucket=bucket,
            client_key=f"jti:{jti}",
            max_requests=max_requests,
            window_seconds=window_seconds,
        )


def rate_limit_demo_endpoint(
    bucket: str,
    max_requests: int,
    window_seconds: int = 600,
) -> Callable[..., None]:
    def _dependency(
        request: Request,
        settings: Settings = Depends(get_settings),
    ) -> None:
        enforce_demo_rate_limit(
            bucket=bucket,
            max_requests=max_requests,
            window_seconds=window_seconds,
            request=request,
            settings=settings,
        )

    return _dependency


def require_active_demo_session_jti(
    request: Request | None,
    settings: Settings | None = None,
) -> str:
    """
    Extracts and cryptographically verifies the active demo session Bearer token
    from the request, returning its unique session `jti`.
    Raises 401 if missing, invalid, or expired.
    """
    active_settings = settings or get_settings()
    if request is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Demo session is required.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    auth_header = (request.headers.get("authorization") or "").strip()
    if not auth_header.lower().startswith("bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Demo session is required.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    raw_token = auth_header[7:].strip()
    claims = verify_demo_session_token(
        token=raw_token,
        signing_secret=active_settings.demo_session_signing_secret or "",
    )
    jti = str(claims.get("jti") or "").strip()
    if not jti:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid demo session identifier.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return jti


# =====================================================================
# Ephemeral In-Memory Demo Challenge Store (Protects Shared DB State)
# =====================================================================


@dataclass
class EphemeralDemoChallenge:
    id: uuid.UUID
    owner_jti: str
    project_id: uuid.UUID | None
    document_id: uuid.UUID | None
    topic: str
    concept: str
    question: str
    expected_answer: str
    explanation: str
    created_at_ts: float


_EPHEMERAL_LOCK = threading.Lock()
_EPHEMERAL_CHALLENGES: dict[uuid.UUID, EphemeralDemoChallenge] = {}
MAX_EPHEMERAL_CHALLENGES = 500


def store_ephemeral_demo_challenge(
    *,
    owner_jti: str,
    project_id: uuid.UUID | None,
    document_id: uuid.UUID | None,
    topic: str,
    concept: str,
    question: str,
    expected_answer: str,
    explanation: str,
) -> EphemeralDemoChallenge:
    cleaned_jti = (owner_jti or "").strip()
    if not cleaned_jti:
        raise ValueError("owner_jti is required when storing an ephemeral demo challenge.")

    now = time.time()
    entry = EphemeralDemoChallenge(
        id=uuid.uuid4(),
        owner_jti=cleaned_jti,
        project_id=project_id,
        document_id=document_id,
        topic=topic,
        concept=concept,
        question=question,
        expected_answer=expected_answer,
        explanation=explanation,
        created_at_ts=now,
    )
    with _EPHEMERAL_LOCK:
        # Evict expired entries (> 60 minutes) or oldest if at capacity
        expired_ids = [
            cid
            for cid, item in _EPHEMERAL_CHALLENGES.items()
            if now - item.created_at_ts > MAX_DEMO_SESSION_TTL_SECONDS
        ]
        for cid in expired_ids:
            _EPHEMERAL_CHALLENGES.pop(cid, None)

        while len(_EPHEMERAL_CHALLENGES) >= MAX_EPHEMERAL_CHALLENGES:
            oldest_id = next(iter(_EPHEMERAL_CHALLENGES))
            _EPHEMERAL_CHALLENGES.pop(oldest_id, None)

        _EPHEMERAL_CHALLENGES[entry.id] = entry

    return entry


def get_ephemeral_demo_challenge(
    challenge_id: uuid.UUID,
    owner_jti: str,
) -> EphemeralDemoChallenge | None:
    cleaned_jti = (owner_jti or "").strip()
    if not cleaned_jti:
        return None

    with _EPHEMERAL_LOCK:
        entry = _EPHEMERAL_CHALLENGES.get(challenge_id)
        if entry is None:
            return None
        if time.time() - entry.created_at_ts > MAX_DEMO_SESSION_TTL_SECONDS:
            _EPHEMERAL_CHALLENGES.pop(challenge_id, None)
            return None
        if not secrets.compare_digest(
            entry.owner_jti.encode("utf-8"),
            cleaned_jti.encode("utf-8"),
        ):
            return None
        return entry


def preview_demo_concept_progress(
    db: Session,
    project_id: uuid.UUID | None,
    document_id: uuid.UUID | None,
    concept: str,
    score: float,
) -> tuple[int, float, str]:
    """
    Computes what the learner's updated attempts, average_score, and mastery_level
    would be after a challenge evaluation WITHOUT mutating the shared demo database.
    """
    existing = db.scalar(
        select(ConceptProgress).where(
            ConceptProgress.concept == concept,
            ConceptProgress.project_id == project_id,
            ConceptProgress.document_id == document_id,
        )
    )
    if existing is None:
        existing = db.scalar(
            select(ConceptProgress).where(ConceptProgress.concept == concept)
        )

    prev_attempts = existing.attempts if existing is not None else 0
    prev_avg = existing.average_score if existing is not None else 0.0

    new_attempts = prev_attempts + 1
    new_avg = ((prev_avg * prev_attempts) + score) / new_attempts
    new_mastery = calculate_mastery_level(
        attempts=new_attempts,
        average_score=new_avg,
    )
    return new_attempts, new_avg, new_mastery
