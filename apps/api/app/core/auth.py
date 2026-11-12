import logging
import secrets

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.core.config import Settings, get_settings

logger = logging.getLogger(__name__)

bearer_scheme = HTTPBearer(auto_error=False)


def require_api_access_token(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    settings: Settings = Depends(get_settings),
) -> None:
    """
    Validates personal API access token via Authorization: Bearer <token>.
    Never logs token values. Fails closed if API_ACCESS_TOKEN is missing or invalid.
    """
    expected_token = settings.api_access_token

    if not expected_token:
        if settings.app_env == "production":
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Server authentication is not configured.",
            )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="API_ACCESS_TOKEN is not configured on the backend server. Set API_ACCESS_TOKEN in your environment or .env file.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if (
        credentials is None
        or credentials.scheme.lower() != "bearer"
        or not credentials.credentials
    ):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required. Provide a valid Bearer token.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    provided_token = credentials.credentials.strip()
    if not secrets.compare_digest(provided_token.encode("utf-8"), expected_token.encode("utf-8")):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid personal access token.",
            headers={"WWW-Authenticate": "Bearer"},
        )
