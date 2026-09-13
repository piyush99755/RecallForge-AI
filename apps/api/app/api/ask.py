from uuid import UUID
import re
from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.rag.answer import generate_grounded_answer
from app.rag.context import build_rag_context
from app.retrieval.hybrid import hybrid_search
from app.retrieval.reranker import rerank_results
from app.retrieval.confidence import evaluate_retrieval_confidence
from app.rag.modes import StudyMode


router = APIRouter(
    prefix="/ask",
    tags=["ask"],
)


class AskRequest(BaseModel):
    query: str = Field(min_length=1)
    project_id: UUID | None = None
    document_id: UUID | None = None
    mode: StudyMode = StudyMode.beginner
    candidate_limit: int = Field(default=10, ge=5, le=20)
    source_limit: int = Field(default=3, ge=1, le=10)


class AskSourceResponse(BaseModel):
    source_id: str
    chunk_id: str
    document_title: str
    section_title: str | None
    page_start: int | None
    page_end: int | None


class AskResponse(BaseModel):
    query: str
    answer: str
    sources: list[AskSourceResponse]


@router.post(
    "",
    response_model=AskResponse,
)
def ask_recallforge(
    payload: AskRequest,
    db: Session = Depends(get_db),
):
    candidates = hybrid_search(
        db=db,
        query=payload.query,
        limit=payload.candidate_limit,
        project_id=payload.project_id,
        document_id=payload.document_id,
    )
    
    confidence = evaluate_retrieval_confidence(
        candidates
    )

    if not confidence.sufficient:
        return AskResponse(
            query=payload.query,
            answer=(
                "I couldn't find sufficiently relevant information "
                "in the available RecallForge sources to answer this question."
            ),
            sources=[],
        )

    reranked = rerank_results(
        query=payload.query,
        candidates=candidates,
        limit=payload.source_limit,
    )

    context = build_rag_context(
        reranked,
    )

    grounded_answer = generate_grounded_answer(
        question=payload.query,
        context=context,
        mode=payload.mode,
    )
    
    citation_groups = re.findall(
        r"\[([^\]]+)\]",
        grounded_answer.answer,
    )

    cited_source_ids = {
        source_id.strip()
        for group in citation_groups
        for source_id in group.split(",")
        if re.fullmatch(r"S\d+", source_id.strip())
    }

    return AskResponse(
        query=payload.query,
        answer=grounded_answer.answer,
        sources=[
            AskSourceResponse(
                source_id=source.source_id,
                chunk_id=source.chunk_id,
                document_title=source.document_title,
                section_title=source.section_title,
                page_start=source.page_start,
                page_end=source.page_end,
            )
            for source in context.sources
            if source.source_id in cited_source_ids
        ],
    )