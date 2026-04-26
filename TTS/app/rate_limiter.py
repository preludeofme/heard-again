import logging
from typing import Dict, Any
from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware
import time
import asyncio
from collections import defaultdict, deque

logger = logging.getLogger(__name__)

class InMemoryRateLimiter:
    """Simple in-memory rate limiter for development/small deployments"""
    
    def __init__(self):
        # Store requests by key (IP or user ID)
        self.requests: Dict[str, deque] = defaultdict(deque)
        # Clean up old entries periodically
        self.cleanup_task = None
        # Don't start cleanup here - no event loop at import time
        # Will be started on first use or app startup
    
    def start_cleanup_task(self):
        """Start background task to clean up old entries"""
        if self.cleanup_task is None:
            self.cleanup_task = asyncio.create_task(self._cleanup_old_entries())
    
    async def _cleanup_old_entries(self):
        """Clean up entries older than 1 hour"""
        while True:
            try:
                await asyncio.sleep(300)  # Clean up every 5 minutes
                cutoff_time = time.time() - 3600  # 1 hour ago
                
                keys_to_remove = []
                for key, timestamps in self.requests.items():
                    # Remove old timestamps
                    while timestamps and timestamps[0] < cutoff_time:
                        timestamps.popleft()
                    
                    # Remove empty entries
                    if not timestamps:
                        keys_to_remove.append(key)
                
                for key in keys_to_remove:
                    del self.requests[key]
                    
            except Exception as e:
                logger.error(f"Rate limiter cleanup error: {e}")
    
    def is_allowed(
        self, 
        key: str, 
        limit: int, 
        window: int
    ) -> tuple[bool, Dict[str, int]]:
        """
        Check if request is allowed
        
        Args:
            key: Identifier (IP or user ID)
            limit: Maximum requests allowed
            window: Time window in seconds
            
        Returns:
            Tuple of (allowed, rate_limit_info)
        """
        now = time.time()
        window_start = now - window
        
        # Get existing requests for this key
        timestamps = self.requests[key]
        
        # Remove old requests outside the window
        while timestamps and timestamps[0] < window_start:
            timestamps.popleft()
        
        # Check if limit exceeded
        if len(timestamps) >= limit:
            return False, {
                'limit': limit,
                'remaining': 0,
                'reset_time': int(timestamps[0] + window),
                'retry_after': int(timestamps[0] + window - now)
            }
        
        # Add current request
        timestamps.append(now)
        
        # Calculate remaining requests
        remaining = limit - len(timestamps)
        reset_time = int(now + window)
        
        return True, {
            'limit': limit,
            'remaining': remaining,
            'reset_time': reset_time,
            'retry_after': 0
        }

# Global rate limiter instance
rate_limiter = InMemoryRateLimiter()

