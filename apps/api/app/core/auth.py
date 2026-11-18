import logging
import secrets

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.core.config import Settings, get_settings
from app.core.demo_protection import verify_demo_session_token

logger = logging.getLogger(__name__)

bearer_scheme = HTTPBearer(auto_error=False)


def require_api_access_token(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    settings: Settings = Depends(get_settings),
) -> None:
    """
    Validates API authentication via Authorization: Bearer <token>.
    - In APP_MODE='personal': validates strictly against API_ACCESS_TOKEN (unchanged).
    - In APP_MODE='demo': validates strictly as a short-lived HMAC-signed demo session token
      signed by DEMO_SESSION_SIGNING_SECRET. Raw server secrets are never accepted as demo tokens.
    """
    if settings.is_demo_mode:
        signing_secret = settings.demo_session_signing_secret
        if not signing_secret:
            if settings.app_env == "production":
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail="Demo session signing secret is not configured.",
                )
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="DEMO_SESSION_SIGNING_SECRET is not configured on the backend server.",
                headers={"WWW-Authenticate": "Bearer"},
            )

        if (
            credentials is None
            or credentials.scheme.lower() != "bearer"
            or not credentials.credentials
        ):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Demo session required. Click 'Enter Live Demo' to start a session.",
                headers={"WWW-Authenticate": "Bearer"},
            )

        verify_demo_session_token(
            token=credentials.credentials.strip(),
            signing_secret=signing_secret,
        )
        return

    # Personal Mode (APP_MODE='personal') — exact API_ACCESS_TOKEN verification
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
    if not secrets.compare_digest(
        provided_token.encode("utf-8"), expected_token.encode("utf-8")
    ):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid personal access token.",
            headers={"WWW-Authenticate": "Bearer"},
        )


def forbid_in_demo_mode(action_description: str = "This action") -> None:
    """
    Raises 403 Forbidden when the backend is running in APP_MODE='demo'.
    Used to protect seeded demo content and disable PDF uploads/deletions.
    """
    settings = get_settings()
    if settings.is_demo_mode:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"{action_description} is disabled in Public Demo Mode.",
        )
