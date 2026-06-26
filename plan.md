# FinanceFlare — Project Plan

## Overview

FinanceFlare is a free, open-source personal finance tracker. The goal is to make expense tracking as easy as typing "spent 15 on groceries" — zero friction, zero cost, accessible on both mobile and desktop with deliberately different UX for each.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19 + TypeScript + Vite |
| Styling | CSS Modules + Radix UI |
| Charts | Nivo (Pie, Bar) |
| State | Zustand + TanStack Query |
| Backend | FastAPI + Uvicorn |
| Database | PostgreSQL + SQLAlchemy 2.x |
| Migrations | Alembic |
| Auth | JWT (python-jose + passlib/bcrypt) |
| OCR | Tesseract.js (browser-only, zero install) |
| Parsing | Rule-based + optional local Ollama (no paid API) |
| Dev Tools | Chrome DevTools MCP + Playwright MCP |

---

## Project Structure

```
FinanceFlare/
│
├── backend/
│   ├── database/
│   │   ├── __init__.py
│   │   ├── session.py          Engine, SessionLocal, Base
│   │   └── models.py           User, Category, Transaction, Budget
│   ├── routers/
│   │   ├── __init__.py
│   │   ├── auth.py             /login, /register, /me
│   │   ├── transactions.py     CRUD + /parse endpoint
│   │   └── budgets.py          CRUD
│   ├── services/
│   │   ├── __init__.py
│   │   ├── auth_service.py     Password hash, token create/verify
│   │   ├── transaction_service.py  Business logic + NL parsing (free)
│   │   └── budget_service.py   Budget logic
│   ├── alembic/
│   │   ├── versions/
│   │   │   └── .gitkeep
│   │   ├── env.py
│   │   └── script.py.mako
│   ├── alembic.ini
│   ├── main.py                 FastAPI app, CORS, routers
│   ├── .env.example
│   ├── requirements.in         Direct dependencies
│   ├── requirements.lock       Pinned via pip-compile
│   ├── Dockerfile
│   └── Dockerfile.dev
│
├── frontend/
│   ├── public/
│   │   └── vite.svg
│   ├── src/
│   │   ├── theme.tsx           ThemeProvider wrapping Radix <Theme>
│   │   ├── services/           api.ts, axios instance
│   │   ├── store/              Zustand (authStore, uiStore)
│   │   ├── types/              User, Transaction, Budget interfaces
│   │   ├── utils/              formatCurrency, formatDate, constants
│   │   ├── hooks/              useMediaQuery, etc.
│   │   ├── desktop/
│   │   │   ├── components/     Sidebar, TopBar, DataTable, CommandPalette
│   │   │   ├── pages/
│   │   │   │   ├── Login/          Login.tsx + Login.module.css
│   │   │   │   ├── Register/       Register.tsx + Register.module.css
│   │   │   │   ├── Dashboard/      BalanceCard, SpendingChart (Nivo), IncomeExpense (Nivo), RecentTransactions
│   │   │   │   ├── Transactions/   TransactionTable, TransactionFilters, AddTransactionModal
│   │   │   │   ├── Budgets/        BudgetCard, BudgetProgress
│   │   │   │   └── Settings/
│   │   │   ├── layouts/        DesktopLayout (sidebar + topbar + Outlet)
│   │   │   └── DesktopApp.tsx  Desktop routes
│   │   ├── mobile/
│   │   │   ├── components/     BottomTabBar, FAB, QuickAddSheet, SwipeableRow, CameraCapture
│   │   │   ├── pages/
│   │   │   │   ├── Login/          Login.tsx + Login.module.css (different from desktop)
│   │   │   │   ├── Register/       Register.tsx + Register.module.css
│   │   │   │   ├── Dashboard/
│   │   │   │   ├── Transactions/
│   │   │   │   ├── Budgets/
│   │   │   │   ├── AddTransaction/
│   │   │   │   └── Settings/
│   │   │   ├── layouts/        MobileLayout (bottom tab bar + FAB + Outlet)
│   │   │   └── MobileApp.tsx   Mobile routes
│   │   ├── main.tsx            Device detection → DesktopApp or MobileApp
│   │   └── styles/
│   │       └── index.css       Only CSS vars + reset, no Tailwind
│   ├── index.html
│   ├── package.json
│   ├── vite.config.ts
│   ├── tsconfig.json
│   ├── eslint.config.js
│   ├── .prettierrc
│   ├── .editorconfig
│   ├── Dockerfile
│   └── .env
│
├── rules/
│   ├── frontend.md
│   ├── backend.md
│   ├── database.md
│   ├── ui-ux.md
│   └── git.md
│
├── AGENTS.md
├── opencode.json
├── docker-compose.yml
├── .gitignore
├── LICENSE
└── README.md
```

