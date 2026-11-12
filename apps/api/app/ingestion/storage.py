import logging
import shutil
from pathlib import Path
from uuid import UUID

logger = logging.getLogger(__name__)

UPLOAD_ROOT = Path("uploads")


def build_storage_path(
    project_id: UUID,
    document_id: UUID,
    version_number: int,
    filename: str,
) -> Path:
    return (
        UPLOAD_ROOT
        / str(project_id)
        / str(document_id)
        / f"v{version_number}"
        / filename
    )


def save_file(path: Path, data: bytes) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(data)


def delete_document_files(
    project_id: UUID,
    document_id: UUID,
    storage_keys: list[str] | None = None,
) -> None:
    """
    Safely delete local files and version directories for a document.
    Only deletes paths strictly contained within UPLOAD_ROOT.
    Missing files do not raise errors.
    """
    try:
        upload_root = UPLOAD_ROOT.resolve()
    except Exception as exc:
        logger.warning("Could not resolve UPLOAD_ROOT during cleanup: %s", exc)
        return

    for key in storage_keys or []:
        if not key:
            continue
        try:
            candidate = Path(key).resolve()
            if (
                candidate != upload_root
                and candidate.is_relative_to(upload_root)
                and candidate.is_file()
            ):
                candidate.unlink(missing_ok=True)
        except Exception as exc:
            logger.warning(
                "Failed to delete stored file %s for document %s: %s",
                key,
                document_id,
                exc,
            )

    try:
        doc_dir = (UPLOAD_ROOT / str(project_id) / str(document_id)).resolve()
        if (
            doc_dir != upload_root
            and doc_dir.is_relative_to(upload_root)
            and doc_dir.exists()
            and doc_dir.is_dir()
        ):
            shutil.rmtree(doc_dir, ignore_errors=True)

        project_dir = (UPLOAD_ROOT / str(project_id)).resolve()
        if (
            project_dir != upload_root
            and project_dir.is_relative_to(upload_root)
            and project_dir.exists()
            and project_dir.is_dir()
            and not any(project_dir.iterdir())
        ):
            project_dir.rmdir()
    except Exception as exc:
        logger.warning(
            "Failed to clean up document directory for document %s: %s",
            document_id,
            exc,
        )