class RateLimitMiddleware(BaseHTTPMiddleware):
    """Rate limiting middleware for FastAPI"""
    
    def __init__(self, app, limits: Dict[str, Dict[str, int]]):
        super().__init__(app)
        self.limits = limits
    
    async def dispatch(self, request: Request, call_next):
        # Start cleanup task on first request (when event loop is running)
        if rate_limiter.cleanup_task is None:
            rate_limiter.start_cleanup_task()
        
        # Determine which limit to apply based on path
        path = request.url.path
        limit_config = self._get_limit_config(path)
        
        if not limit_config:
            # No rate limiting for this path
            return await call_next(request)
        
        # Get client identifier
        client_key = self._get_client_key(request, limit_config.get('key_type', 'ip'))
        
        # Check rate limit
        allowed, rate_info = rate_limiter.is_allowed(
            key=client_key,
            limit=limit_config['limit'],
            window=limit_config['window']
        )
        
        # Add rate limit headers
        response = Response()
        response.headers['X-RateLimit-Limit'] = str(rate_info['limit'])
        response.headers['X-RateLimit-Remaining'] = str(rate_info['remaining'])
        response.headers['X-RateLimit-Reset'] = str(rate_info['reset_time'])
        
        if not allowed:
            response.headers['Retry-After'] = str(rate_info['retry_after'])
            response.status_code = 429
            response.body = f'{{"error": "Rate limit exceeded", "retry_after": {rate_info["retry_after"]}}}'.encode()
            return response
        
        # Process the request
        response = await call_next(request)
        
        # Add rate limit headers to response
        response.headers['X-RateLimit-Limit'] = str(rate_info['limit'])
        response.headers['X-RateLimit-Remaining'] = str(rate_info['remaining'])
        response.headers['X-RateLimit-Reset'] = str(rate_info['reset_time'])
        
        return response
    
    def _get_limit_config(self, path: str) -> Dict[str, Any]:
        """Get rate limit configuration based on request path"""
        if '/health' in path:
            return {
                'limit': 10,  # 10 health checks per minute
                'window': 60,  # 1 minute
                'key_type': 'ip'  # Rate limit by IP for health endpoints
            }
        elif '/upload-reference' in path:
            return {
                'limit': 20,  # 20 uploads per 15 minutes
                'window': 900,  # 15 minutes
                'key_type': 'user'  # Rate limit by user
            }
        elif '/create-voice-profile' in path:
            return {
                'limit': 30,  # 30 profiles per 15 minutes
                'window': 900,  # 15 minutes
                'key_type': 'user'  # Rate limit by user
            }
        elif '/synthesize' in path:
            return {
                'limit': 50,  # 50 syntheses per 15 minutes per profile (R6)
                'window': 900,  # 15 minutes
                'key_type': 'profile'  # Rate limit by profile (R6)
            }
        elif '/voice-profiles' in path:
            return {
                'limit': 200,  # 200 requests per 15 minutes
                'window': 900,  # 15 minutes
                'key_type': 'user'  # Rate limit by user
            }
        else:
            # Default rate limiting
            return {
                'limit': 300,  # 300 requests per 15 minutes
                'window': 900,  # 15 minutes
                'key_type': 'ip'  # Rate limit by IP
            }
    
    def _get_client_key(self, request: Request, key_type: str) -> str:
        """Get client identifier for rate limiting"""
        if key_type == 'user':
            # Try to get user ID from request state (set by auth middleware)
            if hasattr(request.state, 'auth_data'):
                return f"user:{request.state.auth_data.get('user_id', 'unknown')}"
            # Fallback to IP if no user data
            return f"ip:{self._get_client_ip(request)}"
        elif key_type == 'profile':
            # This is tricky as we need to parse the body or get it from query/path
            # For simplicity in middleware, we might fallback to user if not found
            # but let's try to get it from request state if available
            if hasattr(request.state, 'profile_id'):
                return f"profile:{request.state.profile_id}"
            return f"user:{request.state.auth_data.get('user_id', 'unknown')}" if hasattr(request.state, 'auth_data') else f"ip:{self._get_client_ip(request)}"
        else:
            return f"ip:{self._get_client_ip(request)}"
    
    def _get_client_ip(self, request: Request) -> str:
        """Get client IP address"""
        forwarded_for = request.headers.get('X-Forwarded-For')
        if forwarded_for:
            # X-Forwarded-For can contain multiple IPs, take the first one
            return forwarded_for.split(',')[0].strip()
        
        real_ip = request.headers.get('X-Real-IP')
        if real_ip:
            return real_ip
        
        # Fallback to client IP
        return request.client.host if request.client else 'unknown'

def create_rate_limit_middleware() -> RateLimitMiddleware:
    """Create rate limiting middleware with default configurations"""
    limits = {
        'default': {
            'limit': 300,
            'window': 900
        }
    }
    
    return RateLimitMiddleware(None, limits)

# Rate limiting decorators for specific endpoints
def rate_limit(limit: int, window: int, key_type: str = 'user'):
    """Decorator for rate limiting specific endpoints"""
    def decorator(func):
        async def wrapper(*args, **kwargs):
            # This is a simplified implementation
            # In practice, you'd integrate with the middleware
            return await func(*args, **kwargs)
        return wrapper
    return decorator
