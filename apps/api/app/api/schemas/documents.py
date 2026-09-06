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
    
class ParsedPageResponse(BaseModel):
    page_number: int
    character_count: int
    preview: str


class ParseDocumentResponse(BaseModel):
    document_version_id: UUID
    filename: str
    page_count: int
    total_characters: int
    pages: list[ParsedPageResponse]
    
class IngestDocumentResponse(BaseModel):
    document_version_id: UUID
    filename: str
    processing_status: str
    section_count: int
    chunk_count: int