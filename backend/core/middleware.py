import time
from collections import defaultdict

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse, Response

from core.logging import get_logger

log = get_logger(__name__)


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        response: Response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        if request.url.scheme == "https":
            response.headers["Strict-Transport-Security"] = "max-age=63072000; includeSubDomains"
        return response


class RateLimitMiddleware(BaseHTTPMiddleware):
    def __init__(self, app, general_limit: int = 100, auth_limit: int = 10, window: int = 60):
        super().__init__(app)
        self.general_limit = general_limit
        self.auth_limit = auth_limit
        self.window = window
        self._hits: dict[str, list[float]] = defaultdict(list)

    def _client_ip(self, request: Request) -> str:
        forwarded = request.headers.get("X-Forwarded-For")
        if forwarded:
            return forwarded.split(",")[0].strip()
        return request.client.host if request.client else "unknown"

    async def dispatch(self, request: Request, call_next):
        client_ip = self._client_ip(request)
        now = time.time()
        is_auth = request.url.path.startswith("/api/auth")

        limit = self.auth_limit if is_auth else self.general_limit
        key = f"{client_ip}:{'auth' if is_auth else 'general'}"

        self._hits[key] = [t for t in self._hits[key] if now - t < self.window]

        if len(self._hits[key]) >= limit:
            log.warning("Rate limit exceeded for %s on %s", client_ip, request.url.path)
            return JSONResponse(
                status_code=429,
                content={"detail": "Too many requests. Please try again later."},
                headers={"Retry-After": str(self.window)},
            )

        self._hits[key].append(now)
        return await call_next(request)


_response_cache: dict[str, tuple[float, bytes]] = {}
_CACHE_TTL = 60
_CACHE_PATHS = {"/api/accounts/"}


class ResponseCacheMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        if request.method != "GET" or request.url.path not in _CACHE_PATHS:
            return await call_next(request)

        auth = request.headers.get("authorization", "")
        cache_key = f"{request.url.path}:{auth}"
        now = time.time()

        if cache_key in _response_cache:
            ts, body = _response_cache[cache_key]
            if now - ts < _CACHE_TTL:
                return Response(content=body, media_type="application/json")

        response = await call_next(request)
        if response.status_code == 200:
            body = b""
            async for chunk in response.body_iterator:
                body += chunk if isinstance(chunk, bytes) else chunk.encode()
            _response_cache[cache_key] = (now, body)
            return Response(content=body, media_type="application/json")

        return response


def invalidate_response_cache(path: str | None = None) -> None:
    if path is None:
        _response_cache.clear()
        return
    keys = [k for k in _response_cache if k.startswith(path)]
    for k in keys:
        del _response_cache[k]
