import time
from collections.abc import Callable
from functools import wraps
from typing import Any

from core.logging import get_logger

log = get_logger(__name__)

_cache: dict[str, tuple[float, Any]] = {}
DEFAULT_TTL = 60


def cached(ttl: int = DEFAULT_TTL):
    """Simple in-memory TTL cache for sync/async functions.

    Key is derived from function args + kwargs.
    """

    def decorator(fn: Callable) -> Callable:
        import asyncio

        if asyncio.iscoroutinefunction(fn):

            @wraps(fn)
            async def async_wrapper(*args: Any, **kwargs: Any) -> Any:
                key = f"{fn.__module__}.{fn.__qualname__}:{args}:{sorted(kwargs.items())}"
                now = time.time()
                if key in _cache:
                    ts, val = _cache[key]
                    if now - ts < ttl:
                        return val
                result = await fn(*args, **kwargs)
                _cache[key] = (now, result)
                return result

            return async_wrapper  # type: ignore[return-value]

        @wraps(fn)
        def sync_wrapper(*args: Any, **kwargs: Any) -> Any:
            key = f"{fn.__module__}.{fn.__qualname__}:{args}:{sorted(kwargs.items())}"
            now = time.time()
            if key in _cache:
                ts, val = _cache[key]
                if now - ts < ttl:
                    return val
            result = fn(*args, **kwargs)
            _cache[key] = (now, result)
            return result

        return sync_wrapper  # type: ignore[return-value]

    return decorator


def invalidate(prefix: str = "") -> None:
    """Clear cache entries matching an optional prefix."""
    if not prefix:
        _cache.clear()
        return
    keys_to_remove = [k for k in _cache if k.startswith(prefix)]
    for k in keys_to_remove:
        del _cache[k]
