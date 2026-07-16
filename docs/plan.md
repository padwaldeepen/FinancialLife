# My Financial Life — Development Plan

> Last updated: 2026-07-16
> Context: Localhost-only personal finance app. Not deployed anywhere. One user (me).
> Goal: Understand where my money goes, how much I earn, and get advice on saving more.
> ✅ = done | 🔧 = needs fix from review | ❌ = remaining | ⏭️ = skipped

---

## What We're Building

A personal finance app that helps **me** understand my financial life. Type `"coffee 4.50"` and it's logged. See where money goes. Get advice on saving. Run entirely on localhost — no cloud, no subscriptions, no bank sync. My data stays on my machine.

**Stack:** React 19 + TypeScript + Vite + Radix UI + Nivo charts + Zustand | FastAPI + SQLAlchemy 2.x + PostgreSQL + JWT

---

## Code Review Summary (July 2026)

A full branch review was done across three perspectives: Technical Lead, UI/UX Expert, and Financial Manager. Key findings:

### Critical Fixes Needed (before using the app seriously)

| # | What | Why | Where |
|---|------|-----|-------|
| 1 | `Float` → `Numeric(12,2)` for money columns | Rounding errors on amounts | `models.py:99,130,150,194` |
| 2 | Add auth to `/api/transactions/parse` | Public endpoint, anyone can hit it | `routers/transactions.py:533` |
| 3 | Add `ForeignKey` on `bill_id`, `goal_id` | No referential integrity, any integer accepted | `models.py:106-107` |
| 4 | Validate bill ownership in link/unlink | Can link transaction to another user's bill | `routers/bills.py:273-300` |
| 5 | Validate enum fields (account_type, transaction_type, frequency) | Arbitrary strings corrupt reports | Multiple routers |
| 6 | Fix `compute_upcoming` missing `await` | Bills always show as "paid" | `services/bill_service.py:284` |
| 7 | Validate `amount > 0` | Negative/zero amounts accepted | Multiple routers |
| 8 | Require non-empty `SECRET_KEY` | JWT signed with empty string if `.env` missing | `core/config.py:17` |

### UI Fixes Needed

| # | What | Why |
|---|------|-----|
| 1 | Define `--bg-deep` and `--bg-panel` CSS vars | Dark mode broken on mobile layout + mobile login |
| 2 | Remove duplicate FAB on mobile | Two floating add buttons overlap |
| 3 | Replace `window.confirm()` with Radix Dialog | Breaks polished design |
| 4 | Refactor ChatBot to use Radix components | ~17 raw `<div>`s violate project rules |

### Architecture Improvements (can wait)

| What | Why |
|------|-----|
| Move business logic from routers to services | `transactions.py` is 745 lines of inline logic |
| Add responsive breakpoints for desktop | Two-column layouts overflow at narrow widths |
| Add `aria-expanded`, `role="dialog"` to ChatBot | Accessibility gap |
| Implement refresh token rotation | Stolen refresh token usable for 7 days |

---

## Completed Phases

### Phase 0 — Tooling & Config ✅
Frontend: Vite, TypeScript, Radix Themes, Nivo, Zustand, ESLint flat config. Backend: FastAPI, SQLAlchemy, Alembic, Ruff. Docker Compose. opencode rules.

### Phase 1 — Theme + Global CSS ✅
`src/theme.tsx` — Radix `<Theme>` with accentColor="orange", grayColor="slate". `useAppTheme()` hook for dark mode. CSS Modules only.

### Phase 2 — Radix Themes Integration ✅
All Radix UI components used directly. No custom wrappers. CSS Modules for layout only.

### Phase 3 — Layouts ✅
Desktop: Sidebar + TopBar + DesktopLayout. Mobile: BottomTabBar + FAB + MobileLayout. Device detection via matchMedia(1024px).

### Phase 4 — Authentication ✅
Login + Register (Desktop + Mobile). JWT access token (30min) + refresh token (7d httpOnly cookie). Zustand authSlice. Axios interceptor with 401 refresh rotation.

### Phase 5 — Natural Language Quick-Add ✅
Single text input → rule-based parser → instant transaction. Backend: POST /api/transactions/parse + POST /api/transactions/quick-add. Zero cost per call.

### Phase 6 — Transaction History ✅
List with search/filter/sort. Desktop table, mobile card list with swipe-to-delete. Edit, delete, infinite scroll. Backend: GET/POST/PUT/DELETE /api/transactions/.

