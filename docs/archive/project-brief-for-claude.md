# My Financial Life — Project Brief for Claude

> Give this document to Claude for deep thinking about the project's direction.
> It contains everything needed to understand the current state and plan next steps.

---

## 1. What Is This Project?

**My Financial Life** is a personal finance application that runs entirely on localhost. It was built for one purpose: to help **me** understand where my money goes, how much I earn, and give me advice on how to save more.

This is **not** a SaaS product. It's not deployed anywhere. There's one user (me). My data stays on my machine. There are no subscriptions, no bank sync, no cloud services. The only external calls are optional free AI APIs (Gemini/Groq) for natural language features.

### The Core Problem I'm Solving

I want to:
1. **Log spending easily** — type "coffee 4.50" and it's done
2. **See where money goes** — category breakdowns, merchant analysis, monthly trends
3. **Track recurring expenses** — bills, subscriptions, regular charges
4. **Track savings goals** — emergency fund, vacation, debt payoff
5. **Get advice on saving** — "you could save $X by cutting Y"
6. **Forecast cash flow** — "based on income and bills, you'll have $X left"

### What Exists Today

The app is a **functional expense tracker** with:
- Natural language transaction input ("spent 25 on coffee" → parsed automatically)
- Full CRUD for transactions, accounts, categories, merchants, bills, goals, budgets
- Dashboard with balance cards, recent transactions, upcoming bills
- Category analytics with pie charts (Nivo)
- Monthly reports with income/expense/net breakdown
- CSV import/export
- AI chatbot (optional, works without API keys)
- Receipt OCR via Tesseract.js (runs in browser)
- Desktop UI (sidebar + top bar) and mobile UI (bottom tabs + FAB)
- Dark mode
- JWT authentication

### What's Missing (The Real Goal)

The app **tracks** money but doesn't yet **advise** on money. It can show me charts, but it can't tell me:
- "Your food spending jumped 40% this month"
- "You have 3 subscriptions costing $85/month that you might not need"
- "Based on your income, you could save $200/month by adjusting X"
- "You'll run out of buffer money by the 25th at current spending"

The gap is: **intelligence**. The data is there. The analysis is not.

---

## 2. Tech Stack

### Frontend
- **React 19** + **TypeScript** + **Vite**
- **CSS Modules** (no Tailwind, no inline styles, no CSS-in-JS)
- **Radix UI Themes** for all components (dialogs, selects, tabs, tables, etc.)
- **Nivo charts** (pie + bar) for data visualization
- **Zustand** for state management (namespaceSlice pattern, immer middleware)
- Separate **desktop** and **mobile** component trees (no shared CSS)

### Backend
- **FastAPI** (async Python)
- **SQLAlchemy 2.x** (declarative ORM, no raw SQL)
- **PostgreSQL** (via Docker)
- **Alembic** for migrations
- **JWT auth** (python-jose, HS256, 30min access + 7d refresh)
- **Ruff** for linting/formatting

### AI (Optional, Free Only)
- **Gemini API** (free tier) for vision/NL
- **Groq API** (free tier) for fast LLM
- **Rule-based parsing** as default fallback
- App works 100% without API keys

### Infrastructure
- **Docker Compose** (backend + frontend + postgres)
- Runs on **localhost only** — no deployment, no CI/CD
- Development mode: `uvicorn --reload` + `npm run dev`

---

## 3. Database Schema

```sql
Users (id, email, username, full_name, hashed_password, is_active, created_at)

Accounts (id, user_id, name, type, balance, icon, created_at)
  -- type: checking, savings, credit, cash, investment

Categories (id, user_id, name, parent_id, is_system, color, icon)
  -- hierarchical: parent_id → self-referencing FK

Transactions (id, user_id, account_id, category_id, merchant_id, 
              amount, description, transaction_type, date, 
              bill_id, goal_id, source, created_at, updated_at)
  -- transaction_type: income, expense, transfer
  -- source: manual, quick_add, csv_import, receipt_ocr
  -- bill_id, goal_id: optional links (currently no FK constraint — known bug)

Merchants (id, user_id, name, normalized_name, created_at)
  -- normalized_name: lowercased, trimmed for deduplication

Bills (id, user_id, name, amount, frequency, due_day, is_variable,
       account_id, category_id, merchant_id, next_due_date, created_at, updated_at)
  -- frequency: weekly, biweekly, monthly, quarterly, yearly

TransactionBillLinks (id, transaction_id, bill_id, linked_at)
  -- maps transactions to bills (no unique constraint — known bug)

Goals (id, user_id, name, goal_type, target_amount, current_amount, 
       deadline, account_id, created_at, updated_at)
  -- goal_type: save_up, pay_down, monthly_envelope

Budgets (id, user_id, name, amount, period, category_id, start_date, created_at)
  -- period: monthly, weekly, yearly
```

