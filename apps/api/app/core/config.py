from functools import lru_cache

from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "RecallForge AI API"
    app_env: str = "development"
    debug: bool = True
    database_url: str
    gemini_api_key: str
    embedding_model: str = "gemini-embedding-001"
    reranker_model: str = "gemini-3.6-flash"

    # Security & Networking
    api_access_token: str | None = None

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    @model_validator(mode="after")
    def _validate_production_and_storage_settings(self) -> "Settings":
        self.app_env = (self.app_env or "development").strip().lower()

        if self.api_access_token is not None:
            cleaned_token = self.api_access_token.strip()
            self.api_access_token = cleaned_token if cleaned_token else None

        if self.app_env == "production" and not self.api_access_token:
            raise ValueError(
                "API_ACCESS_TOKEN must be configured when APP_ENV is 'production'."
            )

        return self


@lru_cache
def get_settings() -> Settings:
    return Settings()
