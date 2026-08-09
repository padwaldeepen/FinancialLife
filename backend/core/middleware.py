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
    # X2 raised this from 100. A folder upload issues one POST per file, so a 200-file
    # drop is 200 requests in well under a minute — the app was throttling its own bulk
    # ingestion, which surfaced as uploads failing partway through a batch. This is a
    # localhost, single-user app: the general bucket exists to catch a runaway loop, not
    # to police a legitimate user, so it can be generous. The strict credential bucket
    # (login/register) is unchanged and stays tight, because that's the one that actually
    # defends anything.
    def __init__(self, app, general_limit: int = 2000, auth_limit: int = 10, window: int = 60):
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

    # Credential-guessing endpoints only. /api/auth/refresh and /api/auth/me are called
    # on every page load (session bootstrap, axios 401 retries) — lumping them into the
    # same tight brute-force bucket as /login and /register meant normal navigation
    # alone could trip the limit and return a 429 from /refresh, which the frontend was
    # (incorrectly, see authRefresh.ts) treating as an invalid session and logging the
    # user out. Only the credential endpoints need the strict bucket.
    _STRICT_AUTH_PATHS = {"/api/auth/login", "/api/auth/register"}

    async def dispatch(self, request: Request, call_next):
        client_ip = self._client_ip(request)
        now = time.time()
        is_auth = request.url.path in self._STRICT_AUTH_PATHS

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
