from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.ask import router as ask_router
from app.api.challenge import router as challenge_router
from app.api.documents import router as documents_router
from app.api.health import router as health_router
from app.api.learning import router as learning_router
from app.api.projects import router as projects_router
from app.api.search import router as search_router
from app.core.config import get_settings


settings = get_settings()

app = FastAPI(
    title=settings.app_name,
    version="0.1.0",
    debug=settings.debug,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health_router)
app.include_router(projects_router)
app.include_router(documents_router)
app.include_router(search_router)
app.include_router(ask_router)
app.include_router(challenge_router)
app.include_router(learning_router)