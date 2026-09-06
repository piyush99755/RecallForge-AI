import uuid

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy import select
from sqlalchemy.orm import Session
from pathlib import Path
from app.api.schemas.documents import (
    ParseDocumentResponse,
    ParsedPageResponse,
    UploadDocumentResponse,
)
from app.ingestion.parsers.pdf import parse_pdf
from app.api.schemas.documents import UploadDocumentResponse
from app.db.models import Document, DocumentVersion, Project
from app.db.session import get_db
from app.ingestion.checksum import calculate_sha256
from app.ingestion.storage import build_storage_path, save_file
from app.api.schemas.documents import IngestDocumentResponse
from app.ingestion.persist import persist_sections_and_chunks
from app.ingestion.structure.sections import build_sections
from app.ai.embeddings.service import embed_document_version


router = APIRouter(
    prefix="/documents",
    tags=["documents"],
)

@router.post(
    "/upload",
    response_model=UploadDocumentResponse,
)
async def upload_document(
    project_id: uuid.UUID = Form(...),
    title: str = Form(...),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    project = db.get(Project, project_id)

    if project is None:
        raise HTTPException(
            status_code=404,
            detail="Project not found",
        )

    file_bytes = await file.read()

    if not file_bytes:
        raise HTTPException(
            status_code=400,
            detail="Uploaded file is empty",
        )

    checksum = calculate_sha256(file_bytes)

    existing_version = db.scalar(
        select(DocumentVersion).where(
            DocumentVersion.checksum_sha256 == checksum
        )
    )

    if existing_version is not None:
        return UploadDocumentResponse(
            document_id=existing_version.document_id,
            document_version_id=existing_version.id,
            version_number=existing_version.version_number,
            filename=existing_version.original_filename,
            checksum_sha256=existing_version.checksum_sha256,
            processing_status=existing_version.processing_status,
            duplicate=True,
        )

    document = Document(
        project_id=project_id,
        title=title,
        document_type="pdf",
    )

    db.add(document)
    db.flush()

    version_number = 1

    storage_path = build_storage_path(
        project_id=project_id,
        document_id=document.id,
        version_number=version_number,
        filename=file.filename or "document.pdf",
    )

    save_file(storage_path, file_bytes)

    document_version = DocumentVersion(
        document_id=document.id,
        version_number=version_number,
        original_filename=file.filename or "document.pdf",
        storage_key=str(storage_path),
        mime_type=file.content_type or "application/octet-stream",
        file_size_bytes=len(file_bytes),
        checksum_sha256=checksum,
        processing_status="pending",
    )

    db.add(document_version)
    db.commit()
    db.refresh(document_version)

    return UploadDocumentResponse(
        document_id=document.id,
        document_version_id=document_version.id,
        version_number=document_version.version_number,
        filename=document_version.original_filename,
        checksum_sha256=document_version.checksum_sha256,
        processing_status=document_version.processing_status,
        duplicate=False,
    )
    
@router.post(
    "/versions/{document_version_id}/parse",
    response_model=ParseDocumentResponse,
)
def parse_document_version(
    document_version_id: uuid.UUID,
    db: Session = Depends(get_db),
):
    document_version = db.get(
        DocumentVersion,
        document_version_id,
    )

    if document_version is None:
        raise HTTPException(
            status_code=404,
            detail="Document version not found",
        )

    if document_version.mime_type != "application/pdf":
        raise HTTPException(
            status_code=400,
            detail="Only PDF parsing is supported currently",
        )

    path = Path(document_version.storage_key)

    if not path.exists():
        raise HTTPException(
            status_code=404,
            detail="Stored file not found",
        )

    pages = parse_pdf(path)

    return ParseDocumentResponse(
        document_version_id=document_version.id,
        filename=document_version.original_filename,
        page_count=len(pages),
        total_characters=sum(len(page.text) for page in pages),
        pages=[
            ParsedPageResponse(
                page_number=page.page_number,
                character_count=len(page.text),
                preview=page.text[:300],
            )
            for page in pages
        ],
    )
    
@router.post(
    "/versions/{document_version_id}/ingest",
    response_model=IngestDocumentResponse,
)
def ingest_document_version(
    document_version_id: uuid.UUID,
    db: Session = Depends(get_db),
):
    document_version = db.get(
        DocumentVersion,
        document_version_id,
    )

    if document_version is None:
        raise HTTPException(
            status_code=404,
            detail="Document version not found",
        )

    if document_version.mime_type != "application/pdf":
        raise HTTPException(
            status_code=400,
            detail="Only PDF ingestion is supported currently",
        )

    path = Path(document_version.storage_key)

    if not path.exists():
        raise HTTPException(
            status_code=404,
            detail="Stored file not found",
        )

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

    return IngestDocumentResponse(
        document_version_id=document_version.id,
        filename=document_version.original_filename,
        processing_status=document_version.processing_status,
        section_count=section_count,
        chunk_count=chunk_count,
    )
    
@router.post("/versions/{document_version_id}/embed")
def embed_document_version_endpoint(
    document_version_id: uuid.UUID,
    db: Session = Depends(get_db),
):
    document_version = db.get(
        DocumentVersion,
        document_version_id,
    )

    if document_version is None:
        raise HTTPException(
            status_code=404,
            detail="Document version not found",
        )

    try:
        document_version.processing_status = "embedding"
        db.commit()

        embedded_count, total_chunks = embed_document_version(
            db=db,
            document_version=document_version,
        )

    except Exception:
        db.rollback()

        document_version.processing_status = "embedding_failed"
        db.commit()

        raise

    return {
        "document_version_id": str(document_version.id),
        "processing_status": document_version.processing_status,
        "embedded_count": embedded_count,
        "total_chunks": total_chunks,
    }