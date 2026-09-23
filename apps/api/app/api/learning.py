from datetime import datetime, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.api.challenge import (
    ChallengeResponse,
    ChallengeSourceResponse,
)
from app.db.models import (
    ChallengeAttempt,
    ChallengeAttemptGap,
    ConceptProgress,
    KnowledgeGap,
    StudyChallenge,
)
from app.db.session import get_db
from app.rag.challenge import generate_challenge_question
from app.rag.context import build_rag_context
from app.retrieval.confidence import evaluate_retrieval_confidence
from app.retrieval.hybrid import hybrid_search
from app.retrieval.reranker import rerank_results
from app.learning.review_queue import (
    build_review_reason,
    build_review_targets,
    calculate_review_priority,
    get_review_status,
)

router = APIRouter(
    prefix="/learning",
    tags=["learning"],
)


class LearningProgressSummary(BaseModel):
    total_concepts: int
    weak_count: int
    developing_count: int
    strong_count: int
    mastered_count: int


class RecommendedConcept(BaseModel):
    topic: str
    concept: str
    average_score: float
    mastery_level: str
    attempts: int
    priority_score: float
    reason: str


class LearningProgressItem(BaseModel):
    topic: str
    concept: str
    attempts: int
    average_score: float
    last_score: float
    correct_count: int
    incorrect_count: int
    mastery_level: str
    next_review_at: datetime | None
    review_status: str


class LearningProgressResponse(BaseModel):
    summary: LearningProgressSummary
    recommended_next_concepts: list[RecommendedConcept]
    items: list[LearningProgressItem]


class ReviewNextRequest(BaseModel):
    project_id: UUID | None = None
    document_id: UUID | None = None


class KnowledgeGapItem(BaseModel):
    concept: str
    topic: str
    gap_key: str
    display_name: str
    description: str
    occurrences: int


class KnowledgeGapResponse(BaseModel):
    total_gaps: int
    items: list[KnowledgeGapItem]
    

class ReviewQueueGap(BaseModel):
    gap_key: str
    display_name: str
    occurrences: int


class ReviewQueueItem(BaseModel):
    project_id: UUID | None
    document_id: UUID | None
    topic: str
    concept: str
    attempts: int
    average_score: float
    mastery_level: str
    next_review_at: datetime | None
    review_status: str
    priority_score: float
    reason: str
    top_gap: ReviewQueueGap | None = None


class ReviewQueueResponse(BaseModel):
    total_items: int
    items: list[ReviewQueueItem]




@router.get(
    "/progress",
    response_model=LearningProgressResponse,
)
def get_learning_progress(
    project_id: UUID | None = Query(default=None),
    document_id: UUID | None = Query(default=None),
    db: Session = Depends(get_db),
) -> LearningProgressResponse:
    statement = select(ConceptProgress)

    if project_id is not None:
        statement = statement.where(ConceptProgress.project_id == project_id)

    if document_id is not None:
        statement = statement.where(ConceptProgress.document_id == document_id)

    statement = statement.order_by(
        ConceptProgress.average_score.asc(),
        ConceptProgress.attempts.desc(),
    )

    rows = db.scalars(statement).all()

    real_rows = [row for row in rows if row.concept != "legacy"]

    summary = LearningProgressSummary(
        total_concepts=len(real_rows),
        weak_count=sum(
            1 for row in real_rows if row.mastery_level == "weak"
        ),
        developing_count=sum(
            1 for row in real_rows if row.mastery_level == "developing"
        ),
        strong_count=sum(
            1 for row in real_rows if row.mastery_level == "strong"
        ),
        mastered_count=sum(
            1 for row in real_rows if row.mastery_level == "mastered"
        ),
    )

    ranked_rows = sorted(
        real_rows,
        key=calculate_review_priority,
        reverse=True,
    )

    recommended_next_concepts = [
        RecommendedConcept(
            topic=row.topic,
            concept=row.concept,
            average_score=row.average_score,
            mastery_level=row.mastery_level,
            attempts=row.attempts,
            priority_score=round(calculate_review_priority(row), 3),
            reason=build_review_reason(row),
        )
        for row in ranked_rows[:5]
    ]

    items = [
        LearningProgressItem(
            topic=row.topic,
            concept=row.concept,
            attempts=row.attempts,
            average_score=row.average_score,
            last_score=row.last_score,
            correct_count=row.correct_count,
            incorrect_count=row.incorrect_count,
            mastery_level=row.mastery_level,
            next_review_at=row.next_review_at,
            review_status=get_review_status(row),
        )
        for row in real_rows
    ]

    return LearningProgressResponse(
        summary=summary,
        recommended_next_concepts=recommended_next_concepts,
        items=items,
    )
    