---

## Theme System

- `src/theme.tsx` — single file: ThemeProvider wrapping Radix `<Theme>` with accentColor="orange"
- Every CSS module references variables: `var(--color-primary-600)`, `var(--spacing-4)`, etc.
- Dark mode toggles via `data-theme` attribute on `<html>` — zero JS cost

```ts
// theme.ts (conceptual)
export const theme = {
  colors: {
    primary: { 50: '#fef7ee', 500: '#ed7519', 600: '#de5a0f', 700: '#b8430f' },
    neutral: { 50: '#fafafa', 100: '#f5f5f5', 200: '#e5e5e5', 300: '#d4d4d4', 400: '#a3a3a3', 500: '#737373', 600: '#525252', 700: '#404040', 800: '#262626', 900: '#171717' },
  },
  spacing: (n: number) => `${n * 4}px`,
  breakpoints: { mobile: 640, tablet: 768, desktop: 1024 },
  borderRadius: '8px',
  shadow: '0 1px 3px rgba(0,0,0,0.1)',
}
```

---

## CSS Rules

- Every component gets `ComponentName.module.css` — no exceptions
- No inline styles, no CSS-in-JS, no Tailwind
- Radix UI handles behavior and accessibility; CSS Modules handle all visuals
- Mobile-first media queries in every module
- Desktop and mobile folders never import each other's CSS

---

## Mobile vs Desktop UX

### Mobile
- Bottom tab bar navigation (Home, Transactions, +Add, Budgets, Profile)
- Floating Action Button (FAB) for instant quick-add
- Bottom sheet (not modal) for transaction input
- Swipe gestures to delete/reveal actions
- Camera button for receipt scanning
- Full-screen pages, thumb-friendly touch targets

### Desktop
- Persistent sidebar navigation
- Top bar with user menu, dark mode toggle
- Keyboard shortcuts (N = new transaction, / = search)
- Detailed tables with sort/filter/search
- Multi-column layouts, hover previews
- Command palette (Ctrl+K)

### Shared (Same on Both)
- API client (`shared/services/api.ts`)
- Zustand stores (`shared/store/`)
- Theme config (`src/theme.tsx`)
- TypeScript types (`shared/types/`)
- Utility functions (`shared/utils/`)
- Radix Themes (`@radix-ui/themes`) provides all UI primitives — no custom wrappers

---

## AI Integration (Free, No Paid API)

The old `ai/utils.py` used OpenAI (GPT-3.5-turbo) which costs money per call. We replace it with free alternatives:

| Function | Old (OpenAI) | New (Free) |
|----------|-------------|-----------|
| `parse_natural_language_transaction()` | GPT-3.5-turbo | Rule-based parser (regex + keyword matching) |
| `categorize_expense()` | GPT-3.5-turbo | Keyword matching + optional local Ollama |
| `get_budgeting_advice()` | GPT-3.5-turbo | Dropped (nice-to-have future) |

The NL quick-add ("spent 15 on groceries") uses a simple regex/rule parser initially — cheap, fast, zero dependencies. Can upgrade to local Ollama later without changing the interface.

---

## Build Priority (Phase Order)

### Phase 0 — Tooling & Config
- Remove Tailwind/PostCSS/Autoprefixer from frontend
- Remove `.cursor/` directory (obsolete Cursor rules)
- Remove `ai/` directory (functionality moves to `backend/services/`)
- Add Radix UI, Nivo, Zustand, TanStack Query, Tesseract.js, Prettier
- Update ESLint to flat config (2026 rules)
- Update tsconfig (target ES2026, strict mode)
- Create `.prettierrc`, `.editorconfig`
- Create `opencode.json` + `rules/*.md` + `AGENTS.md`

### Phase 1 — Theme + Global CSS
- Create `src/theme.tsx` — single file with ThemeProvider wrapping Radix `<Theme>`
- Write `styles/index.css` — only CSS custom properties + minimal reset
- No Tailwind anywhere

