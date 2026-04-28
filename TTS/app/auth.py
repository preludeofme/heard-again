import jwt
import logging
import time
from fastapi import HTTPException, status, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from typing import Optional, Dict, Any
import os
import httpx

logger = logging.getLogger(__name__)

# HTTP Bearer token scheme
security = HTTPBearer()

# JWT Configuration - should match NextAuth configuration
JWT_SECRET = os.getenv('NEXTAUTH_SECRET')
if not JWT_SECRET:
    raise RuntimeError(
        "NEXTAUTH_SECRET environment variable is required. "
        "This should match the NextAuth secret used by the main application."
    )
JWT_ALGORITHM = 'HS256'

# NextAuth API endpoint for token validation
NEXTAUTH_URL = os.getenv('NEXTAUTH_URL', 'http://localhost:4777')

class AuthError(Exception):
    """Custom authentication error"""
    pass

class TenantIsolationError(Exception):
    """Custom tenant isolation error"""
    pass

async def validate_token(credentials: HTTPAuthorizationCredentials = Depends(security)) -> Dict[str, Any]:
    """
    Validate session token via NextAuth session endpoint.
    NextAuth uses encrypted session cookies, not JWT tokens.
    """
    try:
        session_token = credentials.credentials

        # Validate with NextAuth session endpoint
        try:
            async with httpx.AsyncClient() as client:
                session_response = await client.get(
                    f"{NEXTAUTH_URL}/api/auth/session",
                    headers={"Cookie": f"next-auth.session-token={session_token}"},
                    timeout=10
                )

            if session_response.status_code != 200:
                logger.warning(f"NextAuth session validation failed: {session_response.status_code}")
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Invalid session",
                    headers={"WWW-Authenticate": "Bearer"},
                )

            session_data = session_response.json()

            if not session_data.get('user'):
                logger.warning("No user in session data")
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Invalid session",
                    headers={"WWW-Authenticate": "Bearer"},
                )

        except httpx.RequestError as e:
            logger.error(f"Failed to validate session with NextAuth: {e}")
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Authentication service unavailable",
            )

        # Extract user info from session
        user = session_data['user']
        user_id = user.get('id')
        email = user.get('email')

        # For familyspace, we'll use a default or extract from user data
        # The main app handles familyspace authorization
        familyspace_id = user.get('defaultFamilyspaceId') or 'default'

        if not user_id:
            logger.error(f"Invalid session: missing user id - {session_data}")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid session: missing user id",
                headers={"WWW-Authenticate": "Bearer"},
            )

        return {
            'user_id': user_id,
            'familyspace_id': familyspace_id,
            'email': email,
            'token': session_token,
            'session_data': session_data,
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Authentication error: {e}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication failed",
            headers={"WWW-Authenticate": "Bearer"},
        )

async def require_familyspace_role(
    auth_data: Dict[str, Any] = Depends(validate_token),
    required_role: str = 'EDITOR'
) -> Dict[str, Any]:
    """
    Ensure user has required role in familyspace.
    Reads role from the session_data already fetched by validate_token — no second HTTP call.
    """
    try:
        session_data = auth_data['session_data']
        user = session_data.get('user', {})

        # Get role from session (NextAuth includes this in user object)
        user_role = user.get('role', 'VIEWER')

        # Role hierarchy check
        role_hierarchy = ['VIEWER', 'LEGACY', 'EDITOR', 'ADMIN', 'OWNER']

        if user_role not in role_hierarchy:
            logger.error(f"Unknown role '{user_role}' for user {auth_data['user_id']}")
            raise HTTPException(status_code=403, detail="Invalid role")

        user_index = role_hierarchy.index(user_role)
        required_index = role_hierarchy.index(required_role)

        if user_index < required_index:
            await log_auth_event('INSUFFICIENT_ROLE', auth_data, {
                'required': required_role,
                'actual': user_role
            })
            raise HTTPException(
                status_code=403,
                detail=f"Requires {required_role} role or higher"
            )

        logger.info(f"User {auth_data['user_id']} authorized with role {user_role}")
        return auth_data

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Role check error: {e}")
        raise HTTPException(status_code=503, detail="Authorization service unavailable")

def validate_tenant_access(auth_data: Dict[str, Any], resource_familyspace_id: str) -> None:
    """
    Validate that the authenticated user can access the specified familyspace resource.
    This prevents cross-tenant data access.
    """
    if auth_data['familyspace_id'] != resource_familyspace_id:
        logger.error(f"Tenant isolation violation: user {auth_data['user_id']} "
                    f"from familyspace {auth_data['familyspace_id']} "
                    f"attempting to access familyspace {resource_familyspace_id}")
        raise TenantIsolationError("Access denied: familyspace mismatch")

def get_user_context(auth_data: Dict[str, Any]) -> Dict[str, str]:
    """Get user context for logging and auditing"""
    return {
        'user_id': auth_data['user_id'],
        'familyspace_id': auth_data['familyspace_id'],
        'email': auth_data.get('email', 'unknown')
    }

# Middleware for logging authentication events
async def log_auth_event(event_type: str, auth_data: Dict[str, Any], details: Dict[str, Any] = None):
    """Log authentication and authorization events for audit"""
    log_data = {
        'event_type': event_type,
        'timestamp': time.time(),
        'user_id': auth_data['user_id'],
        'familyspace_id': auth_data['familyspace_id'],
        'details': details or {}
    }

    if event_type in ['AUTH_FAILURE', 'TENANT_VIOLATION']:
        logger.error(f"Security event: {event_type}", extra=log_data)
    else:
        logger.info(f"Auth event: {event_type}", extra=log_data)
