# My Financial Life

Free, open-source personal finance tracker. Track your expenses by typing "spent 15 on groceries" — zero friction, zero cost.

## Features

- 🔐 JWT authentication
- 💰 Natural language quick-add ("spent 15 on groceries")
- 📊 Interactive dashboard with Nivo charts
- 📱 Mobile app (PWA) + 💻 Desktop app — different UX for each
- 🌙 Dark/light mode
- 🤖 Free AI parsing (no paid API)

## Tech Stack

- **Frontend**: React 19, TypeScript, Vite, CSS Modules, Radix UI, Nivo charts
- **State**: Zustand (all state — client + server data via slice actions)
- **Backend**: FastAPI, SQLAlchemy 2.x, Alembic, PostgreSQL, JWT auth
- **AI**: Rule-based NL parsing (no paid API, no OpenAI)

## Quick Start

### Without Docker (recommended for development)

#### Backend

```bash
# Prerequisites: Python 3.13+, PostgreSQL running locally

cd backend

# Create and activate virtual environment
python -m venv venv

# Windows:
venv\Scripts\activate
# macOS/Linux:
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Run database migrations
alembic upgrade head

# Start the server
uvicorn main:app --host 0.0.0.0 --port 8080 --reload
```

#### Frontend

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:3000

### With Docker

```bash
docker-compose up --build -d
```

Access:
- Frontend: http://localhost:3000
- Backend API: http://localhost:8080
- API Docs: http://localhost:8080/docs

## Environment Variables

Backend config is in `backend/.env`. Copy the template:

```bash
copy backend\.env.example backend\.env   # Windows
# cp backend/.env.example backend/.env   # macOS/Linux
```

Then edit with your credentials. No OpenAI key needed — all AI features use free local parsing.

## Project Structure

```
My Financial Life/
├── backend/
│   ├── database/         SQLAlchemy models + session
│   ├── routers/          FastAPI route handlers (thin)
│   ├── services/         Business logic + NL parsing
│   ├── alembic/          Database migrations
│   └── main.py           FastAPI app
├── frontend/
│   ├── shared/           Shared logic (stores, services, theme)
│   ├── desktop/          Desktop-specific UI
│   ├── mobile/           Mobile-specific UI
│   └── main.tsx          Device detection entry point
├── rules/                opencode instruction files
├── AGENTS.md
├── opencode.json
└── docker-compose.yml
```

## Development Commands

| Command | Description |
|---------|-------------|
| `uvicorn main:app --reload` | Start backend |
| `alembic upgrade head` | Run migrations |
| `alembic revision --autogenerate -m "desc"` | Create migration |
| `npm run dev` | Start frontend |
| `npm run build` | Build frontend |
| `pip install -r requirements.txt` | Install dependencies |

## License

AGPL-3.0 — Free for everyone.
