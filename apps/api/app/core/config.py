from functools import lru_cache

from pydantic import AliasChoices, Field, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "RecallForge AI API"
    app_env: str = "development"
    debug: bool | None = None
    database_url: str
    gemini_api_key: str
    embedding_model: str = Field(
        default="gemini-embedding-001",
        validation_alias=AliasChoices("EMBEDDING_MODEL", "GEMINI_EMBEDDING_MODEL"),
    )
    reranker_model: str = "gemini-3.6-flash"

    # Security & Networking
    api_access_token: str | None = None
    cors_origins: str = "http://localhost:3000,http://127.0.0.1:3000"

    # Document Storage ("local" | "supabase")
    storage_backend: str = "local"
    supabase_url: str | None = None
    supabase_service_role_key: str | None = None
    supabase_storage_bucket: str = "documents"

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    @model_validator(mode="after")
    def _validate_production_and_storage_settings(self) -> "Settings":
        self.app_env = (self.app_env or "development").strip().lower()
        self.storage_backend = (self.storage_backend or "local").strip().lower()

        if self.debug is None:
            self.debug = self.app_env != "production"

        if self.api_access_token is not None:
            cleaned_token = self.api_access_token.strip()
            self.api_access_token = cleaned_token if cleaned_token else None

        if self.app_env == "production" and not self.api_access_token:
            raise ValueError(
                "API_ACCESS_TOKEN must be configured when APP_ENV is 'production'."
            )

        if self.storage_backend not in ("local", "supabase"):
            raise ValueError(
                f"Invalid STORAGE_BACKEND '{self.storage_backend}'. Must be 'local' or 'supabase'."
            )

        if self.storage_backend == "supabase":
            self.supabase_url = (self.supabase_url or "").strip().rstrip("/") or None
            self.supabase_service_role_key = (
                (self.supabase_service_role_key or "").strip() or None
            )
            self.supabase_storage_bucket = (
                (self.supabase_storage_bucket or "").strip() or "documents"
            )
            if not self.supabase_url or not self.supabase_service_role_key:
                raise ValueError(
                    "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required when STORAGE_BACKEND='supabase'."
                )

        return self

    @property
    def parsed_cors_origins(self) -> list[str]:
        origins: list[str] = []
        for raw in (self.cors_origins or "").split(","):
            origin = raw.strip().rstrip("/")
            if not origin:
                continue
            if origin == "*":
                raise ValueError(
                    "Wildcard '*' is not allowed in CORS_ORIGINS when allow_credentials=True."
                )
            if origin not in origins:
                origins.append(origin)
        return origins


@lru_cache
def get_settings() -> Settings:
    return Settings()
