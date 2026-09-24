import logging
import uuid

from app.db.models import DocumentVersion
from app.db.session import SessionLocal
from app.ingestion.service import (
    embed_document_version_service,
    ingest_document_version_service,
)

logger = logging.getLogger(__name__)


def process_document_version(
    document_version_id: uuid.UUID,
    force: bool = False,
) -> None:
    """
    Status-aware background pipeline for orchestrating document ingestion and embedding.

    Status behavior:
    - pending / failed: run ingest -> run embed
    - ready_for_embedding / embedding_failed: skip ingest -> run embed
    - processing / embedding: no-op (active stage in progress)
    - ready: no-op (already complete)
    """
    db = SessionLocal()

    try:
        document_version = db.get(DocumentVersion, document_version_id)

        if document_version is None:
            logger.error(
                f"Background pipeline aborted: DocumentVersion {document_version_id} not found."
            )
            return

        status = document_version.processing_status
        logger.info(
            f"Background pipeline invoked for DocumentVersion {document_version_id} (current status: '{status}')."
        )

        # 1. Active or Completed No-Op Guards
        if status == "ready" and not force:
            logger.info(f"DocumentVersion {document_version_id} is already 'ready'. Skipping background pipeline.")
            return

        if status in ("processing", "embedding"):
            logger.info(
                f"DocumentVersion {document_version_id} is currently in active state '{status}'. Skipping duplicate pipeline invocation."
            )
            return

        # 2. Ingestion Stage (run for 'pending' or 'failed')
        if status in ("pending", "failed") or force:
            logger.info(f"Executing ingestion stage for DocumentVersion {document_version_id}...")
            ingest_document_version_service(db, document_version)
            # Reload object after ingestion commit to get updated status
            db.refresh(document_version)
            status = document_version.processing_status

        # 3. Embedding Stage (run if 'ready_for_embedding' or 'embedding_failed')
        if status in ("ready_for_embedding", "embedding_failed") or force:
            logger.info(f"Executing embedding stage for DocumentVersion {document_version_id}...")
            embed_document_version_service(db, document_version, force=force)
            db.refresh(document_version)

        logger.info(
            f"Background pipeline completed for DocumentVersion {document_version_id}. Final status: '{document_version.processing_status}'."
        )

    except Exception as e:
        logger.exception(
            f"Background pipeline encountered an exception for DocumentVersion {document_version_id}: {e}"
        )
    finally:
        db.close()
