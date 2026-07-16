# My Financial Life — Implementation Report

**Date:** July 16, 2026  
**Context:** Localhost-only personal finance app. One user. Not deployed anywhere.  
**Goal:** Understand where my money goes, how much I earn, and get advice on saving.  
**Branch:** `feat/premium-ui-redesign` — 46 commits, 209 files, +26,602 / -6,123 lines

---

## What This App Is

A personal finance app that runs entirely on my machine. I type `"coffee 4.50"` and it logs the transaction. I can see where my money goes across categories, merchants, and accounts. It tracks bills, goals, and budgets. It has an AI chatbot for questions. It generates reports with charts. Everything stays on my localhost — no cloud, no subscriptions, no bank sync.

---

## What's Built and Working

### Authentication
- Registration with username, email, password (with confirmation and show/hide toggle)
- Login with JWT tokens (30min access + 7d refresh in httpOnly cookie)
- Automatic token refresh via axios interceptor

### Transaction System
- Natural language input: `"spent 25.50 on coffee at starbucks"` → parsed automatically
- Full CRUD: create, read, update, delete
- Search, filter by type/category/merchant/date range
- Infinite scroll on transaction list
- CSV import with column mapping and preview
- CSV export with date range filtering

### Financial Organization
- **Accounts**: checking, savings, credit, cash, investment — each with icon
- **Categories**: hierarchy (parent/child), system + user-created, spending analytics
- **Merchants**: auto-extracted from transactions, rename, merge duplicates, spending charts
- **Bills**: recurring bills with frequency, due dates, variable amounts, payment history
- **Goals**: save_up, pay_down, monthly_envelope — with progress tracking and contribution history

### Dashboard & Reports
- Home screen: balance cards, recent transactions, upcoming bills, goal progress
- Monthly reports: income, expenses, net savings, category breakdown, top merchants
- Category analytics: pie charts (spending distribution), bar charts (comparison)
- YoY comparison: month-to-month trends

### AI Features
- **Chatbot**: floating assistant (desktop), NVIDIA LLM + rule-based fallback, can log transactions from chat
- **NL Parsing**: rule-based + optional Gemini/Groq AI, zero-cost default
- **Receipt OCR**: Tesseract.js runs entirely in browser

### UI/UX
- **Desktop**: persistent sidebar, sticky top bar, two-column layouts, Cmd+N quick-add
- **Mobile**: bottom tab bar, FAB, bottom sheets, swipe-to-delete, pull-to-refresh
- **Dark mode**: toggle via Radix theme
- **Charts**: Nivo pie and bar charts throughout
- **Skeleton loading**: shimmer animations on data-heavy pages

---

## Code Review Findings (July 2026)

A thorough review was done across Technical Lead, UI/UX Expert, and Financial Manager perspectives.

### Critical Data Integrity Issues

| Issue | Impact | Status |
|-------|--------|--------|
| Money columns use `Float` instead of `Numeric(12,2)` | Rounding errors on amounts — phantom pennies/dollars | 🔧 Needs fix |
| `bill_id` and `goal_id` on Transaction have no `ForeignKey` | Any integer accepted, no referential integrity | 🔧 Needs fix |
| `account_type`, `transaction_type`, `frequency` accept any string | Typo in "expense" → transaction disappears from reports | 🔧 Needs fix |
| `compute_upcoming` doesn't `await` db.execute() | Bills always show as "paid" even when unpaid | 🔧 Needs fix |
| No `amount > 0` validation | Negative and zero amounts accepted | 🔧 Needs fix |

### Security Issues (Low Priority for Localhost)

| Issue | Impact | Status |
|-------|--------|--------|
| `/api/transactions/parse` has no auth | Public endpoint — low risk on localhost | 🔧 Should fix |
| SECRET_KEY defaults to empty string | JWT signed with `""` if `.env` missing | 🔧 Should fix |
| No password complexity requirements | 1-char passwords accepted | 🔧 Should fix |
| Rate limiter is in-memory per-process | Useless with multiple workers — irrelevant for localhost | ⏭️ Skip |

### UI Issues

| Issue | Impact | Status |
|-------|--------|--------|
| `--bg-deep` and `--bg-panel` CSS vars undefined | Dark mode broken on mobile layout + mobile login | 🔧 Needs fix |
| Two FABs on mobile (MobileLayout + BottomTabBar) | Two floating add buttons overlap | 🔧 Needs fix |
| `window.confirm()` in Settings | Breaks polished design language | 🔧 Needs fix |
| ChatBot uses ~17 raw `<div>`s | Violates project rules (should use Radix) | 🔧 Should fix |
| Desktop has zero responsive breakpoints | Two-column layouts overflow at narrow widths | ❌ Nice to have |

### Architecture Notes

| Pattern | Current State |
|---------|---------------|
| Routers vs Services | Routers are fat (745 lines in transactions.py), services are thin |
| Shared schemas | Response models redefined per router instead of shared |
| Ownership checks | Transaction ownership checked, but bill ownership not checked in link/unlink |

---

## Architecture

### Frontend (React 19 + TypeScript + Vite)

