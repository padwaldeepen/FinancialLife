# Development Guide

> Last updated: 2026-08-05
> Practical setup, backups, tooling, and troubleshooting. Current status lives in
> `plan.md`; execution tickets in `backlog.md`.

---

## 1. Setup

### Prerequisites
- Docker Desktop (Postgres + full-stack runs), or: Python 3.13+, Node 20+, local PostgreSQL
- `backend/.env` — copy from `env.example`, then set `SECRET_KEY`
  (`python -c "import secrets; print(secrets.token_hex(32))"`). The app **refuses to start**
  without it.

### Run everything (Docker)
```powershell
docker compose up --build -d
# Frontend http://localhost:3000 | API http://localhost:8080 | API docs http://localhost:8080/docs
```

### Run for development (hot reload)
```powershell
# Backend
cd backend; .\venv\Scripts\activate
pip install -r requirements.txt
alembic upgrade head
uvicorn main:app --host 0.0.0.0 --port 8080 --reload

# Frontend (second terminal)
cd frontend; npm install; npm run dev
```

### Verify a fresh setup works (Phase T checklist)
1. Register a user, log in
2. Quick-add: `coffee 4.50` → transaction appears
3. Create a bill, link a transaction
4. Open Insights — charts render
5. Export CSV — file downloads

If any step fails on a clean clone, that's a setup bug — fix it and update this file.

---

## 2. Backups (do this before trusting the app with real data)

### Manual backup / restore
```powershell
# Backup
docker exec myfinanciallife-postgres pg_dump -U myfinanciallife_user -d myfinanciallife > "D:\Backups\finance-$(Get-Date -Format 'yyyy-MM-dd').sql"

# Restore (into a running postgres container)
Get-Content "D:\Backups\finance-YYYY-MM-DD.sql" | docker exec -i myfinanciallife-postgres psql -U myfinanciallife_user -d myfinanciallife
```

### Automated (Windows Task Scheduler)
1. Save the backup command as `scripts/backup.ps1`
2. Task Scheduler → weekly task → `powershell -File d:\Projects\FinanceFlareAI\scripts\backup.ps1`
3. Keep copies in **two places** (second disk / USB / personal cloud drive — the SQL dump
   contains your finances; encrypt it if it leaves your machine)

**A backup you haven't restored is a hope, not a backup.** Do one test restore into a
scratch database and note the date here: *last tested restore: ____*

---

## 3. Quality gates (run before every commit)

```powershell
# Frontend
cd frontend; npm run lint:fix; npm run format:fix; npm run build

# Backend
cd backend; ruff check .; ruff format .
```

No pytest files in this project — verify money math and features by driving the running
app (curl + hand-computed fixtures for backend logic, Playwright for UI), not automated
test files.

Then review the diff against `rules/code-review.md`.

### Dependency health
A scheduled cloud routine ("FinanceFlareAI Weekly Dependency Update", Sundays 3:07am ET)
runs the `dependency-updater` agent (`.claude/agents/dependency-updater.md`) automatically:
surveys `npm outdated`/`pip list --outdated`, applies safe bumps (backend major bumps are
only proposed, not applied), verifies (typecheck/lint/build, ruff, a live curl check
against the app, the `e2e/auth-flow.spec.ts` regression test), and opens a PR against
`feat/premium-ui-redesign` — it never pushes to `main` or merges anything itself. Manage
the routine at https://claude.ai/code/routines.

For an on-demand check between scheduled runs, either invoke the same agent locally or
run the underlying commands yourself:
```powershell
cd frontend; npm outdated; npx depcheck
cd backend; pip list --outdated
```

---

## 4. AI-assisted development setup

The project is coded with Claude Code. Config layout:

| File | Consumed by |
|---|---|
| `CLAUDE.md` | Claude Code (auto-loaded every session — shared project brief) |
| `rules/*.md` | referenced from `CLAUDE.md`; readable by any tool |
| `.mcp.json` | MCP servers (playwright, chrome-devtools) for Claude Code and other MCP-aware tools |
| `.claude/skills/code-review/SKILL.md` | Claude Code `/code-review` — the review checklist run against the current diff before commit |

MCP servers run via `npx`, so any IDE that supports MCP just needs the config file it
reads to point at the same commands. If an IDE still doesn't see MCP: check it supports
project-level MCP config, and that `npx` is on PATH for that IDE's environment.

### Lighthouse / performance audits (chrome-devtools MCP, no extra dependency)

