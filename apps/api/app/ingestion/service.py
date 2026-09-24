from pathlib import Path

from sqlalchemy.orm import Session

from app.ai.embeddings.service import embed_document_version
from app.db.models import DocumentVersion
from app.ingestion.parsers.pdf import parse_pdf
from app.ingestion.persist import persist_sections_and_chunks
from app.ingestion.structure.sections import build_sections


def ingest_document_version_service(
    db: Session,
    document_version: DocumentVersion,
) -> tuple[int, int]:
    if document_version.mime_type != "application/pdf":
        raise ValueError("Only PDF ingestion is supported currently")

    path = Path(document_version.storage_key)

    if not path.exists():
        raise FileNotFoundError(f"Stored file not found: {document_version.storage_key}")

    document_version.processing_status = "processing"
    db.commit()

    try:
        pages = parse_pdf(path)
        parsed_sections = build_sections(pages)

        section_count, chunk_count = persist_sections_and_chunks(
            db=db,
            document_version=document_version,
            parsed_sections=parsed_sections,
        )
    except Exception:
        db.rollback()
        document_version.processing_status = "failed"
        db.commit()
        raise

    return section_count, chunk_count


def embed_document_version_service(
    db: Session,
    document_version: DocumentVersion,
    force: bool = False,
) -> tuple[int, int]:
    document_version.processing_status = "embedding"
    db.commit()

    try:
        embedded_count, total_chunks = embed_document_version(
            db=db,
            document_version=document_version,
            force=force,
        )
    except Exception:
        db.rollback()
        document_version.processing_status = "embedding_failed"
        db.commit()
        raise

    return embedded_count, total_chunks
