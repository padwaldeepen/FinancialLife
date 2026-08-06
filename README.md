# My Financial Life

A private, self-hosted personal finance app. It lives on your own computer — not in
someone else's cloud, nothing to subscribe to. Type `spent 15 on groceries` or snap a
receipt and it's logged; it tells you plainly where you stand instead of waiting for you
to dig through a spreadsheet.

## Highlights

- **Type or scan** — natural-language quick-add, or photograph a receipt/statement
  (duplicate-safe).
- **One number, "safe to spend"** — accounts for upcoming bills and your usual pace, not
  just today's balance.
- **Notices things on its own** — a subscription price crept up, a category's running
  high — always with the real numbers behind the claim.
- **Every family member gets their own private login.** Multi-country support (US/India/
  Canada) — each country is a separate, single-currency world, never merged or converted.
- **Private by default.** Nothing leaves your machine unless you turn on the one optional
  cloud AI feature yourself. No bank linking, no ads, no subscriptions.

## Tech stack

React 19 + TypeScript + Vite + Radix UI + Zustand (frontend) · FastAPI + raw `asyncpg`
SQL (no ORM) + PostgreSQL (backend) · rules-based parsing + local OCR, with optional
[Gemini](https://ai.google.dev/) (free tier, opt-in, off by default) · Docker Compose.

## Quick start

```bash
git clone <this-repo>
cd FinanceFlareAI
cp backend/.env.example backend/.env
```

Set `SECRET_KEY` in `backend/.env` to a random value (the backend won't start without
one): `python -c "import secrets; print(secrets.token_hex(32))"`. `GEMINI_API_KEY` is
optional — leave it blank to run fully offline.

```bash
docker compose up -d
```

Frontend: http://localhost:3000 · Backend: http://localhost:8080/docs

**From your phone**: same WiFi, open `http://<your-pc's-LAN-IP>:3000`. No app install.
Camera receipt-scanning needs HTTPS, so over plain LAN it falls back to picking from your
gallery instead — see `docs/DEVELOPMENT.md` for details.

Local dev without Docker, backups, and troubleshooting: `docs/DEVELOPMENT.md`.

## Project structure

`backend/` — FastAPI, raw SQL via asyncpg, Alembic migrations · `frontend/src/` —
`desktop/` and `mobile/` are separate UI trees sharing one backend and `shared/`/`store/`
logic · `docs/` — architecture, design system, roadmap · `rules/` — coding conventions.

This project is built with AI coding assistants — `CLAUDE.md` and `rules/*.md` are the
brief they (and any contributor) should read first.

## Privacy & security

No secrets are committed to this repo — real `.env` files are gitignored and were never
part of the git history.

## License

AGPL-3.0 — free for everyone.
