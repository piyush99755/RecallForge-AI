from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "RecallForge AI API"
    app_env: str = "development"
    debug: bool = True
    database_url: str
    gemini_api_key: str
    embedding_model: str = "gemini-embedding-001"
    reranker_model: str = "gemini-3.6-flash"

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )


@lru_cache
def get_settings() -> Settings:
    return Settings()