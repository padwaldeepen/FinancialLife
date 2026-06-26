# FinanceFlare — Project Plan

## Overview

FinanceFlare is a **free, open-source personal finance tracker** built to solve what paid apps (YNAB, Monarch, Copilot) get wrong. The core insight: typing `"spent 15 on groceries"` should be all it takes to log a transaction. No subscriptions, no bank-sync headaches, no learning curve — just instant expense tracking on mobile and desktop.

---

## Market Research (June 2026)

### Why Paid Apps Lose Users

| Pain Point | YNAB ($109/yr) | Monarch ($99/yr) | Copilot ($95/yr) |
|------------|---------------|-----------------|------------------|
| Bank sync breaks constantly | ✓ #1 complaint | ✓ #1 complaint | ✓ #1 complaint |
| Learning curve too steep | ✓ 2-4wks to click | ✗ | ✗ |
| Credit card handling confusing | ✓ massive churn | ✗ | ✗ |
| No free tier (trial only) | ✓ 34 days | ✓ 30 days | ✓ 7 days |
| Privacy concerns (Plaid) | ✓ | ✓ | ✓ |
| EU bank support absent | ✓ no PSD2 | ✓ limited | ✓ no PSD2 |
| Price increases over time | ✓ 118% since 2015 | ✓ | ✓ |
| Feature bloat / overwhelming | ✓ | ✓ growing | ✗ |

### What Users Actually Want

Based on analysis of ~2000 user reviews, industry reports (PYMNTS, MX, Decta), and open-source community comparisons:

1. **Zero-friction entry** — the #1 reason people quit budgeting apps is manual entry fatigue
2. **Privacy they can trust** — 37% of users reject Plaid-based sync on principle; self-hosted is the only real answer
3. **Free forever** — $109/yr to save money feels ironic; users want a real free tier, not a trial
4. **Works offline** — budgeting happens everywhere; server-only design fails in practice
5. **Clear, non-judgmental feedback** — red alerts and shame triggers cause avoidance, not behavior change
6. **Investment + net worth tracking** — YNAB/Actual don't do it; users pair separate apps
7. **Recurring transaction detection** — automatic subscription/bill surfacing
8. **Multi-currency** — a hard blocker for international users
9. **Better reporting** — Sankey flows, calendar view, spending trends over custom ranges
10. **CSV import/export** — bank-agnostic data portability; every reviewer asks for it

### Open-Source Landscape (2026)

| Project | Stars | Stack | Best For | Missing |
|---------|-------|-------|----------|---------|
| Firefly III | 16k | PHP/Laravel + Postgres | Double-entry bookkeeping | No native mobile app, heavy, no quick-add |
| Actual Budget | 15k | Node.js + SQLite | Envelope budgeting (YNAB replacement) | No investments, US-centric sync, no quick-add |
| Securo | 1k | FastAPI + React + Tailwind | Privacy-first, AI agents | Heavy stack (Celery+Redis), Tailwind, Brazilian-first |
| Ghostfolio | 4k | NestJS + Angular | Investment portfolio only | No budgeting/tracking at all |
| FinanceFlare | — | FastAPI + React + Radix + CSS Modules | **Quick-add first, mobile-native** | Early stage; needs more features |

**Gap FinanceFlare fills:** No open-source tracker has quick-add as the primary interface. All competitors assume you'll import bank statements or manually enter category/amount/date forms. FinanceFlare's "spent 15 on groceries" flow eliminates the friction that kills adoption.

---

## Status — What's Built (Phases 0–9 Complete)

### Phase 0 — Tooling & Config
**Done:** Frontend toolchain (Vite 8, TypeScript 6, Radix Themes, Nivo 0.99, Zustand 5, TanStack Query 5, ESLint flat config), backend toolchain (FastAPI 0.138, SQLAlchemy 2.0.51, Alembic 1.18.4, ruff), Docker Compose, opencode rules

### Phase 1 — Theme + Global CSS
**Done:** `src/theme.tsx` — single ThemeProvider wrapping Radix `<Theme>` with accentColor="orange"

