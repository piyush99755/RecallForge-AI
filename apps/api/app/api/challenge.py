from uuid import UUID

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.rag.challenge import generate_challenge_question
from app.rag.context import build_rag_context
from app.retrieval.confidence import evaluate_retrieval_confidence
from app.retrieval.hybrid import hybrid_search
from app.retrieval.reranker import rerank_results
from app.rag.challenge_evaluator import evaluate_challenge_answer


router = APIRouter(
    prefix="/challenge",
    tags=["challenge"],
)


class ChallengeRequest(BaseModel):
    topic: str = Field(min_length=1)
    project_id: UUID | None = None
    document_id: UUID | None = None
    candidate_limit: int = Field(default=10, ge=5, le=20)
    source_limit: int = Field(default=3, ge=1, le=10)


class ChallengeSourceResponse(BaseModel):
    source_id: str
    chunk_id: str
    document_title: str
    section_title: str | None
    page_start: int | None
    page_end: int | None


class ChallengeResponse(BaseModel):
    topic: str
    question: str
    sources: list[ChallengeSourceResponse]
    
class ChallengeEvaluationRequest(BaseModel):
    question: str = Field(min_length=1)
    expected_answer: str = Field(min_length=1)
    user_answer: str = Field(min_length=1)
    explanation: str | None = None


class ChallengeEvaluationResponse(BaseModel):
    score: float
    correct: bool
    feedback: str
    missing_points: list[str]
    expected_answer: str
    explanation: str | None


@router.post(
    "",
    response_model=ChallengeResponse,
)
def create_challenge(
    payload: ChallengeRequest,
    db: Session = Depends(get_db),
):
    candidates = hybrid_search(
        db=db,
        query=payload.topic,
        limit=payload.candidate_limit,
        project_id=payload.project_id,
        document_id=payload.document_id,
    )

    confidence = evaluate_retrieval_confidence(
        candidates
    )

    if not confidence.sufficient:
        return ChallengeResponse(
            topic=payload.topic,
            question=(
                "I couldn't find enough relevant RecallForge material "
                "to generate a grounded challenge for this topic."
            ),
            sources=[],
        )

    reranked = rerank_results(
        query=payload.topic,
        candidates=candidates,
        limit=payload.source_limit,
    )

    context = build_rag_context(
        reranked
    )

    challenge = generate_challenge_question(
        context=context
    )

    return ChallengeResponse(
        topic=payload.topic,
        question=challenge.question,
        sources=[
            ChallengeSourceResponse(
                source_id=source.source_id,
                chunk_id=source.chunk_id,
                document_title=source.document_title,
                section_title=source.section_title,
                page_start=source.page_start,
                page_end=source.page_end,
            )
            for source in context.sources
        ],
    )
    
@router.post(
    "/evaluate",
    response_model=ChallengeEvaluationResponse,
)
def evaluate_challenge(
    payload: ChallengeEvaluationRequest,
):
    evaluation = evaluate_challenge_answer(
        question=payload.question,
        expected_answer=payload.expected_answer,
        user_answer=payload.user_answer,
    )

    return ChallengeEvaluationResponse(
        score=evaluation.score,
        correct=evaluation.correct,
        feedback=evaluation.feedback,
        missing_points=evaluation.missing_points,
        expected_answer=payload.expected_answer,
        explanation=payload.explanation,
    )