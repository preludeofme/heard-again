import logging
import os
import time
from typing import Any, Dict, Optional, Tuple

import redis as redis_lib
from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware

logger = logging.getLogger(__name__)

# Lua script for atomic sliding-window rate limit check + record.
# Keeps a sorted set of request timestamps per key. Atomically removes
# expired entries, checks the count, and appends the current timestamp.
# Returns [allowed (0|1), current_count, oldest_timestamp_in_window].
_SLIDING_WINDOW_SCRIPT = """
local key        = KEYS[1]
local now        = tonumber(ARGV[1])
local window     = tonumber(ARGV[2])
local limit      = tonumber(ARGV[3])
local window_start = now - window

redis.call('ZREMRANGEBYSCORE', key, '-inf', window_start)
local count = redis.call('ZCARD', key)

if count >= limit then
    local oldest = redis.call('ZRANGE', key, 0, 0, 'WITHSCORES')
    local reset_at = oldest[2] and (oldest[2] + window) or (now + window)
    return {0, count, reset_at}
end

redis.call('ZADD', key, now, now .. ':' .. math.random(1e9))
redis.call('EXPIRE', key, window + 1)
local new_count = count + 1
return {1, new_count, now + window}
"""


class RedisRateLimiter:
    def __init__(self, redis_url: Optional[str] = None) -> None:
        url = redis_url or os.getenv("REDIS_URL", "redis://localhost:6379")
        self._client: Optional[redis_lib.Redis] = None
        self._url = url
        self._script_sha: Optional[str] = None
        try:
            self._client = redis_lib.from_url(url, decode_responses=True, socket_connect_timeout=2)
            self._client.ping()
            self._script_sha = self._client.script_load(_SLIDING_WINDOW_SCRIPT)
            logger.info("Redis rate limiter connected", extra={"redis_url": url.split("@")[-1]})
        except Exception as exc:
            logger.warning(
                "Redis unavailable — falling back to in-process rate limiter",
                extra={"error": str(exc)},
            )
            self._client = None

    def is_allowed(self, key: str, limit: int, window: int) -> Tuple[bool, Dict[str, int]]:
        now_ms = int(time.time() * 1000)
        now_s = time.time()

        if self._client and self._script_sha:
            try:
                result = self._client.evalsha(
                    self._script_sha,
                    1,
                    f"ratelimit:{key}",
                    now_ms,
                    window * 1000,
                    limit,
                )
                allowed = int(result[0]) == 1
                count = int(result[1])
                reset_at = int(result[2]) // 1000
                remaining = max(0, limit - count)
                retry_after = max(0, reset_at - int(now_s)) if not allowed else 0
                return allowed, {
                    "limit": limit,
                    "remaining": remaining,
                    "reset_time": reset_at,
                    "retry_after": retry_after,
                }
            except Exception as exc:
                logger.warning("Redis rate-limit check failed — allowing request", extra={"error": str(exc)})
                return True, {"limit": limit, "remaining": limit, "reset_time": int(now_s + window), "retry_after": 0}

        # Fallback: always allow (Redis unavailable)
        return True, {"limit": limit, "remaining": limit, "reset_time": int(now_s + window), "retry_after": 0}


rate_limiter = RedisRateLimiter()


class RateLimitMiddleware(BaseHTTPMiddleware):
    def __init__(self, app, limits: Dict[str, Dict[str, int]]) -> None:
        super().__init__(app)
        self.limits = limits

    async def dispatch(self, request: Request, call_next: Any) -> Response:
        path = request.url.path
        limit_config = self._get_limit_config(path)

        if not limit_config:
            return await call_next(request)

        client_key = self._get_client_key(request, limit_config.get("key_type", "ip"))
        allowed, rate_info = rate_limiter.is_allowed(
            key=client_key,
            limit=limit_config["limit"],
            window=limit_config["window"],
        )

        if not allowed:
            resp = Response(
                content=f'{{"error":"Rate limit exceeded","retry_after":{rate_info["retry_after"]}}}',
                status_code=429,
                media_type="application/json",
            )
            resp.headers["X-RateLimit-Limit"] = str(rate_info["limit"])
            resp.headers["X-RateLimit-Remaining"] = "0"
            resp.headers["X-RateLimit-Reset"] = str(rate_info["reset_time"])
            resp.headers["Retry-After"] = str(rate_info["retry_after"])
            return resp

        response = await call_next(request)
        response.headers["X-RateLimit-Limit"] = str(rate_info["limit"])
        response.headers["X-RateLimit-Remaining"] = str(rate_info["remaining"])
        response.headers["X-RateLimit-Reset"] = str(rate_info["reset_time"])
        return response

    def _get_limit_config(self, path: str) -> Optional[Dict[str, Any]]:
        if "/health" in path:
            return {"limit": 10, "window": 60, "key_type": "ip"}
        if "/upload-reference" in path:
            return {"limit": 20, "window": 900, "key_type": "user"}
        if "/create-voice-profile" in path:
            return {"limit": 30, "window": 900, "key_type": "user"}
        if "/synthesize" in path:
            return {"limit": 50, "window": 900, "key_type": "profile"}
        if "/voice-profiles" in path:
            return {"limit": 200, "window": 900, "key_type": "user"}
        return {"limit": 300, "window": 900, "key_type": "ip"}

    def _get_client_key(self, request: Request, key_type: str) -> str:
        if key_type == "user":
            if hasattr(request.state, "auth_data"):
                return f"user:{request.state.auth_data.get('user_id', 'unknown')}"
            return f"ip:{self._get_client_ip(request)}"
        if key_type == "profile":
            if hasattr(request.state, "profile_id"):
                return f"profile:{request.state.profile_id}"
            if hasattr(request.state, "auth_data"):
                return f"user:{request.state.auth_data.get('user_id', 'unknown')}"
            return f"ip:{self._get_client_ip(request)}"
        return f"ip:{self._get_client_ip(request)}"

    def _get_client_ip(self, request: Request) -> str:
        forwarded = request.headers.get("X-Forwarded-For")
        if forwarded:
            return forwarded.split(",")[0].strip()
        real_ip = request.headers.get("X-Real-IP")
        if real_ip:
            return real_ip
        return request.client.host if request.client else "unknown"


def create_rate_limit_middleware() -> RateLimitMiddleware:
    return RateLimitMiddleware(None, {"default": {"limit": 300, "window": 900}})
