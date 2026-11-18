import logging

from fastapi import Depends, FastAPI, HTTPException, Request, status
from fastapi.middleware.cors import CORSMiddleware

from app.api.ask import router as ask_router
from app.api.challenge import router as challenge_router
from app.api.documents import router as documents_router
from app.api.health import router as health_router
from app.api.learning import router as learning_router
from app.api.projects import router as projects_router
from app.api.search import router as search_router
from app.core.auth import require_api_access_token
from app.core.config import Settings, get_settings
from app.core.demo_protection import (
    enforce_demo_rate_limit,
    issue_demo_session_token,
)

logger = logging.getLogger(__name__)

settings = get_settings()

if settings.is_demo_mode and not settings.demo_session_signing_secret:
    logger.warning(
        "DEMO_SESSION_SIGNING_SECRET is not set (APP_ENV=%s, APP_MODE=demo). Protected API routes will return 401.",
        settings.app_env,
    )
elif not settings.is_demo_mode and not settings.api_access_token:
    logger.warning(
        "API_ACCESS_TOKEN is not set (APP_ENV=%s, APP_MODE=personal). Protected API routes will return 401 until API_ACCESS_TOKEN is configured.",
        settings.app_env,
    )

app = FastAPI(
    title=settings.app_name,
    version="0.1.0",
    debug=bool(settings.debug),
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.parsed_cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Public health check endpoint for cloud deployment probes
app.include_router(health_router)


@app.get("/auth/mode", tags=["auth"])
def get_auth_mode(
    current_settings: Settings = Depends(get_settings),
) -> dict[str, str | bool]:
    is_demo = current_settings.is_demo_mode
    return {
        "app_mode": current_settings.app_mode,
        "demo_enabled": is_demo,
        "uploads_enabled": not is_demo,
        "deletions_enabled": not is_demo,
    }


@app.post("/auth/demo-session", tags=["auth"])
def create_demo_session(
    request: Request = None,  # type: ignore[assignment]
    current_settings: Settings = Depends(get_settings),
) -> dict[str, str | bool | int]:
    """
    Issues a short-lived HMAC-signed demo session token when APP_MODE='demo'.
    Never exposes DEMO_SESSION_SIGNING_SECRET or API_ACCESS_TOKEN.
    Strictly disabled (403) in personal mode.
    """
    if not current_settings.is_demo_mode:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Demo session entry is disabled in personal mode.",
        )

    enforce_demo_rate_limit(
        bucket="demo_session",
        max_requests=15,
        window_seconds=600,
        request=request,
        settings=current_settings,
    )

    signing_secret = current_settings.demo_session_signing_secret
    if not signing_secret:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="DEMO_SESSION_SIGNING_SECRET is not configured on the demo server.",
        )

    signed = issue_demo_session_token(
        signing_secret=signing_secret,
        ttl_seconds=current_settings.demo_session_ttl_seconds,
    )

    return {
        "authenticated": True,
        "app_mode": "demo",
        "access_token": signed["token"],
        "expires_at": signed["expires_at"],
        "expires_in": signed["expires_in"],
    }


# Protected API routes
protected_dependencies = [Depends(require_api_access_token)]


@app.get("/auth/verify", tags=["auth"], dependencies=protected_dependencies)
def verify_access_token(
    current_settings: Settings = Depends(get_settings),
) -> dict[str, str | bool]:
    return {
        "authenticated": True,
        "app_mode": current_settings.app_mode,
    }


app.include_router(projects_router, dependencies=protected_dependencies)
app.include_router(documents_router, dependencies=protected_dependencies)
app.include_router(search_router, dependencies=protected_dependencies)
app.include_router(ask_router, dependencies=protected_dependencies)
app.include_router(challenge_router, dependencies=protected_dependencies)
app.include_router(learning_router, dependencies=protected_dependencies)