@router.get(
    "/review-queue",
    response_model=ReviewQueueResponse,
)
def get_review_queue(
    project_id: UUID | None = Query(default=None),
    document_id: UUID | None = Query(default=None),
    db: Session = Depends(get_db),
) -> ReviewQueueResponse:
    targets = build_review_targets(
        db=db,
        project_id=project_id,
        document_id=document_id,
        calculate_priority=calculate_review_priority,
        calculate_status=get_review_status,
        build_reason=build_review_reason,
    )

    items = [
        ReviewQueueItem(
            project_id=target.progress.project_id,
            document_id=target.progress.document_id,
            topic=target.progress.topic,
            concept=target.progress.concept,
            attempts=target.progress.attempts,
            average_score=target.progress.average_score,
            mastery_level=target.progress.mastery_level,
            next_review_at=target.progress.next_review_at,
            review_status=target.review_status,
            priority_score=target.priority_score,
            reason=target.reason,
            top_gap=(
                ReviewQueueGap(
                    gap_key=target.top_gap.gap_key,
                    display_name=target.top_gap.display_name,
                    occurrences=target.top_gap_occurrences,
                )
                if target.top_gap is not None
                else None
            ),
        )
        for target in targets
    ]

    return ReviewQueueResponse(
        total_items=len(items),
        items=items,
    )

@router.get(
    "/gaps",
    response_model=KnowledgeGapResponse,
)
def get_learning_gaps(
    project_id: UUID | None = Query(default=None),
    document_id: UUID | None = Query(default=None),
    db: Session = Depends(get_db),
) -> KnowledgeGapResponse:
    occurrence_count = func.count(ChallengeAttemptGap.id).label("occurrences")

    statement = (
        select(
            KnowledgeGap.concept,
            StudyChallenge.topic,
            KnowledgeGap.gap_key,
            KnowledgeGap.display_name,
            KnowledgeGap.description,
            occurrence_count,
        )
        .join(
            ChallengeAttemptGap,
            ChallengeAttemptGap.knowledge_gap_id == KnowledgeGap.id,
        )
        .join(
            ChallengeAttempt,
            ChallengeAttempt.id == ChallengeAttemptGap.attempt_id,
        )
        .join(
            StudyChallenge,
            StudyChallenge.id == ChallengeAttempt.challenge_id,
        )
        .where(StudyChallenge.concept != "legacy")
    )

    if project_id is not None:
        statement = statement.where(KnowledgeGap.project_id == project_id)

    if document_id is not None:
        statement = statement.where(KnowledgeGap.document_id == document_id)

    statement = (
        statement.group_by(
            KnowledgeGap.id,
            KnowledgeGap.concept,
            StudyChallenge.topic,
            KnowledgeGap.gap_key,
            KnowledgeGap.display_name,
            KnowledgeGap.description,
        ).order_by(occurrence_count.desc())
    )

    rows = db.execute(statement).all()

    items = [
        KnowledgeGapItem(
            concept=row.concept,
            topic=row.topic,
            gap_key=row.gap_key,
            display_name=row.display_name,
            description=row.description,
            occurrences=row.occurrences,
        )
        for row in rows
    ]

    return KnowledgeGapResponse(
        total_gaps=len(items),
        items=items,
    )


@router.post(
    "/review-next",
    response_model=ChallengeResponse,
)
def review_next_concept(
    payload: ReviewNextRequest,
    db: Session = Depends(get_db),
) -> ChallengeResponse:
    targets = build_review_targets(
        db=db,
        project_id=payload.project_id,
        document_id=payload.document_id,
        calculate_priority=calculate_review_priority,
        calculate_status=get_review_status,
        build_reason=build_review_reason,
    )

    if not targets:
        raise HTTPException(
            status_code=404,
            detail="No learner progress is available yet.",
        )

    target = targets[0]
    progress = target.progress

    query = progress.concept.replace("_", " ")

    candidates = hybrid_search(
        db=db,
        query=query,
        limit=10,
        project_id=progress.project_id,
        document_id=progress.document_id,
    )

    confidence = evaluate_retrieval_confidence(
        candidates
    )

    if not confidence.sufficient:
        raise HTTPException(
            status_code=422,
            detail=(
                "Could not find sufficiently relevant source material "
                "for the recommended concept."
            ),
        )

    reranked = rerank_results(
        query=query,
        candidates=candidates,
        limit=3,
    )

    context = build_rag_context(
        reranked
    )

    target_gap = (
        target.top_gap.gap_key
        if target.top_gap is not None
        else None
    )

    target_gap_description = (
        target.top_gap.description
        if target.top_gap is not None
        else None
    )

    challenge = generate_challenge_question(
        context=context,
        target_concept=progress.concept,
        target_gap=target_gap,
        target_gap_description=target_gap_description,
    )

    stored_challenge = StudyChallenge(
        project_id=progress.project_id,
        document_id=progress.document_id,
        topic=progress.topic,
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
        topic=stored_challenge.topic,
        concept=stored_challenge.concept,
        question=stored_challenge.question,
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