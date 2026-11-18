from uuid import UUID
import json
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from app.core.config import get_settings
from app.core.demo_protection import (
    enforce_demo_rate_limit,
    get_ephemeral_demo_challenge,
    preview_demo_concept_progress,
    require_active_demo_session_jti,
    store_ephemeral_demo_challenge,
)
from app.db.session import get_db
from app.rag.challenge import generate_challenge_question
from app.rag.context import build_rag_context
from app.retrieval.confidence import evaluate_retrieval_confidence
from app.retrieval.hybrid import hybrid_search
from app.retrieval.reranker import rerank_results
from app.rag.challenge_evaluator import evaluate_challenge_answer
from app.learning.progress import update_concept_progress
from app.db.models import (
    ChallengeAttempt,
    StudyChallenge,
)
from app.learning.gap_service import process_attempt_knowledge_gaps


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
    challenge_id: UUID | None = None
    topic: str
    concept: str | None = None
    question: str
    sources: list[ChallengeSourceResponse]


class ChallengeEvaluationRequest(BaseModel):
    challenge_id: UUID
    user_answer: str = Field(min_length=1)


class ChallengeEvaluationResponse(BaseModel):
    score: float
    correct: bool
    feedback: str
    missing_points: list[str]
    expected_answer: str
    explanation: str | None
    topic: str
    attempts: int
    average_score: float
    mastery_level: str


@router.post(
    "",
    response_model=ChallengeResponse,
)
def create_challenge(
    payload: ChallengeRequest,
    request: Request = None,  # type: ignore[assignment]
    db: Session = Depends(get_db),
):
    is_demo = get_settings().is_demo_mode
    owner_jti = require_active_demo_session_jti(request) if is_demo else ""

    enforce_demo_rate_limit(
        bucket="challenge_generate",
        max_requests=8,
        window_seconds=600,
        request=request,
    )

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

    sources_response = [
        ChallengeSourceResponse(
            source_id=source.source_id,
            chunk_id=source.chunk_id,
            document_title=source.document_title,
            section_title=source.section_title,
            page_start=source.page_start,
            page_end=source.page_end,
        )
        for source in context.sources
    ]

    if is_demo:
        ephemeral = store_ephemeral_demo_challenge(
            owner_jti=owner_jti,
            project_id=payload.project_id,
            document_id=payload.document_id,
            topic=payload.topic,
            concept=challenge.concept,
            question=challenge.question,
            expected_answer=challenge.expected_answer,
            explanation=challenge.explanation,
        )
        return ChallengeResponse(
            challenge_id=ephemeral.id,
            topic=payload.topic,
            concept=ephemeral.concept,
            question=ephemeral.question,
            sources=sources_response,
        )

    stored_challenge = StudyChallenge(
        project_id=payload.project_id,
        document_id=payload.document_id,
        topic=payload.topic,
        concept=challenge.concept,
        question=challenge.question,
        expected_answer=challenge.expected_answer,
        explanation=challenge.explanation,
    )

    try:
        db.add(stored_challenge)
        db.commit()
        db.refresh(stored_challenge)
    except Exception:
        db.rollback()
        raise

    return ChallengeResponse(
        challenge_id=stored_challenge.id,
        topic=payload.topic,
        concept=stored_challenge.concept,
        question=challenge.question,
        sources=sources_response,
    )


@router.post(
    "/evaluate",
    response_model=ChallengeEvaluationResponse,
)
def evaluate_challenge(
    payload: ChallengeEvaluationRequest,
    request: Request = None,  # type: ignore[assignment]
    db: Session = Depends(get_db),
):
    is_demo = get_settings().is_demo_mode
    caller_jti = require_active_demo_session_jti(request) if is_demo else ""

    enforce_demo_rate_limit(
        bucket="challenge_evaluate",
        max_requests=10,
        window_seconds=600,
        request=request,
    )

    if is_demo:
        ephemeral = get_ephemeral_demo_challenge(
            payload.challenge_id,
            owner_jti=caller_jti,
        )
        if ephemeral is None:
            raise HTTPException(
                status_code=404,
                detail="Challenge not found or demo challenge expired.",
            )

        evaluation = evaluate_challenge_answer(
            question=ephemeral.question,
            expected_answer=ephemeral.expected_answer,
            user_answer=payload.user_answer,
        )

        attempts, avg_score, mastery_level = preview_demo_concept_progress(
            db=db,
            project_id=ephemeral.project_id,
            document_id=ephemeral.document_id,
            concept=ephemeral.concept,
            score=evaluation.score,
        )

        return ChallengeEvaluationResponse(
            score=evaluation.score,
            correct=evaluation.correct,
            feedback=evaluation.feedback,
            missing_points=evaluation.missing_points,
            expected_answer=ephemeral.expected_answer,
            explanation=ephemeral.explanation,
            topic=ephemeral.topic,
            attempts=attempts,
            average_score=avg_score,
            mastery_level=mastery_level,
        )

    challenge = db.get(
        StudyChallenge,
        payload.challenge_id,
    )

    if challenge is None:
        raise HTTPException(
            status_code=404,
            detail="Challenge not found",
        )

    evaluation = evaluate_challenge_answer(
        question=challenge.question,
        expected_answer=challenge.expected_answer,
        user_answer=payload.user_answer,
    )

    attempt = ChallengeAttempt(
        challenge_id=challenge.id,
        user_answer=payload.user_answer,
        score=evaluation.score,
        correct=evaluation.correct,
        feedback=evaluation.feedback,
        missing_points=json.dumps(
            evaluation.missing_points
        ),
    )

    db.add(attempt)
    db.flush()

    progress = update_concept_progress(
        db=db,
        challenge=challenge,
        score=evaluation.score,
        correct=evaluation.correct,
    )

    process_attempt_knowledge_gaps(
        db=db,
        attempt=attempt,
        challenge=challenge,
        missing_points=evaluation.missing_points,
    )
    
    try:
        db.commit()
    except Exception:
        db.rollback()
        raise

    return ChallengeEvaluationResponse(
        score=evaluation.score,
        correct=evaluation.correct,
        feedback=evaluation.feedback,
        missing_points=evaluation.missing_points,
        expected_answer=challenge.expected_answer,
        explanation=challenge.explanation,
        topic=challenge.topic,
        attempts=progress.attempts,
        average_score=progress.average_score,
        mastery_level=progress.mastery_level,
    )