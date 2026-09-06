from sqlalchemy import select
from sqlalchemy.orm import Session

from app.ai.embeddings.gemini import GeminiEmbeddingProvider
from app.db.models import Chunk, ChunkEmbedding, DocumentVersion, Section


def embed_document_version(
    db: Session,
    document_version: DocumentVersion,
) -> tuple[int, int]:
    provider = GeminiEmbeddingProvider()

    chunks = db.scalars(
        select(Chunk)
        .join(Section)
        .where(
            Section.document_version_id == document_version.id
        )
        .order_by(
            Section.order_index,
            Chunk.chunk_index,
        )
    ).all()

    if not chunks:
        return 0, 0

    existing_chunk_ids = set(
        db.scalars(
            select(ChunkEmbedding.chunk_id).where(
                ChunkEmbedding.chunk_id.in_(
                    [chunk.id for chunk in chunks]
                ),
                ChunkEmbedding.provider == "gemini",
                ChunkEmbedding.model == provider.model,
            )
        ).all()
    )

    chunks_to_embed = [
        chunk
        for chunk in chunks
        if chunk.id not in existing_chunk_ids
    ]

    if not chunks_to_embed:
        document_version.processing_status = "ready"
        db.commit()

        return 0, len(chunks)

    texts = [
        chunk.content
        for chunk in chunks_to_embed
    ]

    vectors = provider.embed_texts(texts)

    if len(vectors) != len(chunks_to_embed):
        raise RuntimeError(
            "Embedding provider returned an unexpected number of vectors"
        )

    for chunk, vector in zip(chunks_to_embed, vectors):
        embedding = ChunkEmbedding(
            chunk_id=chunk.id,
            provider="gemini",
            model=provider.model,
            dimensions=len(vector),
            embedding=vector,
        )

        db.add(embedding)

    document_version.processing_status = "ready"

    db.commit()

    return len(chunks_to_embed), len(chunks)