### Known Schema Issues
1. `amount` columns use `Float` — should be `Numeric(12,2)` for money
2. `bill_id` and `goal_id` on Transaction have no ForeignKey constraint
3. No `UniqueConstraint` on TransactionBillLink (duplicate links possible)
4. No unique constraint on `(user_id, normalized_name)` for Merchants

---

## 4. API Endpoints

### Auth
- `POST /api/auth/register` — Create account
- `POST /api/auth/login` — Get JWT tokens
- `POST /api/auth/refresh` — Refresh access token

### Transactions
- `GET /api/transactions/` — List with search, filter, sort, pagination
- `POST /api/transactions/` — Create transaction
- `PUT /api/transactions/{id}` — Update transaction
- `DELETE /api/transactions/{id}` — Delete transaction
- `POST /api/transactions/parse` — NL parsing (no auth — known issue)
- `POST /api/transactions/quick-add` — Parse + create in one step
- `POST /api/transactions/import` — Bulk CSV import (no limit — known issue)

### Accounts
- `GET/POST/PUT/DELETE /api/accounts/` — Full CRUD

### Categories
- `GET/POST/PUT/DELETE /api/categories/` — Full CRUD
- `GET /api/categories/{id}/analytics` — Spending breakdown

### Merchants
- `GET/POST/PUT/DELETE /api/merchants/` — Full CRUD
- `POST /api/merchants/{id}/merge` — Merge duplicate merchants

### Bills
- `GET/POST/PUT/DELETE /api/bills/` — Full CRUD
- `GET /api/bills/upcoming` — Next due dates
- `POST /api/bills/{id}/link` — Link transaction to bill
- `POST /api/bills/{id}/unlink` — Unlink transaction

### Goals
- `GET/POST/PUT/DELETE /api/goals/` — Full CRUD
- `POST /api/goals/{id}/contribute` — Add contribution

### Budgets
- `GET/POST/PUT/DELETE /api/budgets/` — Full CRUD

### Reports
- `GET /api/reports/monthly` — Monthly summary
- `GET /api/reports/categories` — Category breakdown
- `GET /api/reports/merchants` — Merchant analysis
- `GET /api/reports/compare` — Period comparison

### Export
- `GET /api/export/csv` — CSV download with date range

### Chat
- `POST /api/chat` — AI chat (optional, rule-based fallback)

---

## 5. Frontend Architecture

### State Management (Zustand)
```
store/
├── useBoundStore.ts          # Combined store
├── namespaceSlice.ts         # Auto-namespace state under key
└── slices/
    ├── authSlice.ts          # user, token, login, logout
    ├── transactionsSlice.ts  # transactions list, CRUD, optimistic updates
    ├── billsSlice.ts         # bills, billHistory, CRUD
    ├── categoriesSlice.ts    # categories, CRUD
    ├── merchantsSlice.ts     # merchants, CRUD
    ├── goalsSlice.ts         # goals, CRUD, contribute
    ├── budgetsSlice.ts       # budgets, CRUD
    ├── accountsSlice.ts      # accounts, CRUD
    ├── reportsSlice.ts       # report data, fetch actions
    └── uiSlice.ts            # sidebar open, modals
```

### Component Pattern
- Named arrow function exports only: `export const ComponentName = () => {`
- No default exports
- Every component: `Name.tsx` + `Name.module.css`
- Radix UI for behavior, CSS Modules for layout
- `useShallow` for multi-value store selectors
- `useState` for local form state only

### Desktop vs Mobile
- **Desktop**: Sidebar (250px fixed) + TopBar + content area
- **Mobile**: BottomTabBar (4 tabs + center add button) + FAB + content area
- Device detection: `matchMedia('(max-width: 1023px)')` at root
- No cross-imports between desktop and mobile

---

## 6. Known Bugs & Issues

### Critical (Data Integrity)
1. **Float for money** — `amount`, `target_amount`, `current_amount` use `Float`. Causes rounding errors.
2. **Missing ForeignKeys** — `bill_id`, `goal_id` on Transaction have no FK constraint.
3. **No enum validation** — `account_type`, `transaction_type`, `frequency`, `period` accept any string.
4. **Bill "always paid" bug** — `compute_upcoming` doesn't `await` db.execute(), returns truthy coroutine.
5. **No amount validation** — Negative and zero amounts accepted.

### Important (Security)
6. **No auth on parse endpoint** — `/api/transactions/parse` is public.
7. **SECRET_KEY empty default** — JWT signed with `""` if `.env` missing.
8. **No password strength** — 1-character passwords accepted.
9. **No bill ownership check** — Can link transaction to another user's bill.

