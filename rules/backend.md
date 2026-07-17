# Backend Rules

## Architecture
- Routers are thin — validate input with Pydantic, call service, return response
- Services contain all business logic — NL parsing, etc.
- Keep business logic out of routers; no if/else chains in route handlers
- Routers live in `routers/`, services in `services/`, config in `core/`

## Project Structure
```
backend/
├── core/              Config, security, logging
├── database/          Session, models, Alembic migrations
├── routers/           FastAPI route handlers (thin)
├── services/          Business logic (NL parsing, etc.)
├── main.py            FastAPI app setup
├── .env               Environment variables
├── requirements.txt   Pinned dependencies
├── pyproject.toml     Ruff + pytest config
└── Dockerfile
```

## API Design
- Use Pydantic v2 for all request/response schemas
- Return proper HTTP status codes (201 for create, 204 for delete)
- Use descriptive endpoint paths: `/api/transactions/parse` not `/api/parse-transaction`
- Consistent error format: `{ "detail": "message" }`

## Authentication
- JWT via `PyJWT` with HS256
- Passwords hashed with `bcrypt` directly (no passlib — unmaintained)
- Token expiry configurable via settings (default 30 min)
- Protected routes use `get_current_user` dependency from `routers/auth.py`; every
  financial route additionally depends on `get_current_profile` (validates the
  requested country profile belongs to the authenticated user — see `rules/database.md`
  and `docs/architecture-and-goals.md`)

## AI / NL Parsing
- No paid API calls (no OpenAI, no external services)
- NL parsing uses rule-based regex + keyword matching in `services/transaction_service.py`
- Free and local-only — user data never leaves the server

## Logging
- Use `core/logging.py` for all logging
- Import `get_logger(__name__)` from `core.logging` in each module
- Never use `print()` — always use structured logging
- Log levels: DEBUG for development details, INFO for lifecycle events, WARNING for unexpected states, ERROR for failures

## Code Style
- Type hints on all functions and parameters
- Async for all route handlers; services can be sync if no I/O
- **Raw SQL via asyncpg, no ORM** — see `rules/database.md` for the full contract
  (parameterized queries, connection pool, dataclass row types)
- Use modern Python 3.12+ syntax: `list[str]` not `List[str]`, `str | None` not `Optional[str]`

## Formatting & Linting
- Format with Ruff: `ruff check .` (lint) and `ruff format .` (format)
- Auto-fix lint issues: `ruff check --fix .`
- Run both after every change — `ruff check . && ruff format .`
- Rules defined in `pyproject.toml` under `[tool.ruff]`
- Line length: 100
