from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from fastapi import APIRouter, Depends

from app.db.session import get_db
from app.retrieval.semantic import semantic_search
from app.retrieval.hybrid import hybrid_search
from uuid import UUID



router = APIRouter(
    prefix="/search",
    tags=["search"],
)


class SemanticSearchRequest(BaseModel):
    query: str = Field(min_length=1)
    limit: int = Field(default=5, ge=1, le=20)
    project_id: UUID | None = None
    document_id: UUID | None = None


class SemanticSearchResultResponse(BaseModel):
    chunk_id: str
    content: str
    chunk_type: str
    section_title: str | None
    page_start: int | None
    page_end: int | None
    document_title: str
    document_id: str
    document_version_id: str
    project_id: str
    distance: float

class SemanticSearchResponse(BaseModel):
    query: str
    results: list[SemanticSearchResultResponse]
    
class HybridSearchResultResponse(BaseModel):
    chunk_id: str
    content: str
    chunk_type: str
    section_title: str | None
    page_start: int | None
    page_end: int | None
    document_title: str
    document_id: str
    document_version_id: str
    project_id: str
    hybrid_score: float
    semantic_rank: int | None
    lexical_rank: int | None


class HybridSearchResponse(BaseModel):
    query: str
    results: list[HybridSearchResultResponse]


@router.post(
    "/semantic",
    response_model=SemanticSearchResponse,
)
def search_semantic(
    payload: SemanticSearchRequest,
    db: Session = Depends(get_db),
):
    results = semantic_search(
        db=db,
        query=payload.query,
        limit=payload.limit,
        project_id=payload.project_id,
        document_id=payload.document_id,
    )

    return SemanticSearchResponse(
        query=payload.query,
        results=[
            SemanticSearchResultResponse(
                chunk_id=str(result.chunk_id),
                content=result.content,
                chunk_type=result.chunk_type,
                section_title=result.section_title,
                page_start=result.page_start,
                page_end=result.page_end,
                document_title=result.document_title,
                document_id=str(result.document_id),
                document_version_id=str(result.document_version_id),
                project_id=str(result.project_id),
                distance=result.distance,
            )
            for result in results
        ],
    )
    

@router.post(
    "/hybrid",
    response_model=HybridSearchResponse,
)
def search_hybrid(
    payload: SemanticSearchRequest,
    db: Session = Depends(get_db),
):
    results = hybrid_search(
        db=db,
        query=payload.query,
        limit=payload.limit,
        project_id=payload.project_id,
        document_id=payload.document_id,
    )

    return HybridSearchResponse(
        query=payload.query,
        results=[
            HybridSearchResultResponse(
                chunk_id=str(result.chunk_id),
                content=result.content,
                chunk_type=result.chunk_type,
                section_title=result.section_title,
                page_start=result.page_start,
                page_end=result.page_end,
                document_title=result.document_title,
                document_id=str(result.document_id),
                document_version_id=str(result.document_version_id),
                project_id=str(result.project_id),
                hybrid_score=result.hybrid_score,
                semantic_rank=result.semantic_rank,
                lexical_rank=result.lexical_rank,
            )
            for result in results
        ],
    )