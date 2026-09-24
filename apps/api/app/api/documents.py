import uuid
from pathlib import Path

from fastapi import (
    APIRouter,
    BackgroundTasks,
    Depends,
    File,
    Form,
    HTTPException,
    Query,
    UploadFile,
)
from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from app.api.schemas.documents import (
    DocumentListItem,
    DocumentListResponse,
    IngestDocumentResponse,
    ParseDocumentResponse,
    ParsedPageResponse,
    UploadDocumentResponse,
)
from app.db.models import Document, DocumentVersion, Project
from app.db.session import get_db
from app.ingestion.checksum import calculate_sha256
from app.ingestion.parsers.pdf import parse_pdf
from app.ingestion.pipeline import process_document_version
from app.ingestion.service import (
    embed_document_version_service,
    ingest_document_version_service,
)
from app.ingestion.storage import build_storage_path, save_file
from app.projects.service import get_or_create_default_project

router = APIRouter(
    prefix="/documents",
    tags=["documents"],
)


@router.get(
    "",
    response_model=DocumentListResponse,
)
def list_documents(
    project_id: uuid.UUID | None = Query(default=None),
    db: Session = Depends(get_db),
) -> DocumentListResponse:
    statement = select(Document).options(joinedload(Document.versions))

    if project_id is not None:
        statement = statement.where(Document.project_id == project_id)

    statement = statement.order_by(Document.created_at.desc())

    documents = db.scalars(statement).unique().all()

    items = []
    for doc in documents:
        # Highest version_number is the authoritative latest-version selector
        latest_version = (
            max(doc.versions, key=lambda v: v.version_number)
            if doc.versions
            else None
        )

        items.append(
            DocumentListItem(
                document_id=doc.id,
                project_id=doc.project_id,
                title=doc.title,
                document_type=doc.document_type,
                latest_version_id=latest_version.id if latest_version else None,
                version_number=latest_version.version_number if latest_version else None,
                original_filename=latest_version.original_filename if latest_version else None,
                mime_type=latest_version.mime_type if latest_version else None,
                file_size_bytes=latest_version.file_size_bytes if latest_version else None,
                processing_status=latest_version.processing_status if latest_version else None,
                created_at=doc.created_at,
                updated_at=doc.updated_at,
            )
        )

    return DocumentListResponse(
        items=items,
        total=len(items),
    )


@router.post(
    "/upload",
    response_model=UploadDocumentResponse,
)
async def upload_document(
    background_tasks: BackgroundTasks,
    title: str = Form(...),
    file: UploadFile = File(...),
    project_id: uuid.UUID | None = Form(default=None),
    db: Session = Depends(get_db),
):
    if project_id is not None:
        project = db.get(Project, project_id)
        if project is None:
            raise HTTPException(
                status_code=404,
                detail="Project not found",
            )
    else:
        project = get_or_create_default_project(db)
        project_id = project.id

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
        # If existing version is incomplete or failed, schedule background reprocessing
        if existing_version.processing_status in (
            "pending",
            "failed",
            "embedding_failed",
            "ready_for_embedding",
        ):
            background_tasks.add_task(process_document_version, existing_version.id)

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

    # Schedule automatic background ingestion & embedding pipeline
    background_tasks.add_task(process_document_version, document_version.id)

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

    section_count, chunk_count = ingest_document_version_service(
        db=db,
        document_version=document_version,
    )

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
    force: bool = False,
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

    embedded_count, total_chunks = embed_document_version_service(
        db=db,
        document_version=document_version,
        force=force,
    )

    return {
        "document_version_id": str(document_version.id),
        "processing_status": document_version.processing_status,
        "embedded_count": embedded_count,
        "total_chunks": total_chunks,
        "force": force,
    }