### UI
10. **Dark mode broken on mobile** — `--bg-deep` and `--bg-panel` CSS vars undefined.
11. **Duplicate FAB on mobile** — Two floating add buttons.
12. **window.confirm() in Settings** — Breaks design language.
13. **ChatBot uses raw divs** — ~17 `<div>`s should be Radix components.

### Architecture
14. **Fat routers** — `transactions.py` is 745 lines of inline logic.
15. **No responsive breakpoints on desktop** — Two-column layouts overflow.
16. **N+1 on category spending** — Separate query per category.

---

## 7. What I Need From Claude

### The Big Question
**How do I turn this expense tracker into a personal financial advisor?**

Specifically, I need help thinking through:

1. **What intelligence features would actually help me?** — Not enterprise features. Not SaaS features. What would make ME, one person on localhost, better with money?

2. **What's the simplest way to build an insight engine?** — I want rule-based analysis first (no paid APIs). How do I detect spending patterns, anomalies, and trends from transaction data?

3. **How should I structure the recommendation system?** — When the app detects I'm overspending on food, how does it turn that into "you could save $X by doing Y"?

4. **What does a useful forecast look like?** — Given my income, bills, and spending patterns, how do I project my cash flow?

5. **How do I make the chatbot actually useful?** — Right now it can log transactions. How do I make it answer "where did my money go this month?" or "can I afford this purchase?"

6. **What's the right build order?** — I have limited time. What gives me the most value with the least effort?

### Constraints
- **Localhost only** — no deployment, no cloud, no bank sync
- **Free only** — no paid APIs (Gemini/Groq free tiers are fine)
- **Rule-based first** — statistical analysis before AI enhancement
- **Simple** — one-line insights, not complex dashboards
- **Honest** — "not enough data" is better than guessing

### What Would Make This a Success
If I can open the app once a week and immediately know:
- "My spending is on track this month"
- "I could save $X by cutting Y"
- "I'm on pace to hit my emergency fund goal by December"
- "My biggest waste is Z"

...then the project has achieved its goal.

---

## 8. Project Rules

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
12. Always use SQLAlchemy ORM, never raw SQL
13. Routers are thin; business logic goes in services

---

## 9. Key Files Reference

### Backend
- `backend/main.py` — FastAPI app setup
- `backend/core/config.py` — Settings (env vars)
- `backend/core/security.py` — JWT, password hashing
- `backend/core/middleware.py` — Rate limiting, security headers
- `backend/database/models.py` — All SQLAlchemy models
- `backend/routers/transactions.py` — Transaction CRUD + parsing (745 lines — fat)
- `backend/services/transaction_service.py` — NL parsing logic
- `backend/services/bill_service.py` — Bill auto-linking

### Frontend
- `frontend/src/main.tsx` — Root (device detection)
- `frontend/src/theme.tsx` — Radix Theme wrapper
- `frontend/src/store/useBoundStore.ts` — Zustand store
- `frontend/src/desktop/DesktopApp.tsx` — Desktop routes
- `frontend/src/mobile/MobileApp.tsx` — Mobile routes
- `frontend/src/shared/utils/format.ts` — Currency/date formatting
- `frontend/src/styles/design-tokens.css` — Custom CSS variables

### Config
- `docker-compose.yml` — Backend + Frontend + Postgres
- `backend/.env` — Environment variables (secrets)
- `AGENTS.md` — Project overview for opencode
- `rules/frontend.md` — Frontend coding rules
- `rules/backend.md` — Backend coding rules

---

## 10. Current Status Summary

| Area | Status | Notes |
|------|--------|-------|
| Transaction tracking | ✅ Working | NL input, CRUD, search/filter |
| Category management | ✅ Working | Hierarchy, analytics, charts |
| Merchant tracking | ✅ Working | Auto-extract, merge, analysis |
| Bill management | ✅ Working (with bugs) | Auto-link, upcoming, payment history |
| Goal tracking | ✅ Working | Progress, contributions |
| Budget management | ✅ Working | CRUD, progress bars |
| Reports | ✅ Working | Monthly, category, merchant breakdown |
| CSV import/export | ✅ Working | Column mapping, preview |
| AI chatbot | ✅ Working | NL transactions, optional AI |
| Receipt OCR | ✅ Working | Tesseract.js in browser |
| Desktop UI | ✅ Working | Sidebar, top bar, charts |
| Mobile UI | ✅ Working | Bottom tabs, FAB, swipe |
| Dark mode | ⚠️ Broken on mobile | Undefined CSS variables |
| Data accuracy | ⚠️ Has bugs | Float for money, missing FKs |
| Financial advice | ❌ Not built | The main goal still needs building |
| Spending insights | ❌ Not built | No pattern detection |
| Recommendations | ❌ Not built | No savings suggestions |
| Forecasting | ❌ Not built | No cash flow projection |
