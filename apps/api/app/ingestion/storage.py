from pathlib import Path
from uuid import UUID


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