### Phase 2 — Radix Themes Integration
**Done:** `@radix-ui/themes` components used directly (Button, Card, TextField, Dialog, Select, DropdownMenu, etc.), CSS imported before custom styles

### Phase 3 — Layouts
**Done:**
- **Desktop:** Sidebar + TopBar + DesktopLayout + DesktopApp.tsx
- **Mobile:** BottomTabBar + FAB + MobileLayout + MobileApp.tsx
- Device detection via `matchMedia(1024px)` in `main.tsx`

### Phase 4 — Authentication
**Done:** Login + Register pages (Desktop + Mobile), Zustand authStore, JWT token management, `/api/auth/*` endpoints

### Phase 5 — Natural Language Quick-Add ⭐
**Done:** Single text input → rule-based parser → instant transaction. "spent 15 on groceries" becomes a saved expense in one tap. No AI dependency, zero cost per call. Backend `/api/transactions/parse` and `/api/transactions/quick-add` endpoints

### Phase 6 — Transaction History
**Done:** List with search/filter/sort, Desktop table with column sorting, Mobile card list with swipe-to-delete, edit, delete, load-more pagination

### Phase 7 — Dashboard
**Done:** Balance cards (income/expenses/net), Nivo Pie chart (spending by category), Nivo Bar chart (category breakdown), recent transactions, different layouts for mobile vs desktop

### Phase 8 — Budgets
**Done:** Create/view/edit budgets, progress bars with spending limits, over-budget warnings (orange/red), per-period spending auto-calculation

### Phase 9 — Receipt Scanning
**Done:** Camera button (mobile) / file upload (desktop), Tesseract.js OCR runs entirely in browser, extracted data pre-fills transaction form, backend `/api/ai/categorize` uses rule-based parser

---

## Backend Architecture

### Project Structure
```
backend/
├── core/
│   ├── config.py           Settings (pydantic-settings)
│   ├── security.py         Password hash + JWT
│   └── logging.py          Structured logging (get_logger)
├── database/
│   ├── __init__.py
│   ├── session.py          Engine, Base, get_db
│   ├── models.py           User, Category, Transaction, Budget
│   ├── alembic.ini
│   ├── init.sql
│   └── alembic/
├── routers/
│   ├── __init__.py
│   ├── auth.py             /register, /login, /me
│   ├── transactions.py     CRUD + /parse + /quick-add + /summary/dashboard
│   ├── budgets.py          CRUD
│   └── ai.py               Rule-based categorization
├── services/
│   ├── __init__.py
│   └── transaction_service.py  NL parser (rule-based)
├── main.py
├── requirements.txt
├── pyproject.toml          Ruff config
├── .env
├── Dockerfile
└── .dockerignore
```

### N+1 Query Fixes (Applied)
- `joinedload(Transaction.category)` on all list/single GET endpoints
- `joinedload(Budget.category)` on all budget GET endpoints
- Validated category objects reused instead of re-queried in create endpoints

### DateTime Consistency (Applied)
- All `DateTime(timezone=True)` → `DateTime` (naive)
- Matches Python-side `datetime.now()` usage

---

## Roadmap — What's Next

### Phase 10 — CSV & OFX Import (High Priority)
*Users want to bring existing data from their bank or another app. This is the #1 feature gap.*
- **Backend**: `/api/import/csv`, `/api/import/ofx` endpoints with column mapping, duplicate detection
- **Frontend**: Desktop drag-and-drop zone + mobile file picker, preview & confirm flow
- **Models**: `ImportLog` table for tracking imports, rollback support
- **Why**: Every bank exports CSV/OFX. Bank-sync via Plaid is unreliable (top complaint across all apps) — file import is the reliable fallback that most apps treat as second-class

### Phase 11 — Recurring Transactions (High Priority)
*Subscriptions, rent, utilities — these make up 60%+ of monthly spending and should not require manual entry.*
- **Backend**: `RecurringTransaction` model (interval, next_date, end_date), auto-create on a scheduler or on-read
- **Frontend**: Recurring list page + "make recurring" toggle on any transaction
- **Detection**: Rule engine auto-detects recurring patterns from existing transactions
- **Why**: The biggest gap vs Firefly III and Actual Budget

