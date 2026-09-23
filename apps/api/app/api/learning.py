from uuid import UUID
import json
from fastapi import APIRouter, Depends, Query, HTTPException
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.orm import Session


from app.db.session import get_db
from datetime import datetime, timezone
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
from app.rag.challenge import generate_challenge_question
from app.rag.context import build_rag_context
from app.retrieval.confidence import evaluate_retrieval_confidence
from app.retrieval.hybrid import hybrid_search
from app.retrieval.reranker import rerank_results
from app.db.models import ConceptProgress, StudyChallenge


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


def calculate_review_priority(row: ConceptProgress) -> float:
    mastery_weights = {
        "weak": 1.0,
        "developing": 0.7,
        "strong": 0.3,
        "mastered": 0.1,
    }

    mastery_weight = mastery_weights.get(
        row.mastery_level,
        0.5,
    )

    score_gap = 1.0 - row.average_score

    attempt_factor = 1.0 / max(row.attempts, 1)

    now = datetime.now(timezone.utc)

    if row.next_review_at is None:
        due_factor = 0.5
    elif row.next_review_at <= now:
        overdue_days = (
            now - row.next_review_at
        ).total_seconds() / 86400

        due_factor = min(
            1.0 + (overdue_days / 30.0),
            1.5,
        )
    else:
        due_factor = 0.0

    return (
        mastery_weight * 0.35
        + score_gap * 0.25
        + attempt_factor * 0.15
        + due_factor * 0.25
    )
    
def build_review_reason(row: ConceptProgress) -> str:
    now = datetime.now(timezone.utc)

    if (
        row.next_review_at is not None
        and row.next_review_at <= now
    ):
        return (
            "This concept is due for review based on your "
            "spaced-repetition schedule."
        )

    if row.mastery_level == "weak":
        return (
            "This concept has a low mastery level and should "
            "be reviewed soon."
        )

    if row.mastery_level == "developing":
        return (
            "This concept is improving but still needs more practice."
        )

    if row.attempts <= 1:
        return (
            "Only practiced once; more repetition is needed "
            "to confirm retention."
        )

    if row.attempts == 2:
        return (
            "Practiced only a few times; another review would "
            "help confirm retention."
        )

    if row.mastery_level == "strong":
        return (
            "Strong performance so far; periodic review can "
            "help maintain retention."
        )

    if row.mastery_level == "mastered":
        return (
            "This concept is mastered; review it periodically "
            "to maintain long-term retention."
        )

    return (
        "This concept is recommended for review based on "
        "your learning history."
    )
    
def get_review_status(row: ConceptProgress) -> str:
    if row.next_review_at is None:
        return "not_scheduled"

    now = datetime.now(timezone.utc)

    if row.next_review_at < now:
        return "overdue"

    if row.next_review_at.date() == now.date():
        return "due_now"

    return "scheduled"
        
@router.get(
    "/gaps",
    response_model=KnowledgeGapResponse,
)
def get_learning_gaps(
    project_id: UUID | None = Query(default=None),
    document_id: UUID | None = Query(default=None),
    db: Session = Depends(get_db),
) -> KnowledgeGapResponse:
    occurrence_count = func.count(
        ChallengeAttemptGap.id
    ).label("occurrences")

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
            ChallengeAttemptGap.knowledge_gap_id
            == KnowledgeGap.id,
        )
        .join(
            ChallengeAttempt,
            ChallengeAttempt.id
            == ChallengeAttemptGap.attempt_id,
        )
        .join(
            StudyChallenge,
            StudyChallenge.id
            == ChallengeAttempt.challenge_id,
        )
        .where(
            StudyChallenge.concept != "legacy"
        )
    )

    if project_id is not None:
        statement = statement.where(
            KnowledgeGap.project_id == project_id
        )

    if document_id is not None:
        statement = statement.where(
            KnowledgeGap.document_id == document_id
        )

    statement = (
        statement
        .group_by(
            KnowledgeGap.id,
            KnowledgeGap.concept,
            StudyChallenge.topic,
            KnowledgeGap.gap_key,
            KnowledgeGap.display_name,
            KnowledgeGap.description,
        )
        .order_by(
            occurrence_count.desc()
        )
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
    statement = select(ConceptProgress).where(
        ConceptProgress.concept != "legacy"
    )

    if payload.project_id is not None:
        statement = statement.where(
            ConceptProgress.project_id == payload.project_id
        )

    if payload.document_id is not None:
        statement = statement.where(
            ConceptProgress.document_id == payload.document_id
        )

    rows = db.scalars(statement).all()

    if not rows:
        raise HTTPException(
            status_code=404,
            detail="No learner progress is available yet.",
        )

    ranked_rows = sorted(
        rows,
        key=calculate_review_priority,
        reverse=True,
    )

    target = ranked_rows[0]

    query = target.concept.replace("_", " ")

    candidates = hybrid_search(
        db=db,
        query=query,
        limit=10,
        project_id=target.project_id,
        document_id=target.document_id,
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

    challenge = generate_challenge_question(
        context=context,
         target_concept=target.concept,
    )

    stored_challenge = StudyChallenge(
        project_id=target.project_id,
        document_id=target.document_id,
        topic=target.topic,
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
    
@router.get(
    "/gaps",
    response_model=KnowledgeGapResponse,
)
def get_learning_gaps(
    project_id: UUID | None = Query(default=None),
    document_id: UUID | None = Query(default=None),
    db: Session = Depends(get_db),
) -> KnowledgeGapResponse:
    statement = (
        select(
            ChallengeAttempt,
            StudyChallenge,
        )
        .join(
            StudyChallenge,
            ChallengeAttempt.challenge_id == StudyChallenge.id,
        )
        .where(
            StudyChallenge.concept != "legacy"
        )
    )

    if project_id is not None:
        statement = statement.where(
            StudyChallenge.project_id == project_id
        )

    if document_id is not None:
        statement = statement.where(
            StudyChallenge.document_id == document_id
        )

    rows = db.execute(statement).all()

    gap_counts: dict[tuple[str, str, str], int] = {}

    for attempt, challenge in rows:
        if not attempt.missing_points:
            continue

        try:
            missing_points = json.loads(
                attempt.missing_points
            )
        except json.JSONDecodeError:
            continue

        if not isinstance(missing_points, list):
            continue

        for gap in missing_points:
            if not isinstance(gap, str):
                continue

            gap = gap.strip()

            if not gap:
                continue

            key = (
                challenge.topic,
                challenge.concept,
                gap,
            )

            gap_counts[key] = (
                gap_counts.get(key, 0) + 1
            )

    items = [
        KnowledgeGapItem(
            topic=topic,
            concept=concept,
            gap=gap,
            occurrences=count,
        )
        for (
            topic,
            concept,
            gap,
        ), count in gap_counts.items()
    ]

    items.sort(
        key=lambda item: item.occurrences,
        reverse=True,
    )

    return KnowledgeGapResponse(
        total_gaps=len(items),
        items=items,
    )