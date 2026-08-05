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
├── pyproject.toml     Ruff config (a `[tool.pytest.ini_options]` section exists but
│                      is unused — no test files anywhere; verify via curl/Playwright)
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
- NL parsing (quick-add, receipt/statement extraction, chat, advice rephrasing) is
  rules-first: regex + keyword matching in `services/transaction_service.py`, plus
  local-only tier C extraction (pdfplumber/Tesseract, zero network) for documents —
  this always runs, free, no data leaving the machine.
- **Gemini is the one cloud exception** (`services/ai/gemini.py`'s shared `call_gemini()`
  helper) — free-tier, no paid API calls, but it IS an external service and user text
  DOES leave the server when it's used. Strictly opt-in: every call site checks the
  user's `ai_cloud_enabled` toggle first and is OFF by default. Never call Gemini (or
  any other external AI) without that check.
- No OpenAI, no other third-party AI providers, no Ollama (considered, dropped — see
  `services/ingest/document_extract.py`'s header comment).

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