### Phase 12 — Investment & Net Worth Tracking (High Priority)
*Users want to see their full financial picture, not just cash flow.*
- **Backend**: `Account` model (type: checking/savings/credit/investment/loan), `AccountBalance` with date snapshots, `/api/accounts/` CRUD + `/api/accounts/net-worth` time series
- **Frontend**: Net worth line chart (Nivo Line), account cards with balances, add account modal
- **Why**: YNAB and Actual Budget both lack this; users pair Ghostfolio or manually calculate. Bringing it in-house eliminates the second app

### Phase 13 — PWA & Offline Support (High Priority)
*Budgeting happens in the moment — at the store, after a meal, on the go. Server-only fails here.*
- Service worker with Workbox for caching
- `uiStore` persists pending transactions to IndexedDB
- Mobile: installable on home screen, full offline mode
- Background sync when connection returns
- **Why**: The #3 complaint about self-hosted tools is mobile UX; a PWA costs nothing and fixes it

### Phase 14 — Transaction Rules Engine (Medium Priority)
*Auto-categorize based on description patterns — essential for anyone who imports bank data.*
- **Backend**: `TransactionRule` model (match_pattern, category_id, transaction_type), evaluated on create/import
- **Frontend**: Rules list page + rule builder UI (pattern field, category picker, test button)
- **Why**: Firefly III's rule engine is the feature users praise most; manual categorization is the second-biggest friction point after data entry

### Phase 15 — Sankey & Advanced Reporting (Medium Priority)
*"Where does my money actually go?" — Sankey diagrams answer this at a glance.*
- Nivo Sankey chart showing money flow from accounts → categories
- Custom date ranges, year-over-year comparison
- Export to PDF/CSV
- **Why**: Nivo already has the Sankey component; the data model supports it. No other OSS tool has a good Sankey

### Phase 16 — Savings Goals (Medium Priority)
*Track towards specific targets (vacation, emergency fund, down payment).*
- **Backend**: `Goal` model (target_amount, current_amount, target_date, category_id)
- **Frontend**: Goal cards with progress rings, contribution tracking, "auto-save" suggestions
- **Why**: The most-requested feature after budgeting itself across all user surveys

### Phase 17 — Multi-Currency (Medium Priority)
*International users are locked out of YNAB/Actual without manual conversion.*
- Add `currency` column to Transaction and Account models
- Live exchange rates via free API (exchangerate.host or similar)
- Per-account currency setting, auto-conversion in reports
- **Why**: 60% of the open-source community asks about multi-currency before trying a new tool

### Phase 18 — Calendar View (Low Priority)
*Visualize bills, paydays, and spending on a calendar — powerful for cash-flow planning.*
- **Backend**: Calendar aggregation endpoint
- **Frontend**: Monthly calendar grid with transaction dots, bill due markers, income highlights
- **Why**: Premium feature in YNAB; surprisingly few OSS tools offer it

### Phase 19 — Debt Payoff Planner (Low Priority)
*Avalanche vs snowball comparison, per-debt progress, payoff date projection.*
- **Backend**: `Debt` model (balance, rate, min_payment), payoff simulation
- **Frontend**: Comparison view, payoff calendar, "what if extra payment" slider
- **Why**: Unique selling point — no OSS tool has a good debt payoff calculator built in

### Phase 20 — Collaborative Budgets (Low Priority)
*Shared household budgets with partner/roommate — the #1 feature request from partnered users.*
- **Backend**: Household/group model, shared budgets with permissions
- **Frontend**: Partner invite flow, shared category view, role separation
- **Why**: Complex but high-impact for the target audience; only Monarch does this well

---

## Key Differentiators vs Competition

