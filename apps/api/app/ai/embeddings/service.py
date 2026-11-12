import logging
import math

from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.ai.embeddings.gemini import GeminiEmbeddingProvider
from app.db.models import Chunk, ChunkEmbedding, DocumentVersion, Section

logger = logging.getLogger(__name__)

DEFAULT_EMBEDDING_BATCH_SIZE = 50


def embed_document_version(
    db: Session,
    document_version: DocumentVersion,
    force: bool = False,
    batch_size: int = DEFAULT_EMBEDDING_BATCH_SIZE,
) -> tuple[int, int]:
    if batch_size <= 0:
        raise ValueError("batch_size must be a positive integer")

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

    chunk_ids = [chunk.id for chunk in chunks]

    existing_chunk_ids = set(
        db.scalars(
            select(ChunkEmbedding.chunk_id).where(
                ChunkEmbedding.chunk_id.in_(chunk_ids),
                ChunkEmbedding.provider == "gemini",
                ChunkEmbedding.model == provider.model,
            )
        ).all()
    )

    if force:
        chunks_to_embed = list(chunks)
    else:
        chunks_to_embed = [
            chunk
            for chunk in chunks
            if chunk.id not in existing_chunk_ids
        ]

    if not chunks_to_embed:
        document_version.processing_status = "ready"
        db.commit()

        return 0, len(chunks)

    if force:
        db.execute(
            delete(ChunkEmbedding).where(
                ChunkEmbedding.chunk_id.in_(
                    [chunk.id for chunk in chunks_to_embed]
                ),
                ChunkEmbedding.provider == "gemini",
                ChunkEmbedding.model == provider.model,
            )
        )

        db.flush()

    total_to_embed = len(chunks_to_embed)
    total_batches = math.ceil(total_to_embed / batch_size)
    embedded_count = 0

    for batch_idx in range(total_batches):
        start = batch_idx * batch_size
        end = start + batch_size
        batch_chunks = chunks_to_embed[start:end]

        logger.info(
            "Embedding batch %d/%d (%d chunks) for DocumentVersion %s",
            batch_idx + 1,
            total_batches,
            len(batch_chunks),
            document_version.id,
        )

        batch_texts = [chunk.content for chunk in batch_chunks]
        batch_vectors = provider.embed_documents(batch_texts)

        if len(batch_vectors) != len(batch_chunks):
            raise RuntimeError(
                "Embedding provider returned an unexpected number of vectors "
                f"for batch {batch_idx + 1}/{total_batches}: "
                f"expected {len(batch_chunks)}, got {len(batch_vectors)}"
            )

        for chunk, vector in zip(batch_chunks, batch_vectors):
            embedding = ChunkEmbedding(
                chunk_id=chunk.id,
                provider="gemini",
                model=provider.model,
                dimensions=len(vector),
                embedding=vector,
            )

            db.add(embedding)
            embedded_count += 1

    document_version.processing_status = "ready"

    db.commit()

    return embedded_count, len(chunks)
