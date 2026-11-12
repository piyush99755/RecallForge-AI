import logging

from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.ask import router as ask_router
from app.api.challenge import router as challenge_router
from app.api.documents import router as documents_router
from app.api.health import router as health_router
from app.api.learning import router as learning_router
from app.api.projects import router as projects_router
from app.api.search import router as search_router
from app.core.auth import require_api_access_token
from app.core.config import get_settings

logger = logging.getLogger(__name__)

settings = get_settings()

if not settings.api_access_token:
    logger.warning(
        "API_ACCESS_TOKEN is not set (APP_ENV=%s). Protected API routes will return 401 until API_ACCESS_TOKEN is configured.",
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

# Protected personal API routes
protected_dependencies = [Depends(require_api_access_token)]


@app.get("/auth/verify", tags=["auth"], dependencies=protected_dependencies)
def verify_access_token() -> dict[str, bool]:
    return {"authenticated": True}


app.include_router(projects_router, dependencies=protected_dependencies)
app.include_router(documents_router, dependencies=protected_dependencies)
app.include_router(search_router, dependencies=protected_dependencies)
app.include_router(ask_router, dependencies=protected_dependencies)
app.include_router(challenge_router, dependencies=protected_dependencies)
app.include_router(learning_router, dependencies=protected_dependencies)
