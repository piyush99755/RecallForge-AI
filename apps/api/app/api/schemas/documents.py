from uuid import UUID

from pydantic import BaseModel


class UploadDocumentResponse(BaseModel):
    document_id: UUID
    document_version_id: UUID
    version_number: int
    filename: str
    checksum_sha256: str
    processing_status: str
    duplicate: bool