import uuid
from datetime import datetime, timezone

from sqlalchemy import DateTime, ForeignKey, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class ChallengeAttemptGap(Base):
    __tablename__ = "challenge_attempt_gaps"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )

    attempt_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey(
            "challenge_attempts.id",
            ondelete="CASCADE",
        ),
        nullable=False,
        index=True,
    )

    knowledge_gap_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey(
            "knowledge_gaps.id",
            ondelete="CASCADE",
        ),
        nullable=False,
        index=True,
    )

    raw_missing_point: Mapped[str] = mapped_column(
        Text,
        nullable=False,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    __table_args__ = (
        UniqueConstraint(
            "attempt_id",
            "knowledge_gap_id",
            "raw_missing_point",
            name="uq_attempt_gap_raw_point",
        ),
    )