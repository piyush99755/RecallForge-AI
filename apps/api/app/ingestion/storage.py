import logging
import shutil
from pathlib import Path, PurePosixPath
from urllib.parse import quote
from uuid import UUID

import httpx

from app.core.config import Settings, get_settings

logger = logging.getLogger(__name__)

UPLOAD_ROOT = Path("uploads")


def _sanitize_filename(filename: str) -> str:
    cleaned = Path(filename or "document.pdf").name.strip()
    return cleaned if cleaned else "document.pdf"


def build_storage_path(
    project_id: UUID,
    document_id: UUID,
    version_number: int,
    filename: str,
) -> Path:
    """
    Local path builder returning a Path under uploads/.
    """
    safe_name = _sanitize_filename(filename)
    return (
        UPLOAD_ROOT
        / str(project_id)
        / str(document_id)
        / f"v{version_number}"
        / safe_name
    )


def build_storage_key(
    project_id: UUID,
    document_id: UUID,
    version_number: int,
    filename: str,
    settings: Settings | None = None,
) -> str:
    """
    Builds the canonical storage key for the active storage backend:
    - 'supabase': '{project_id}/{document_id}/v{version}/{filename}'
    - 'local': 'uploads/{project_id}/{document_id}/v{version}/{filename}'
    """
    cfg = settings or get_settings()
    safe_name = _sanitize_filename(filename)
    if cfg.storage_backend == "supabase":
        return str(
            PurePosixPath(str(project_id))
            / str(document_id)
            / f"v{version_number}"
            / safe_name
        )
    return str(
        build_storage_path(
            project_id=project_id,
            document_id=document_id,
            version_number=version_number,
            filename=safe_name,
        )
    )


def _normalize_supabase_object_key(storage_key: str) -> str:
    normalized = storage_key.replace("\\", "/").lstrip("/")
    if normalized.startswith("uploads/"):
        normalized = normalized[len("uploads/") :]
    segments = [seg for seg in normalized.split("/") if seg and seg not in (".", "..")]
    return "/".join(quote(seg, safe="") for seg in segments)


def _supabase_headers(cfg: Settings) -> dict[str, str]:
    key = cfg.supabase_service_role_key or ""
    return {
        "Authorization": f"Bearer {key}",
        "apikey": key,
    }


def _resolve_local_upload_path(storage_key: str | Path) -> Path | None:
    """
    Safely resolves a storage_key to a local file inside UPLOAD_ROOT if contained.
    Returns None if outside UPLOAD_ROOT.
    """
    try:
        upload_root = UPLOAD_ROOT.resolve()
        raw_path = Path(storage_key)
        candidate = raw_path.resolve()
        if candidate != upload_root and candidate.is_relative_to(upload_root):
            return candidate
        # Also check relative to UPLOAD_ROOT if key lacks 'uploads/' prefix
        rel_candidate = (UPLOAD_ROOT / raw_path).resolve()
        if rel_candidate != upload_root and rel_candidate.is_relative_to(upload_root):
            return rel_candidate
    except Exception:
        return None
    return None


def save_file(
    path_or_key: Path | str,
    data: bytes,
    content_type: str = "application/pdf",
    settings: Settings | None = None,
) -> str:
    """
    Saves file bytes to the configured storage backend ('local' or 'supabase').
    Returns the stored key string.
    """
    cfg = settings or get_settings()
    storage_key = str(path_or_key)

    if cfg.storage_backend == "supabase":
        encoded_key = _normalize_supabase_object_key(storage_key)
        bucket = quote(cfg.supabase_storage_bucket, safe="")
        url = f"{cfg.supabase_url}/storage/v1/object/{bucket}/{encoded_key}"
        headers = {
            **_supabase_headers(cfg),
            "Content-Type": content_type or "application/pdf",
            "x-upsert": "true",
        }
        with httpx.Client(timeout=60.0) as client:
            response = client.post(url, content=data, headers=headers)
            if response.status_code >= 400:
                raise RuntimeError(
                    f"Supabase Storage upload failed ({response.status_code}): {response.text}"
                )
        return storage_key

    local_path = Path(path_or_key)
    local_path.parent.mkdir(parents=True, exist_ok=True)
    local_path.write_bytes(data)
    return str(local_path)


