from fastapi import APIRouter, HTTPException

from app.db.health import check_database_connection


router = APIRouter()


@router.get("/health")
def health_check():
    try:
        check_database_connection()

        return {
            "status": "ok",
            "database": "connected",
        }

    except Exception as exc:
        print("DATABASE ERROR:", repr(exc))

        raise HTTPException(
            status_code=503,
            detail="Database unavailable",
        ) from exc