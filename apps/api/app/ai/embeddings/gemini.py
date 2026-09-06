from google import genai

from app.ai.embeddings.base import EmbeddingProvider
from app.core.config import get_settings


class GeminiEmbeddingProvider(EmbeddingProvider):
    def __init__(self) -> None:
        settings = get_settings()

        self.client = genai.Client(
            api_key=settings.gemini_api_key,
        )

        self.model = settings.embedding_model

    def embed_texts(
        self,
        texts: list[str],
    ) -> list[list[float]]:
        response = self.client.models.embed_content(
            model=self.model,
            contents=texts,
        )

        return [
            embedding.values
            for embedding in response.embeddings
        ]