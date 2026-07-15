# My Financial Life — Development Plan

> Last updated: 2026-07-14
> ✅ = done | ❌ = remaining | ⏭️ = skipped

---

## What We're Building

Free, open-source personal finance app. Core insight: typing `"coffee 4.50"` should be all it takes to log a transaction. No subscriptions, no bank-sync, no learning curve.

**Stack:** React 19 + TypeScript + Vite + Radix UI + Nivo charts + Zustand | FastAPI + SQLAlchemy 2.x + PostgreSQL + JWT

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

---

## Bonus Features (Completed)

| Feature | Details |
|---------|---------|
| AI Chatbot | FAB on desktop, NVIDIA LLM + rule-based fallback, transaction detection |
| Premium Fintech UI Redesign | Full redesign across all pages |
| CSV Export Backend | GET /api/export/csv with date range filtering |
| Settings Pages | Desktop + Mobile with account/category/budget/goal CRUD |
| Transaction Filtering | Search, date range, category, merchant, type filters |
| Budget Management | Full CRUD in Settings |
| Account Management | CRUD with icons per type |
| Category Management | CRUD + hierarchy + analytics tab |
| Merchant Management | Rename, delete, hide, merge duplicates |
| DB Indexes + N+1 Fixes | Performance optimization |
| Auth Interceptor | 401 → refresh → retry with queue |

---

## Remaining Work

### Phase 28b — Bill Edit Dialog ✅
Added `updateBill` to `billsSlice`, edit dialog (name, amount, account, frequency, due day, variable) on desktop + mobile Bills pages, edit button in Bill Detail.

### Phase 39b — CSV Export Frontend UI ✅
Export CSV button on Activity page filter bar (desktop + mobile) with date range support. Reports page already had export.

### Phase 35 — Shared Utilities ✅
Created `shared/utils/format.ts` with `formatCurrency`, `formatDate`, `formatDateFull`, `getAmountColor`. Replaced all `.toFixed(2)` across 20+ files, removed duplicate `formatDate` functions, centralized amount color logic.

### ✅ Phase 38 — Bill–Transaction Linking UI
- Bill detail: show linked transactions, allow manual linking
- Transaction detail: show linked bill, allow linking/unlinking
- Wire up existing `suggestBillLink` and `linkTransactionToBill` actions

### ❌ Phase 37 — CSV Import
- ✅ Backend: `POST /api/transactions/import` bulk endpoint accepting mapped transactions
- ✅ Frontend: CSV file upload, client-side parsing with papaparse
- ✅ Column mapping UI (auto-detect common formats, manual override)
- ✅ Preview table before import
- ✅ Account/category matching by name

### ❌ Phase 36 — Registration Improvements
- Add `username` field to Register page
- Add password confirmation field
- Client-side validation (password strength, email format)
- Show/hide password toggle

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

## Research Notes

### Receipt Scanning Approaches
- **Tesseract.js (already in app)**: Client-side OCR, extracts raw text from receipt images. Limited accuracy on complex layouts.
- **LLM Vision (GPT-4o, Gemini)**: Send image → structured JSON (merchant, items, total, date). Most accurate but requires API key. App already has AI abstraction layer.
- **Google Lens API**: Good for product/barcode recognition, less ideal for full receipt parsing.
- **Recommendation**: Keep Tesseract.js as free default. Add optional LLM vision parsing via existing AI provider abstraction (Groq/Gemini free tiers support vision).

### Account Types for Bills
Current types: `checking`, `savings`, `credit`, `cash`, `investment`. User says bills should be paid from: cash, credit card, debit card, bank account — not checking/savings labels. Consider renaming `checking` → `bank account`, `savings` → `savings` (keep). Or add a `debit` type.

---

## Skipped (Not Needed)

| Phase | Reason |
|-------|--------|
| Phase 12 — Receipt Upload System | OCR already works via Tesseract.js in browser |
| Phase 21 — Search System | Chatbot FAB covers this use case |
| Phase 29 — Forgot Password | Localhost only, no email infra needed |
| Phase 32 — Keyboard Shortcuts | Not needed |
| Phase 40 — Onboarding Flow | Not needed |
| Phase 41 — Auth Improvements | Token refresh already works |
| Phase 42 — Testing | Skip for now |
| Phase 43 — DevOps (CI/CD) | Skip for now |
| Phase 44 — Notifications | Skip for now |
| Phase 22b — Caching Layer | Not needed at current scale |
| Phase 23b — Gesture Navigation | Swipe-to-delete + pull-to-refresh already done |
| Phase 24b — Command Palette | Not needed |
| Phase 26 — Data Integrity | SQLAlchemy ORM handles this |
| Phase 28 — Offline/Sync | Not needed for localhost |
| Phase 29b — JSON Export | CSV is sufficient |
| Phase 30b — Statement Import | Not needed for MVP |

---

## Sprint Order

| # | Phase | Effort |
|---|-------|--------|
| 1 | Phase 28b — Bill Edit Dialog | Small ✅ |
| 2 | Phase 39b — CSV Export UI | Small ✅ |
| 3 | Phase 35 — Shared Utilities | Small ✅ |
| 4 | Phase 38 — Bill-Transaction Linking | ✅ Done |
| 5 | Phase 37 — CSV Import | ✅ Done |
| 6 | Phase 36 — Registration Improvements | Small |
| 6 | Phase 30 — Inline Style Cleanup | Medium |
| 7 | Phase 33 — Mobile Polish | Medium |
| 8 | Phase 34 — Desktop Polish | Medium |
| 9 | Phase 31 — Skeleton Loading | Medium |

---

## Final Feature Set (After All Phases)

**Core:** Accounts, Transactions (CRUD + edit + filtering + infinite scroll), Categories (hierarchy + analytics + pie charts), Merchants (CRUD + merge + detail + spending charts), Bills (CRUD + auto-link + variable bills), Goals (CRUD + contribute + progress tracking), Budgets, Reports (monthly/summary/category + comparisons)

**AI:** Chatbot (NVIDIA LLM + rule-based), NL transaction parsing, Receipt OCR (Tesseract.js)

**UI:** Premium fintech redesign, desktop sidebar + mobile bottom tabs, dark mode, Settings pages, pull-to-refresh, swipe-to-delete, Nivo charts (pie + bar), CSV export

**Backend:** JWT auth, rate limiting, security headers, DB indexes, auto-link bills, merchant auto-generation, rule-based + AI parsing

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