### Phase 7 — Dashboard ✅
Balance cards (income/expenses/net). Nivo Pie chart (spending by category). Nivo Bar chart (category breakdown). Recent transactions. Different layouts for mobile vs desktop.

### Phase 8 — Budgets ✅
Create/view/edit budgets. Progress bars with spending limits. Over-budget warnings. Per-period spending auto-calculation.

### Phase 9 — Receipt Scanning ✅
Camera button (mobile) / file upload (desktop). Tesseract.js OCR runs entirely in browser. Extracted data pre-fills transaction form.

### Phase 10 — AI Provider Setup ✅
Groq API (free tier, fast LLM) + Gemini API (free tier, vision). AI abstraction layer with fallback chain: Groq → Gemini → rule-based. AI is optional — app works without API keys.

### Phase 11 — Transaction AI Parsing ✅
Parse "coffee 4.50" → structured result. Support variations: "salary 3200", "walmart 84.23", "netflix". Return preview before save. Client-side parsing preferred.

### Phase 13 — Bills Model ✅
Bill table: name, amount, frequency, due_day, category_id, merchant_id, account_id, is_variable. Router: GET/POST/PUT/DELETE /api/bills/. Upcoming bills calculation.

### Phase 14 — Bills UI ✅
Upcoming bills on Home screen. Bills screen (Mobile + Desktop). Bill detail with payment history and variable bill chart.

### Phase 15 — Bill Transaction Linking ✅
Auto-detect bill payments (merchant + amount + date proximity). Suggest linking. Manual linking. TransactionBillLink table. "Paid ✓" status on Home.

### Phase 16 — Goals System ✅
Goal table: save_up, pay_down, monthly_envelope types. Router: GET/POST/PUT/DELETE /api/goals/ + POST /api/goals/{id}/contribute.

### Phase 17 — Goals UI ✅
Goals list with progress cards. Goal detail with contribution history. Create/contribute/edit dialogs.

### Phase 18 — Categories Analytics ✅
Nivo Pie chart (spending distribution). Nivo Bar chart (category comparison). Category breakdown by month. Drill-down view.

### Phase 19 — Reports System ✅
Monthly report API: income, expenses, net savings, category breakdown, top merchants, comparison. Comparison endpoints. CSV export endpoint.

### Phase 20 — Reports UI ✅
Summary cards with +/- change. Category breakdown. Top merchants. Period selector. Comparison display. Export CSV button.

### Phase 22 — Performance Optimization ✅
API pagination tuning. Database indexes: (user_id, date), (user_id, merchant_id), (user_id, category_id). selectinload for relationships.

### Phase 25 — State Management ✅
All Zustand slices: accountsSlice, activitySlice, billsSlice, merchantsSlice, goalsSlice, categoriesSlice, reportsSlice, uiSlice.

### Phase 27 — Security Hardening ✅
JWT refresh rotation. API rate limiting (100 req/min general, 10 req/min auth). Pydantic validation. CORS config. HTTP security headers. SQL injection prevention via SQLAlchemy ORM.

### Phase 28b — Bill Edit Dialog ✅
Edit dialog (name, amount, account, frequency, due day, variable) on desktop + mobile Bills pages, edit button in Bill Detail.

### Phase 35 — Shared Utilities ✅
Created `shared/utils/format.ts` with `formatCurrency`, `formatDate`, `formatDateFull`, `getAmountColor`. Replaced all `.toFixed(2)` across 20+ files.

### Phase 36 — Registration Improvements ✅
Username field, password confirmation, show/hide toggle, client-side validation.

### Phase 37 — CSV Import ✅
Backend bulk endpoint, frontend CSV upload with papaparse, column mapping UI, preview table, account/category matching.

### Phase 38 — Bill–Transaction Linking UI ✅
Bill detail: linked transactions, manual linking. Transaction detail: linked bill, linking/unlinking.

### Phase 39b — CSV Export Frontend ✅
Export CSV button on Activity page filter bar (desktop + mobile) with date range support.

---

## Bonus Features (Completed)

| Feature | Details |
|---------|---------|
| AI Chatbot | FAB on desktop, NVIDIA LLM + rule-based fallback, transaction detection |
| Premium Fintech UI Redesign | Full redesign across all pages |
| Settings Pages | Desktop + Mobile with account/category/budget/goal CRUD |
| Transaction Filtering | Search, date range, category, merchant, type filters |
| Account Management | CRUD with icons per type |
| Category Management | CRUD + hierarchy + analytics tab |
| Merchant Management | Rename, delete, hide, merge duplicates |
| DB Indexes + N+1 Fixes | Performance optimization |
| Auth Interceptor | 401 → refresh → retry with queue |

