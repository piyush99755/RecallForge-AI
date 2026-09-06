from dataclasses import dataclass
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.ai.embeddings.gemini import GeminiEmbeddingProvider
from app.db.models import (
    Chunk,
    ChunkEmbedding,
    Document,
    DocumentVersion,
    Section,
)


@dataclass
class SemanticSearchResult:
    chunk_id: UUID
    content: str
    chunk_type: str
    section_title: str | None
    page_start: int | None
    page_end: int | None
    document_title: str
    document_version_id: UUID
    distance: float


def semantic_search(
    db: Session,
    query: str,
    limit: int = 5,
) -> list[SemanticSearchResult]:
    provider = GeminiEmbeddingProvider()

    query_vector = provider.embed_query(query)

    distance = ChunkEmbedding.embedding.cosine_distance(
        query_vector
    )

    rows = db.execute(
        select(
            Chunk,
            Section,
            DocumentVersion,
            Document,
            distance.label("distance"),
        )
        .join(
            ChunkEmbedding,
            ChunkEmbedding.chunk_id == Chunk.id,
        )
        .join(
            Section,
            Chunk.section_id == Section.id,
        )
        .join(
            DocumentVersion,
            Section.document_version_id == DocumentVersion.id,
        )
        .join(
            Document,
            DocumentVersion.document_id == Document.id,
        )
        .where(
            ChunkEmbedding.provider == "gemini",
            ChunkEmbedding.model == provider.model,
        )
        .order_by(distance)
        .limit(limit)
    ).all()

    return [
        SemanticSearchResult(
            chunk_id=chunk.id,
            content=chunk.content,
            chunk_type=chunk.chunk_type,
            section_title=section.title,
            page_start=chunk.page_start,
            page_end=chunk.page_end,
            document_title=document.title,
            document_version_id=document_version.id,
            distance=float(distance_value),
        )
        for (
            chunk,
            section,
            document_version,
            document,
            distance_value,
        ) in rows
    ]