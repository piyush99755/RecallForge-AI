from dataclasses import dataclass
from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.db.models import (
    ChallengeAttemptGap,
    ConceptProgress,
    KnowledgeGap,
)


@dataclass
class ReviewTarget:
    progress: ConceptProgress
    priority_score: float
    review_status: str
    reason: str
    top_gap: KnowledgeGap | None
    top_gap_occurrences: int


def build_review_targets(
    *,
    db: Session,
    project_id: UUID | None = None,
    document_id: UUID | None = None,
    calculate_priority,
    calculate_status,
    build_reason,
) -> list[ReviewTarget]:
    statement = select(ConceptProgress).where(
        ConceptProgress.concept != "legacy"
    )

    if project_id is not None:
        statement = statement.where(
            ConceptProgress.project_id == project_id
        )

    if document_id is not None:
        statement = statement.where(
            ConceptProgress.document_id == document_id
        )

    rows = db.scalars(statement).all()

    targets: list[ReviewTarget] = []

    for row in rows:
        gap_count = func.count(
            ChallengeAttemptGap.id
        ).label("occurrences")

        gap_statement = (
            select(
                KnowledgeGap,
                gap_count,
            )
            .join(
                ChallengeAttemptGap,
                ChallengeAttemptGap.knowledge_gap_id
                == KnowledgeGap.id,
            )
            .where(
                KnowledgeGap.concept == row.concept,
                KnowledgeGap.project_id == row.project_id,
                KnowledgeGap.document_id == row.document_id,
            )
            .group_by(
                KnowledgeGap.id
            )
            .order_by(
                gap_count.desc()
            )
        )

        gap_row = db.execute(
            gap_statement
        ).first()

        top_gap = None
        top_gap_occurrences = 0

        if gap_row is not None:
            top_gap = gap_row[0]
            top_gap_occurrences = gap_row[1]

        targets.append(
            ReviewTarget(
                progress=row,
                priority_score=calculate_priority(row),
                review_status=calculate_status(row),
                reason=build_reason(row),
                top_gap=top_gap,
                top_gap_occurrences=top_gap_occurrences,
            )
        )

    targets.sort(
        key=lambda item: item.priority_score,
        reverse=True,
    )

    return targets

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
        overdue_days = (now - row.next_review_at).total_seconds() / 86400
        due_factor = min(1.0 + (overdue_days / 30.0), 1.5)
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

    if row.next_review_at is not None and row.next_review_at <= now:
        return (
            "This concept is due for review based on your "
            "spaced-repetition schedule."
        )

    if row.mastery_level == "weak":
        return (
            "This concept has a low mastery level and should be reviewed soon."
        )

    if row.mastery_level == "developing":
        return "This concept is improving but still needs more practice."

    if row.attempts <= 1:
        return (
            "Only practiced once; more repetition is needed to confirm retention."
        )

    if row.attempts == 2:
        return (
            "Practiced only a few times; another review would help confirm retention."
        )

    if row.mastery_level == "strong":
        return (
            "Strong performance so far; periodic review can help maintain retention."
        )

    if row.mastery_level == "mastered":
        return (
            "This concept is mastered; review it periodically to maintain long-term retention."
        )

    return (
        "This concept is recommended for review based on your learning history."
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
