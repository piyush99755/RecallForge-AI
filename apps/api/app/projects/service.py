from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.models import Project

DEFAULT_PROJECT_NAME = "My Study Library"
DEFAULT_PROJECT_DESCRIPTION = "Default RecallForge study workspace"


def get_or_create_default_project(db: Session) -> Project:
    """
    Retrieve the default RecallForge study project or create it if it does not exist.
    Lookup is deterministic by name to ensure idempotent operation across uploads.
    """
    statement = select(Project).where(Project.name == DEFAULT_PROJECT_NAME)
    project = db.scalar(statement)

    if project is not None:
        return project

    project = Project(
        name=DEFAULT_PROJECT_NAME,
        description=DEFAULT_PROJECT_DESCRIPTION,
    )
    db.add(project)
    db.commit()
    db.refresh(project)
    return project
