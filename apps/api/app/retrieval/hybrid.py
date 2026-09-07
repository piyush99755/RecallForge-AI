from dataclasses import dataclass
from uuid import UUID

from sqlalchemy.orm import Session

from app.retrieval.semantic import (
    lexical_search,
    semantic_search,
)


@dataclass
class HybridSearchResult:
    chunk_id: UUID
    content: str
    chunk_type: str
    section_title: str | None
    page_start: int | None
    page_end: int | None
    document_title: str
    document_id: UUID
    document_version_id: UUID
    project_id: UUID
    hybrid_score: float
    semantic_rank: int | None
    lexical_rank: int | None


def hybrid_search(
    db: Session,
    query: str,
    limit: int = 5,
    project_id: UUID | None = None,
    document_id: UUID | None = None,
    candidate_limit: int = 20,
    rrf_k: int = 60,
) -> list[HybridSearchResult]:
    semantic_results = semantic_search(
        db=db,
        query=query,
        limit=candidate_limit,
        project_id=project_id,
        document_id=document_id,
    )

    lexical_results = lexical_search(
        db=db,
        query=query,
        limit=candidate_limit,
        project_id=project_id,
        document_id=document_id,
    )

    combined: dict[UUID, dict] = {}

    for rank, result in enumerate(
        semantic_results,
        start=1,
    ):
        combined[result.chunk_id] = {
            "result": result,
            "semantic_rank": rank,
            "lexical_rank": None,
            "score": 1 / (rrf_k + rank),
        }

    for rank, result in enumerate(
        lexical_results,
        start=1,
    ):
        if result.chunk_id not in combined:
            combined[result.chunk_id] = {
                "result": result,
                "semantic_rank": None,
                "lexical_rank": rank,
                "score": 0.0,
            }

        combined[result.chunk_id]["lexical_rank"] = rank
        combined[result.chunk_id]["score"] += (
            1 / (rrf_k + rank)
        )

    ranked = sorted(
        combined.values(),
        key=lambda item: item["score"],
        reverse=True,
    )[:limit]

    results: list[HybridSearchResult] = []

    for item in ranked:
        result = item["result"]

        results.append(
            HybridSearchResult(
                chunk_id=result.chunk_id,
                content=result.content,
                chunk_type=result.chunk_type,
                section_title=result.section_title,
                page_start=result.page_start,
                page_end=result.page_end,
                document_title=result.document_title,
                document_id=result.document_id,
                document_version_id=result.document_version_id,
                project_id=result.project_id,
                hybrid_score=item["score"],
                semantic_rank=item["semantic_rank"],
                lexical_rank=item["lexical_rank"],
            )
        )

    return results