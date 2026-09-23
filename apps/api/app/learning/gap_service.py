from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.models import (
    ChallengeAttempt,
    ChallengeAttemptGap,
    KnowledgeGap,
    StudyChallenge,
)
from app.learning.gap_canonicalizer import canonicalize_gap


def process_attempt_knowledge_gaps(
    *,
    db: Session,
    attempt: ChallengeAttempt,
    challenge: StudyChallenge,
    missing_points: list[str],
) -> list[KnowledgeGap]:
    if not missing_points:
        return []

    existing_gap_rows = db.scalars(
        select(KnowledgeGap).where(
            KnowledgeGap.project_id == challenge.project_id,
            KnowledgeGap.document_id == challenge.document_id,
            KnowledgeGap.concept == challenge.concept,
        )
    ).all()

    processed_gaps: list[KnowledgeGap] = []

    for raw_missing_point in missing_points:
        raw_missing_point = raw_missing_point.strip()

        if not raw_missing_point:
            continue

        existing_gaps = [
            {
                "gap_key": gap.gap_key,
                "display_name": gap.display_name,
                "description": gap.description,
            }
            for gap in existing_gap_rows
        ]

        decision = canonicalize_gap(
            concept=challenge.concept,
            raw_missing_point=raw_missing_point,
            existing_gaps=existing_gaps,
        )

        knowledge_gap = next(
            (
                gap
                for gap in existing_gap_rows
                if gap.gap_key == decision.gap_key
            ),
            None,
        )

        if knowledge_gap is None:
            knowledge_gap = KnowledgeGap(
                project_id=challenge.project_id,
                document_id=challenge.document_id,
                concept=challenge.concept,
                gap_key=decision.gap_key,
                display_name=decision.display_name,
                description=decision.description,
            )

            db.add(knowledge_gap)
            db.flush()

            existing_gap_rows.append(knowledge_gap)

        association = ChallengeAttemptGap(
            attempt_id=attempt.id,
            knowledge_gap_id=knowledge_gap.id,
            raw_missing_point=raw_missing_point,
        )

        db.add(association)

        processed_gaps.append(knowledge_gap)

    return processed_gaps