```
frontend/src/
├── auth/                  # AuthContext, API client, types
├── desktop/               # Desktop-specific
│   ├── pages/            # Home, Activity, Bills, Categories, Goals, Merchants, Reports, Settings
│   ├── components/       # Sidebar, TopBar, ChatBot, AddTransactionModal
│   └── layouts/          # DesktopLayout (sidebar + topbar + content)
├── mobile/                # Mobile-specific
│   ├── pages/            # Same pages, mobile-optimized
│   ├── components/       # BottomTabBar, FAB, AddTransactionModal
│   └── layouts/          # MobileLayout (tab bar + content)
├── shared/                # Business logic only
│   └── utils/            # formatCurrency, formatDate, etc.
├── store/                 # Zustand state
│   ├── namespaceSlice.ts # Helper for auto-namespacing
│   ├── useBoundStore.ts  # Combined store
│   └── slices/           # auth, transactions, bills, categories, merchants, goals, budgets, reports, ui
├── styles/                # Global CSS, design tokens
└── theme.tsx             # Radix Theme wrapper (accentColor="orange", grayColor="slate")
```

### Backend (FastAPI + SQLAlchemy + PostgreSQL)

```
backend/
├── core/                  # Config, security, middleware, logging
├── database/              # Models, session, Alembic migrations
├── routers/               # API route handlers (auth, transactions, bills, categories, merchants, goals, budgets, reports, export, chat, ai)
├── services/              # Business logic
│   ├── transaction_service.py  # NL parsing
│   ├── bill_service.py         # Bill auto-linking, upcoming calculation
│   ├── merchant_service.py     # Merchant extraction, merge
│   ├── category_service.py     # Category CRUD, hierarchy
│   ├── account_service.py      # Account CRUD
│   ├── goal_service.py         # Goal contributions
│   └── ai/                     # AI providers (Gemini, rule-based)
├── main.py                # FastAPI app setup
└── pyproject.toml         # Ruff config
```

### Database Schema

```
Users
├── Accounts (type, name, balance, icon)
├── Categories (name, parent_id, is_system, color, icon)
├── Transactions (amount, description, type, date, account_id, category_id, merchant_id, bill_id, goal_id)
├── Merchants (name, normalized_name)
├── Bills (name, amount, frequency, due_day, is_variable, account_id, category_id, merchant_id)
├── TransactionBillLinks (transaction_id, bill_id)
├── Goals (name, type, target_amount, current_amount, deadline)
└── Budgets (name, amount, period, category_id)
```

---

## What the App Does vs. What I Need

### Already Solved ✅
1. **Track spending easily** — NL input, <5 seconds to log
2. **See where money goes** — category pie charts, merchant breakdown, monthly reports
3. **Track recurring expenses** — bills with auto-linking
4. **Track savings goals** — progress bars, contribution history
5. **Export data** — CSV export for any date range

### Partially Solved ⚠️
1. **Recurring expense management** — Bills exist but no auto-generation of future transactions
2. **Budget tracking** — Budgets exist but no proactive alerts when approaching limits

### Not Yet Solved ❌
1. **Where can I save money?** — No spending analysis or recommendations
2. **Am I overspending?** — No anomaly detection or trend alerts
3. **What subscriptions can I cut?** — No subscription detection
4. **Cash flow forecasting** — Can't predict next month's balance
5. **Personalized advice** — Chat exists but no proactive insights

---

## Roadmap: From Tracker to Advisor

Since this is for personal use on localhost, the roadmap focuses on **what helps me most**:

### Next Priority: Make Financial Data Reliable
1. Fix `Float` → `Numeric(12,2)` for money columns
2. Fix all enum validation
3. Fix bill "always paid" bug
4. Add missing ForeignKey constraints

### After That: Make the App Pleasant to Use
1. Fix dark mode on mobile
2. Remove duplicate FAB
3. Replace window.confirm with Radix Dialog
4. Add desktop responsive breakpoints

### Then: Add Intelligence (The Real Goal)
1. **Spending insights**: "You spent 30% more on food this month"
2. **Subscription detection**: Find recurring charges automatically
3. **Savings suggestions**: "You could save $120/month by cutting X"
4. **Cash flow forecast**: "Based on your income and bills, you'll have $X left at month end"
5. **Anomaly alerts**: "Your utility bill is 40% higher than usual"

---

## How to Run

```bash
# Start everything with Docker
docker-compose up

# Frontend: http://localhost:3000
# Backend API: http://localhost:8080
# PostgreSQL: localhost:5432
```

Or for development:
```bash
# Backend
cd backend && uvicorn main:app --reload

# Frontend
cd frontend && npm run dev
```

---

## Project Rules

1. No new features outside the plan
2. Every phase must work before moving to the next
3. Run lint + format before committing
4. AI must always be optional (works without API keys)
5. Only free APIs (no OpenAI, no paid services)
6. CSS Modules only (no Tailwind, no inline styles)
7. Desktop and mobile are separate (no shared CSS)
8. Use Radix UI directly (no custom wrappers)
9. Zustand for all global state
10. Every DB change needs an Alembic migration
11. This runs on localhost only (no deployment concerns)
