# Backend Rules

## Architecture
- Routers are thin — validate input with Pydantic, call service, return response
- Services contain all business logic — password hashing, token creation, NL parsing
- Never import models or database sessions directly in routers
- Controllers (routers) should not contain if/else business logic

## API Design
- Use Pydantic v2 for all request/response schemas
- Return proper HTTP status codes (201 for create, 204 for delete, etc.)
- Use descriptive endpoint paths: `/api/transactions/parse` not `/api/parse-transaction`
- Consistent error response format: `{ "detail": "message" }`

## Authentication
- JWT via python-jose with HS256
- Passwords hashed with bcrypt via passlib
- Token expiry configurable via settings (default 30 min)
- Protected routes use a `get_current_user` dependency

## AI / NL Parsing
- No paid API calls (no OpenAI, no external services)
- NL parsing uses rule-based regex + keyword matching
- Keep parsing logic in `services/transaction_service.py`
- Free and local-only — user data never leaves the server

## Code Style
- Type hints on all functions
- Async for all route handlers
- Services can be sync if no I/O; async if DB or external calls
- No raw SQL — always use SQLAlchemy ORM