### Phase 2 — Radix Themes Integration
- Install `@radix-ui/themes` — full component library with built-in theming
- Use Radix Button, Card, TextField, Dialog, Select, DropdownMenu, etc. directly
- No custom wrappers; Radix handles visuals and accessibility
- Import Radix CSS: `@import '@radix-ui/themes/styles.css'`
- ThemeProvider wraps `@radix-ui/themes/Theme` with accentColor="orange"

### Phase 3 — Layouts
- **Desktop**: Sidebar + TopBar + DesktopLayout + DesktopApp.tsx
- **Mobile**: BottomTabBar + FAB + MobileLayout + MobileApp.tsx
- `main.tsx` detects device → renders correct app

### Phase 4 — Authentication
- Login + Register for both desktop and mobile (completely different designs)
- Zustand authStore wiring
- JWT token management

### Phase 5 — Natural Language Quick-Add ⭐
- Single text input: "spent 15 on groceries"
- Free rule-based parsing (no paid API)
- One tap/click → transaction saved
- **This is the core feature**

### Phase 6 — Transaction History
- List transactions with search/filter/sort
- Desktop: full table with column sorting
- Mobile: card list with swipe actions
- Delete, edit transactions

### Phase 7 — Dashboard
- Balance cards (income, expenses, net, transaction count)
- Nivo Pie chart (spending by category)
- Nivo Bar chart (category breakdown)
- Recent transactions list
- Different layout for mobile vs desktop

### Phase 8 — Budgets
- Create/view/edit budgets
- Progress bars with spending limits
- Alerts when nearing limits

### Phase 9 — Receipt Scanning
- Camera button (mobile) / file upload (desktop)
- Tesseract.js OCR — runs entirely in browser
- Extracted data pre-fills transaction form

---

## Nice to Have (Future)

- Multi-currency support
- CSV import/export
- Recurring transactions
- PWA (installable on phone)
- Spending insights & trends
- Shared/family budgets
- Haptic feedback (mobile)
- Dark mode polish
- Budgeting advice (was OpenAI, could be local AI later)

---

## Backend Development

### Without Docker (local dev)

```bash
# Prerequisites: Python 3.13+, PostgreSQL running locally

# 1. Enter backend
cd backend

# 2. Create virtual environment
python -m venv venv

# 3. Activate it
# Windows:
venv\Scripts\activate
# macOS/Linux:
source venv/bin/activate

# 4. Install dependencies
pip install -r requirements.lock

# 5. Configure environment
copy .env.example .env    # Windows
# cp .env.example .env    # macOS/Linux
# Edit .env with your PostgreSQL credentials

# 6. Run database migrations
alembic upgrade head

# 7. Start the server
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

### With Docker

```bash
docker-compose up --build -d
```

### API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/auth/register` | Create account |
| POST | `/api/auth/login` | Sign in, returns JWT |
| GET | `/api/auth/me` | Current user info |
| GET | `/api/transactions/` | List transactions |
| POST | `/api/transactions/` | Create transaction |
| DELETE | `/api/transactions/{id}` | Delete transaction |
| GET | `/api/transactions/summary/dashboard` | Dashboard data |
| POST | `/api/transactions/parse` | NL quick-add: "spent 15 on groceries" |
| GET | `/api/budgets/` | List budgets |
| POST | `/api/budgets/` | Create budget |

### Backend Conventions

- **Routers are thin** — validate input with Pydantic, call service, return response
- **Services contain business logic** — password hashing, token creation, NL parsing
- **Models in database/models.py** — SQLAlchemy 2.x declarative style
- **Every schema change requires an Alembic migration**
- No raw SQL — always use SQLAlchemy ORM

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
| `rules/frontend.md` | React 19 patterns, CSS Modules for every component, Radix UI, Nivo, Zustand + TanStack Query |
| `rules/backend.md` | FastAPI thin routers + services layer, Pydantic v2, JWT auth |
| `rules/database.md` | SQLAlchemy 2.x ORM, Alembic for every schema change, migration naming |
| `rules/ui-ux.md` | Theme token system, CSS custom properties, mobile-first, desktop vs mobile separation |
| `rules/git.md` | Feature branches, conventional commits, small focused commits |

---

## License

AGPL-3.0 — keeps the project free for everyone.