The `chrome-devtools` MCP server (already in `.mcp.json`) exposes Lighthouse and
performance-trace tools directly — no `lighthouse`/`@lhci/cli` npm package needed.

- **`mcp__chrome-devtools__lighthouse_audit`** — accessibility, best-practices, SEO,
  and "agentic browsing" scores. `mode: "snapshot"` audits the page as currently
  loaded (use this for an authenticated page — log in first, then audit); `mode:
  "navigation"` reloads and audits fresh. Low SEO/agentic-browsing scores are expected
  and not worth chasing here — this is a private, localhost-only, self-hosted app with
  no public web presence (no meta description/robots.txt/llms.txt needed). Real
  accessibility findings (missing labels, unnamed buttons) are worth fixing — see the
  known gap below.
- **`mcp__chrome-devtools__performance_start_trace`** /
  **`performance_stop_trace`** — Core Web Vitals (LCP, CLS) and a call-tree/network
  breakdown for diagnosing slow loads.

Baseline run 2026-08-06 (dev-mode Vite server, not the production build — real numbers
would be better): Home — Accessibility 100, Best Practices 100, LCP ~1.1s, CLS 0.00.
Activity — Accessibility 94 (was 88; fixed the Activity date-range inputs' missing
`aria-label` while here), Best Practices 100. **Known, not fixed**: Radix
`Select.Trigger` with an empty `placeholder` has no accessible name until a value is
picked (its label is CSS-generated `content`, invisible to the accessibility tree) —
affects every unset filter Select app-wide, not just Activity's. Fixing it properly
means auditing every `Select.Trigger` for an explicit `aria-label`, which is a bigger
pass than this one page — noted here rather than fixed piecemeal.

### Optional: Postgres MCP (recommended once Phase D starts)

Lets the coding AI inspect the schema and verify data during tickets (e.g., "did the
dedup import really insert only 2 rows?"). Use restricted/read-only mode. Requires
`uv` (`pip install uv` or `winget install astral-sh.uv`), then add to `.mcp.json`:

```json
"postgres": {
  "command": "uvx",
  "args": ["postgres-mcp", "--access-mode=restricted"],
  "env": { "DATABASE_URI": "postgresql://myfinanciallife_user:<password-from-backend/.env>@localhost:5432/myfinanciallife" }
}
```

**Privacy caveat:** query results go into the coding AI's cloud context. Fine while the
DB holds test data; **disable or reconsider once real financial data goes in** (same
principle as the app's own AI allocation table).

Non-negotiable rules for AI-generated code: migrations for schema changes, tests for money
math, lint clean, review checklist applied. "It ran once" is not done — `plan.md` has the
definition of done.

---

## 5. Phone access (LAN) — optional, for mobile capture

The phone must reach your PC on the same WiFi:
```powershell
ipconfig   # find IPv4, e.g. 192.168.1.20
```
Open `http://192.168.1.20:3000` on the phone.

**Camera scanning limitation**: browsers only expose the camera on HTTPS (or localhost).
On HTTPS/localhost, "Scan" opens the OS picker with both "Take Photo" and "Photo
Library" (R3 — no `capture` attribute forcing the camera). Over plain LAN HTTP, the
camera option isn't available and the same picker falls back to gallery-only — take a
photo with the phone's own camera app first, then pick it. Proper fix for camera over
LAN: local HTTPS via Caddy or Tailscale (still optional, not required for daily use).

---

## 6. Troubleshooting

| Symptom | Fix |
|---|---|
| Backend exits at startup with `SECRET_KEY is not set` | Create `backend/.env` from `env.example`, set `SECRET_KEY` |
| DB connection refused | `docker compose ps` → postgres up? `docker compose restart postgres` |
| Migrations out of sync | `cd backend; alembic upgrade head`; if broken beyond repair on dev data: drop volume `docker volume rm financeflareai_postgres_data` (destroys data — backup first) |
| Port 3000/8080 busy | `netstat -ano | findstr :3000` → kill PID, or change port in `docker-compose.yml` |
| Phone can't reach app | Same WiFi? Windows Firewall may block node/docker — allow on private networks |
| Frontend shows stale API types | Restart `npm run dev`; check axios base URL matches backend port |

---

## 7. Reference — daily commands

```powershell
docker compose up -d          # start all
docker compose down           # stop all
docker compose logs -f backend
alembic revision -m "desc"    # new migration (from backend/) — hand-write the SQL,
                               # never --autogenerate (no ORM metadata to diff against)
alembic upgrade head
npm run dev / npm run build   # from frontend/
```