| Differentiator | FinanceFlare | YNAB | Actual Budget | Firefly III |
|----------------|-------------|------|---------------|-------------|
| **NL quick-add** | ⭐ Core UX — 1 tap | Manual form | Manual form | Manual form |
| **Price** | $0 (AGPL) | $109/yr | $0 (self-host) + $1.50/mo sync | $0 |
| **Bank sync** | Manual import (reliable) | Plaid (breaks constantly) | SimpleFIN ($1.50/mo) | GoCardless (EU only) |
| **Privacy** | Self-hosted, no Plaid | Third-party Plaid | Self-hosted w/ E2EE | Self-hosted |
| **Mobile UX** | Native-feel mobile app | Good mobile app | PWA only | No native mobile |
| **Investment tracking** | ✓ Planned | ✗ | ✗ | ✓ Basic |
| **Sankey diagrams** | ✓ Planned | ✗ | ✗ | ✗ |
| **Debt payoff planner** | ✓ Planned | ✗ | ✗ | ✗ |
| **Receipt scanning** | ✓ Built (Tesseract.js) | ✗ | ✗ | ✗ |
| **Offline support** | ✓ Planned (PWA) | ✓ Partial | ✓ Local-first | ✗ |
| **Learning curve** | Minimal — type to track | 2-4 weeks | 1-2 weeks | Moderate |
| **Rule engine** | ✓ Planned | ✗ | ✗ | ✓ Built-in |

---

## Build Priority Summary

| Phase | Feature | Effort | Impact | When |
|-------|---------|--------|--------|------|
| 10 | CSV/OFX Import | Medium | 🔥 High | Now |
| 11 | Recurring Transactions | Medium | 🔥 High | Next |
| 12 | Investment & Net Worth | Medium | 🔥 High | Next |
| 13 | PWA & Offline | Medium | 🔥 High | Next |
| 14 | Transaction Rules | Medium | ⚡ Medium | Soon |
| 15 | Sankey & Reports | Low | ⚡ Medium | Soon |
| 16 | Savings Goals | Low | ⚡ Medium | Soon |
| 17 | Multi-Currency | Medium | 🌍 Medium | Later |
| 18 | Calendar View | Low | 📅 Low | Later |
| 19 | Debt Payoff Planner | Medium | 💳 Low | Later |
| 20 | Collaborative Budgets | High | 👨‍👩‍👧‍👧 Low | Later |

---

## Backend Conventions

- **Routers are thin** — validate input with Pydantic, call service, return response
- **Services contain business logic** — password hashing, token creation, NL parsing
- **Models in database/models.py** — SQLAlchemy 2.x declarative style
- **Every schema change requires an Alembic migration**
- No raw SQL — always use SQLAlchemy ORM
- **N+1 prevention** — use `joinedload()` on all list queries
- **Format before commit** — `ruff check . && ruff format .` in `backend/`

---

## opencode Configuration

### opencode.json
```json
{
  "$schema": "https://opencode.ai/config.json",
  "instructions": [
    "AGENTS.md",
    "rules/frontend.md",
    "rules/backend.md",
    "rules/database.md",
    "rules/ui-ux.md",
    "rules/git.md"
  ],
  "mcp": {
    "chrome-devtools": {
      "type": "local",
      "command": ["npx", "-y", "chrome-devtools-mcp@latest"],
      "enabled": true
    },
    "playwright": {
      "type": "local",
      "command": ["npx", "-y", "@playwright/mcp@latest"],
      "enabled": true
    }
  }
}
```

### Rule Files
| File | What it enforces |
|------|-----------------|
| `rules/frontend.md` | React 19 + TypeScript + CSS Modules + Radix UI + Nivo + Zustand + TanStack Query |
| `rules/backend.md` | FastAPI thin routers + services layer, Pydantic v2, JWT auth, ruff formatting |
| `rules/database.md` | SQLAlchemy 2.x ORM, Alembic for every schema change, migration naming |
| `rules/ui-ux.md` | CSS Modules only, no Tailwind/inline, mobile-first, desktop vs mobile separation |
| `rules/git.md` | Feature branches, conventional commits, small focused commits |

---

## License

AGPL-3.0 — keeps the project free for everyone.
