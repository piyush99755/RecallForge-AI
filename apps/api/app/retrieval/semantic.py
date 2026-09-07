from dataclasses import dataclass
from uuid import UUID

from sqlalchemy import select,func
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
    document_id: UUID
    document_version_id: UUID
    project_id: UUID
    distance: float
    
@dataclass
class LexicalSearchResult:
    chunk_id: UUID
    content: str
    chunk_type: str
    section_title: str | None
    page_start: int | None
    page_end: int | None
    document_title: str
    document_id: UUID
    document_version_id: UUID
    project_id: UUID
    lexical_rank: float


def semantic_search(
    db: Session,
    query: str,
    limit: int = 5,
    project_id: UUID | None = None,
    document_id: UUID | None = None,
) -> list[SemanticSearchResult]:
    provider = GeminiEmbeddingProvider()

    query_vector = provider.embed_query(query)

    distance = ChunkEmbedding.embedding.cosine_distance(
        query_vector
    )

    statement = (
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
    )

    if project_id is not None:
        statement = statement.where(
            Document.project_id == project_id
        )

    if document_id is not None:
        statement = statement.where(
            Document.id == document_id
        )

    statement = (
        statement
        .order_by(distance)
        .limit(limit)
    )

    rows = db.execute(statement).all()

    return [
        SemanticSearchResult(
            chunk_id=chunk.id,
            content=chunk.content,
            chunk_type=chunk.chunk_type,
            section_title=section.title,
            page_start=chunk.page_start,
            page_end=chunk.page_end,
            document_title=document.title,
            document_id=document.id,
            document_version_id=document_version.id,
            project_id=document.project_id,
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
    
    
def lexical_search(
    db: Session,
    query: str,
    limit: int = 5,
    project_id: UUID | None = None,
    document_id: UUID | None = None,
) -> list[LexicalSearchResult]:
    search_vector = func.to_tsvector(
        "english",
        Chunk.content,
    )

    search_query = func.plainto_tsquery(
        "english",
        query,
    )

    rank = func.ts_rank(
        search_vector,
        search_query,
    )

    statement = (
        select(
            Chunk,
            Section,
            DocumentVersion,
            Document,
            rank.label("lexical_rank"),
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
            search_vector.op("@@")(search_query)
        )
    )

    if project_id is not None:
        statement = statement.where(
            Document.project_id == project_id
        )

    if document_id is not None:
        statement = statement.where(
            Document.id == document_id
        )

    statement = (
        statement
        .order_by(rank.desc())
        .limit(limit)
    )

    rows = db.execute(statement).all()

    return [
        LexicalSearchResult(
            chunk_id=chunk.id,
            content=chunk.content,
            chunk_type=chunk.chunk_type,
            section_title=section.title,
            page_start=chunk.page_start,
            page_end=chunk.page_end,
            document_title=document.title,
            document_id=document.id,
            document_version_id=document_version.id,
            project_id=document.project_id,
            lexical_rank=float(rank_value),
        )
        for (
            chunk,
            section,
            document_version,
            document,
            rank_value,
        ) in rows
    ]