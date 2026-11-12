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

    if not rows:
        return []

    concepts = {row.concept for row in rows}
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
            KnowledgeGap.concept.in_(concepts),
        )
    )

    if project_id is not None:
        gap_statement = gap_statement.where(
            KnowledgeGap.project_id == project_id
        )

    if document_id is not None:
        gap_statement = gap_statement.where(
            KnowledgeGap.document_id == document_id
        )

    gap_statement = (
        gap_statement
        .group_by(
            KnowledgeGap.id
        )
        .order_by(
            gap_count.desc()
        )
    )

    gap_rows = db.execute(gap_statement).all()

    top_gap_by_scope: dict[
        tuple[UUID | None, UUID | None, str],
        tuple[KnowledgeGap, int],
    ] = {}

    for knowledge_gap, occurrences in gap_rows:
        scope_key = (
            knowledge_gap.project_id,
            knowledge_gap.document_id,
            knowledge_gap.concept,
        )
        if scope_key not in top_gap_by_scope:
            top_gap_by_scope[scope_key] = (
                knowledge_gap,
                int(occurrences),
            )

    targets: list[ReviewTarget] = []

    for row in rows:
        scope_key = (
            row.project_id,
            row.document_id,
            row.concept,
        )
        top_gap_entry = top_gap_by_scope.get(scope_key)

        top_gap = (
            top_gap_entry[0]
            if top_gap_entry is not None
            else None
        )
        top_gap_occurrences = (
            top_gap_entry[1]
            if top_gap_entry is not None
            else 0
        )

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