def read_stored_file(
    storage_key: str | Path,
    settings: Settings | None = None,
) -> bytes:
    """
    Reads PDF bytes from the active storage backend.
    Preserves backward compatibility for existing local files under uploads/.
    """
    cfg = settings or get_settings()
    key_str = str(storage_key)

    # Check local filesystem first if storage_backend == 'local' or if an existing local file exists
    local_candidate = _resolve_local_upload_path(key_str)
    if local_candidate is not None and local_candidate.is_file():
        return local_candidate.read_bytes()

    if cfg.storage_backend == "supabase":
        encoded_key = _normalize_supabase_object_key(key_str)
        bucket = quote(cfg.supabase_storage_bucket, safe="")
        url = f"{cfg.supabase_url}/storage/v1/object/{bucket}/{encoded_key}"
        with httpx.Client(timeout=60.0) as client:
            response = client.get(url, headers=_supabase_headers(cfg))
            if response.status_code in (400, 404):
                raise FileNotFoundError(
                    f"Stored file not found in Supabase Storage: {key_str}"
                )
            if response.status_code >= 400:
                raise RuntimeError(
                    f"Supabase Storage download failed ({response.status_code}): {response.text}"
                )
            return response.content

    raise FileNotFoundError(f"Stored file not found: {key_str}")


def stored_file_exists(
    storage_key: str | Path,
    settings: Settings | None = None,
) -> bool:
    """
    Checks whether a stored file exists in local storage or Supabase Storage.
    """
    cfg = settings or get_settings()
    key_str = str(storage_key)

    local_candidate = _resolve_local_upload_path(key_str)
    if local_candidate is not None and local_candidate.is_file():
        return True

    if cfg.storage_backend == "supabase":
        encoded_key = _normalize_supabase_object_key(key_str)
        bucket = quote(cfg.supabase_storage_bucket, safe="")
        url = f"{cfg.supabase_url}/storage/v1/object/info/{bucket}/{encoded_key}"
        try:
            with httpx.Client(timeout=30.0) as client:
                response = client.get(url, headers=_supabase_headers(cfg))
                if response.status_code == 200:
                    return True
                if response.status_code in (400, 404):
                    return False
                # Fallback to HEAD on object endpoint if /info is unsupported
                obj_url = f"{cfg.supabase_url}/storage/v1/object/{bucket}/{encoded_key}"
                head_resp = client.head(obj_url, headers=_supabase_headers(cfg))
                return head_resp.status_code == 200
        except Exception as exc:
            logger.warning("Failed to check Supabase Storage existence for %s: %s", key_str, exc)
            return False

    return False


def _delete_local_document_files(
    project_id: UUID,
    document_id: UUID,
    storage_keys: list[str] | None = None,
) -> None:
    try:
        upload_root = UPLOAD_ROOT.resolve()
    except Exception as exc:
        logger.warning("Could not resolve UPLOAD_ROOT during cleanup: %s", exc)
        return

    for key in storage_keys or []:
        if not key:
            continue
        try:
            candidate = _resolve_local_upload_path(key)
            if candidate is not None and candidate.is_file():
                candidate.unlink(missing_ok=True)
        except Exception as exc:
            logger.warning(
                "Failed to delete local stored file %s for document %s: %s",
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
            "Failed to clean up local document directory for document %s: %s",
            document_id,
            exc,
        )


def delete_document_files(
    project_id: UUID,
    document_id: UUID,
    storage_keys: list[str] | None = None,
    settings: Settings | None = None,
) -> None:
    """
    Safely deletes stored files for a document from local disk and/or Supabase Storage.
    Missing objects never raise errors or block DB cleanup.
    """
    cfg = settings or get_settings()

    # Always clean up any local copies if present under uploads/
    _delete_local_document_files(
        project_id=project_id,
        document_id=document_id,
        storage_keys=storage_keys,
    )

    if cfg.storage_backend == "supabase":
        bucket = quote(cfg.supabase_storage_bucket, safe="")
        with httpx.Client(timeout=30.0) as client:
            for key in storage_keys or []:
                if not key:
                    continue
                encoded_key = _normalize_supabase_object_key(key)
                if not encoded_key:
                    continue
                url = f"{cfg.supabase_url}/storage/v1/object/{bucket}/{encoded_key}"
                try:
                    response = client.delete(url, headers=_supabase_headers(cfg))
                    if response.status_code not in (200, 204, 400, 404):
                        logger.warning(
                            "Supabase Storage delete returned %s for %s: %s",
                            response.status_code,
                            key,
                            response.text,
                        )
                except Exception as exc:
                    logger.warning(
                        "Failed to delete Supabase Storage object %s for document %s: %s",
                        key,
                        document_id,
                        exc,
                    )
