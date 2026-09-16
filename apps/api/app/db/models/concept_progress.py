import uuid
from datetime import datetime, timezone

from sqlalchemy import DateTime, Float, ForeignKey, Integer, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class ConceptProgress(Base):
    __tablename__ = "concept_progress"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )

    project_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("projects.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )

    document_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("documents.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )

    topic: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
        index=True,
    )

    concept: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
        index=True,
    )
    
    attempts: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=0,
    )

    correct_count: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=0,
    )

    incorrect_count: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=0,
    )

    average_score: Mapped[float] = mapped_column(
        Float,
        nullable=False,
        default=0.0,
    )

    last_score: Mapped[float] = mapped_column(
        Float,
        nullable=False,
        default=0.0,
    )

    mastery_level: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        default="unseen",
    )

    last_practiced_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )