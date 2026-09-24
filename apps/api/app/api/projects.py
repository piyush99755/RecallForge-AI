from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.schemas.projects import ProjectListItem, ProjectListResponse
from app.db.models import Project
from app.db.session import get_db

router = APIRouter(
    prefix="/projects",
    tags=["projects"],
)


@router.get(
    "",
    response_model=ProjectListResponse,
)
def list_projects(
    db: Session = Depends(get_db),
) -> ProjectListResponse:
    statement = select(Project).order_by(Project.created_at.desc())
    projects = db.scalars(statement).all()

    items = [
        ProjectListItem(
            id=project.id,
            name=project.name,
            description=project.description,
            created_at=project.created_at,
            updated_at=project.updated_at,
        )
        for project in projects
    ]

    return ProjectListResponse(
        items=items,
        total=len(items),
    )
