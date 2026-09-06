from fastapi import FastAPI

from app.api.health import router as health_router
from app.core.config import get_settings
from app.api.documents import router as documents_router
from app.api.search import router as search_router


settings = get_settings()

app = FastAPI(
    title=settings.app_name,
    version="0.1.0",
    debug=settings.debug,
)

app.include_router(health_router)
app.include_router(documents_router)
app.include_router(search_router)