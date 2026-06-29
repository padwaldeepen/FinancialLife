# FinanceFlare

Free, open-source personal finance tracker.

## Tech Stack

- **Frontend**: React 19, TypeScript, Vite, CSS Modules, Radix UI, Nivo charts
- **State**: Zustand (all state — client + API data via slice actions)
- **Backend**: FastAPI, SQLAlchemy 2.x, Alembic, PostgreSQL, JWT auth
- **AI**: Rule-based NL parsing (no paid API)

## Project Structure

- `backend/` — FastAPI app (database, routers, services, alembic)
- `frontend/` — React app (shared, desktop, mobile as separate apps)
- `rules/` — opencode instruction files

## Key Conventions

- Every component → `Name.tsx` + `Name.module.css`
- No Tailwind, no inline styles, no CSS-in-JS
- Radix UI for behavior/accessibility; CSS Modules for all visuals
- Desktop and mobile have completely separate components and layouts
- Backend routers are thin; business logic goes in services
- Every DB schema change requires an Alembic migration
- Always use SQLAlchemy ORM, never raw SQL

## Required After Every Change

- Frontend: `npm run lint:fix && npm run format:fix` (from `frontend/`)
- Backend: `ruff check . && ruff format .` (from `backend/`)
- Always run both before committing

## Commands

- `uvicorn main:app --reload` — start backend
- `alembic upgrade head` — run migrations
- `npm run dev` — start frontend
- `npm run build` — build frontend
- `pip-compile requirements.in` — lock dependencies

## MCP Tools Available

- `chrome-devtools` — browser debugging, screenshots, console, network, Lighthouse
- `playwright` — browser automation, form filling, E2E testing
