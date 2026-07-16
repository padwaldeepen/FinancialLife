# My Financial Life

Privacy-first personal finance app on localhost. Tracks spending across USD/INR/CAD and
advises: monthly/annual breakdowns, recurring-bill detection, cash-flow forecast,
safe-to-spend, document (bill/receipt/statement) scanning with dedup.

**Read before working:** `docs/plan.md` (roadmap + definition of done) and
**`docs/backlog.md` (the ticket file — all implementation work comes from here: pick the
lowest open ticket whose dependencies are done, stay inside its scope, never invent
work)**. Reference specs: `docs/architecture-and-goals.md` (system + data model + AI
allocation), `docs/design-system.md` (3-color UI rules + page map). Stale analysis
reports live in `docs/archive/` — ignore them.

## Tech Stack

- **Frontend**: React 19, TypeScript, Vite, CSS Modules, Radix UI Themes, Nivo charts
- **State**: Zustand slices (client + API data via slice actions)
- **Backend**: FastAPI (async), SQLAlchemy 2.x, Alembic, PostgreSQL, JWT auth
- **AI tiers**: rules/statistics always; Ollama (local) for document understanding;
  cloud free APIs are opt-in only and OFF by default

## Project Structure

- `backend/` — FastAPI app (`core/`, `database/`, `routers/`, `services/`, `tests/`)
- `frontend/src/` — `desktop/` and `mobile/` (separate trees), `shared/`, `store/`, `styles/`
- `rules/` — coding rules (wired into opencode.json; apply in any tool)
- `docs/` — the four living docs above

## Key Conventions

- Routers are thin; business logic lives in `services/` (pure functions where possible)
- Every DB schema change ships with an Alembic migration
- SQLAlchemy ORM only, never raw SQL
- Money math requires tests (`backend/tests/`, pytest)
- Every component: `Name.tsx` + `Name.module.css`; no Tailwind, no inline styles
- Colors: Radix tokens only, per `docs/design-system.md` (slate + orange + money
  green/red on amounts only — no other hues)
- Desktop = analyze/manage (full features + admin), mobile = capture/glance (trimmed);
  layouts never shared, logic/hooks always shared
- Cloud AI calls must stay behind the opt-in settings toggle

## Required After Every Change

1. Frontend: `npm run lint:fix && npm run format:fix` (from `frontend/`)
2. Backend: `ruff check . && ruff format .` (from `backend/`)
3. Backend tests: `pytest` (from `backend/`)
4. Self-review the diff against `rules/code-review.md` before committing
   (in Claude Code: run the `/finance-review` skill, defined in `.claude/skills/`)

## Commands

- `docker compose up -d` — run everything
- `uvicorn main:app --reload` — backend dev (from `backend/`)
- `alembic upgrade head` / `alembic revision --autogenerate -m "desc"` — migrations
- `npm run dev` / `npm run build` — frontend (from `frontend/`)

## MCP Tools

Configured for opencode in `opencode.json` and for Claude Code in `.mcp.json` (same servers):
- `playwright` — browser automation, E2E flows
- `chrome-devtools` — debugging, screenshots, console, network