---

## Remaining Work

### Priority Order for Localhost Personal Use

Since this runs locally for one user (me), the priorities are:
1. **Fix data integrity bugs** — so my financial data is accurate
2. **Fix UI broken things** — so the app is pleasant to use
3. **Polish** — nice-to-have improvements

### 🔧 Phase R1 — Data Integrity Fixes (Critical)
Fix the bugs that make financial data unreliable:
- [ ] Change `Float` → `Numeric(12,2)` for all money columns + Alembic migration
- [ ] Add `ForeignKey` constraints on `bill_id`, `goal_id` on Transaction
- [ ] Add `Literal` types for `account_type`, `transaction_type`, `frequency`, `period`
- [ ] Validate `amount > 0` on create/update
- [ ] Fix `compute_upcoming` to `await` the `db.execute()` call
- [ ] Add `UniqueConstraint` on `TransactionBillLink`
- [ ] Add ownership check on bill link/unlink endpoints

### 🔧 Phase R2 — Security Fixes (Important for Localhost)
These matter less on localhost but are still good practice:
- [ ] Add auth to `/api/transactions/parse`
- [ ] Require non-empty `SECRET_KEY` at startup
- [ ] Add password strength validation (min 8 chars)
- [ ] Add bulk limit on `/import` endpoint

### 🔧 Phase R3 — UI Fixes
- [ ] Define `--bg-deep` and `--bg-panel` CSS variables (dark mode broken on mobile)
- [ ] Remove duplicate FAB on mobile (keep BottomTabBar center button)
- [ ] Replace `window.confirm()` with Radix Dialog in Settings
- [ ] Refactor ChatBot to use Radix components (`<Box>`, `<Flex>`, `<Text>`)

### ❌ Phase 30 — Inline Style Cleanup
- Remove all `style={{ }}` occurrences across TSX files
- Replace with CSS Module classes
- Dynamic styles via CSS custom properties
- Progress bars → Radix `<Progress>` component

### ❌ Phase 33 — Mobile Polish
- Pull-to-refresh on Categories, Goals, Merchants, Reports
- Verify touch targets at 44x44px minimum

### ❌ Phase 34 — Desktop Polish
- Collapsible sidebar (hamburger at < 1024px)
- Hover states on all cards
- Responsive grid at 768-1023px breakpoints

### ❌ Phase 31 — Skeleton Loading States
- Replace "Loading..." text with Radix `<Skeleton>` shimmer
- Add to Home, Activity, Bills, Categories, Goals, Merchants, Reports

---

## Skipped (Not Needed for Localhost)

| Phase | Reason |
|-------|--------|
| Phase 12 — Receipt Upload System | OCR already works via Tesseract.js in browser |
| Phase 21 — Search System | Chatbot FAB covers this use case |
| Phase 29 — Forgot Password | Localhost only, no email infra needed |
| Phase 32 — Keyboard Shortcuts | Not needed |
| Phase 40 — Onboarding Flow | Not needed |
| Phase 41 — Auth Improvements | Token refresh already works |
| Phase 42 — Testing | Skip for now |
| Phase 43 — DevOps (CI/CD) | Skip for now — localhost only |
| Phase 44 — Notifications | Skip for now |
| Phase 22b — Caching Layer | Not needed at localhost scale |
| Phase 23b — Gesture Navigation | Swipe-to-delete + pull-to-refresh already done |
| Phase 24b — Command Palette | Not needed |
| Phase 26 — Data Integrity | SQLAlchemy ORM handles this |
| Phase 28 — Offline/Sync | Not needed for localhost |
| Phase 29b — JSON Export | CSV is sufficient |
| Phase 30b — Statement Import | Not needed for MVP |

---

## Rules

1. **No new features outside this plan.**
2. **Every phase must be working before moving to the next.**
3. **Run lint + format before committing:** Frontend: `npm run lint:fix && npm run format:fix` | Backend: `ruff check . && ruff format .`
4. **AI must always be optional.** App works without API keys.
5. **Only free APIs.** No OpenAI, no paid services.
6. **CSS Modules only.** No Tailwind, no inline styles, no CSS-in-JS.
7. **Desktop and mobile are separate.** No shared CSS, no cross-imports.
8. **Use Radix UI directly.** No custom wrappers.
9. **Zustand for all global state.** useState for local form state only.
10. **Every DB change needs an Alembic migration.**
11. **This runs on localhost only.** No deployment, no CI/CD, no production concerns.
