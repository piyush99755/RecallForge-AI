from datetime import datetime, timezone, timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.models import ConceptProgress, StudyChallenge



def calculate_mastery_level(
    attempts: int,
    average_score: float,
) -> str:
    if attempts >= 3 and average_score >= 0.85:
        return "mastered"

    if average_score >= 0.70:
        return "strong"

    if average_score >= 0.40:
        return "developing"

    return "weak"


def update_concept_progress(
    db: Session,
    challenge: StudyChallenge,
    score: float,
    correct: bool,
) -> ConceptProgress:
    progress = db.scalar(
        select(ConceptProgress).where(
            ConceptProgress.concept == challenge.concept,
            ConceptProgress.project_id == challenge.project_id,
            ConceptProgress.document_id == challenge.document_id,
        )
    )

    if progress is None:
        progress = ConceptProgress(
            project_id=challenge.project_id,
            document_id=challenge.document_id,
            topic=challenge.topic,
            concept=challenge.concept,
        )

        db.add(progress)
        db.flush()

    previous_attempts = progress.attempts
    new_attempts = previous_attempts + 1

    progress.average_score = (
        (
            progress.average_score * previous_attempts
        )
        + score
    ) / new_attempts

    progress.attempts = new_attempts
    progress.last_score = score

    if correct:
        progress.correct_count += 1
    else:
        progress.incorrect_count += 1

    progress.mastery_level = calculate_mastery_level(
        attempts=progress.attempts,
        average_score=progress.average_score,
    )
    
    progress.next_review_at = calculate_next_review_at(
    mastery_level=progress.mastery_level,
    correct=correct,
)

    progress.last_practiced_at = datetime.now(
        timezone.utc
    )

    return progress


def calculate_next_review_at(
    mastery_level: str,
    correct: bool,
) -> datetime:
    now = datetime.now(timezone.utc)

    if not correct:
        return now + timedelta(days=1)

    if mastery_level == "weak":
        return now + timedelta(days=1)

    if mastery_level == "developing":
        return now + timedelta(days=3)

    if mastery_level == "strong":
        return now + timedelta(days=7)

    if mastery_level == "mastered":
        return now + timedelta(days=21)

    return now + timedelta(days=1)