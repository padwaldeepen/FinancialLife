# My Financial Life — Build Plan

## Overview

My Financial Life is a free, open-source personal finance application. It replaces spreadsheets, notes, calculators, and disconnected finance apps with one place to understand and manage every part of your financial life.

**Core insight:** typing `"coffee 4.50"` should be all it takes to log a transaction. No subscriptions, no bank-sync headaches, no learning curve.

---

## Status — What's Already Built (Phases 0–9)

These phases are **complete and working.** Do not rebuild them. Do not redesign them. They are the foundation.

### Phase 0 — Tooling & Config
Frontend toolchain (Vite, TypeScript, Radix Themes, Nivo, Zustand, ESLint flat config), backend toolchain (FastAPI, SQLAlchemy, Alembic, Ruff), Docker Compose, opencode rules.

### Phase 1 — Theme + Global CSS
`src/theme.tsx` — single ThemeProvider wrapping Radix `<Theme>` with accentColor="orange", grayColor="slate". `useAppTheme()` hook for dark mode. CSS Modules only (no Tailwind, no inline styles, no CSS-in-JS).

### Phase 2 — Radix Themes Integration
All Radix UI components used directly (Box, Flex, Text, Heading, Button, Card, TextField, Dialog, Select, DropdownMenu, Table, etc.). No custom wrappers. CSS Modules for layout only.

### Phase 3 — Layouts
Desktop: Sidebar + TopBar + DesktopLayout + DesktopApp.tsx. Mobile: BottomTabBar + FAB + MobileLayout + MobileApp.tsx. Device detection via matchMedia(1024px) in main.tsx. Desktop and mobile are completely separate component trees.

### Phase 4 — Authentication
Login + Register pages (Desktop + Mobile). JWT access token (30min) + refresh token (7d httpOnly cookie). Zustand authSlice with login/register/logout/verifyToken actions. AuthContext for consuming auth state. Axios interceptor for Bearer token. 401 refresh rotation with queue.

### Phase 5 — Natural Language Quick-Add
Single text input → rule-based parser → instant transaction. Backend: POST /api/transactions/parse (rule-based, free, no external API) + POST /api/transactions/quick-add (parse + create in one call). Zero cost per call.

### Phase 6 — Transaction History
List with search/filter/sort. Desktop table with column sorting. Mobile card list with swipe-to-delete. Edit, delete, load-more pagination. Backend: GET/POST/PUT/DELETE /api/transactions/.

### Phase 7 — Dashboard
Balance cards (income/expenses/net). Nivo Pie chart (spending by category). Nivo Bar chart (category breakdown). Recent transactions. Different layouts for mobile vs desktop. Backend: GET /api/transactions/summary/dashboard.

### Phase 8 — Budgets
Create/view/edit budgets. Progress bars with spending limits. Over-budget warnings (orange/red). Per-period spending auto-calculation. Backend: GET/POST/PUT/DELETE /api/budgets/.

### Phase 9 — Receipt Scanning
Camera button (mobile) / file upload (desktop). Tesseract.js OCR runs entirely in browser. Extracted data pre-fills transaction form. Backend: POST /api/ai/categorize (rule-based). POST /api/ai/categories (list all categories).

---

## Build Phases — Strict Order

**CORE RULE: Do not skip phases. Do not change phase order. Each phase must be working before moving to the next.**
**COMMIT RULE: `git add -A && git commit -m "phase N: description"` after every completed phase. Run lint + format checks before committing.**
**DATA FETCHING RULE: All API calls go into Zustand slice actions. Components call the action from useEffect and subscribe to state — no `useState` for fetched data, no `setState` in effects. Form inputs, dialog state, UI animation state stay local with `useState`.**

---

### PHASE 1 — Project Stabilization

**Goal:** Confirm everything works. Clean up unused code. Establish environment consistency.

**Tasks:**
- [x] confirm existing FastAPI + React + SQLAlchemy setup runs locally
- [x] verify Alembic migrations are working (alembic upgrade head)
- [x] clean unused endpoints (budgets, dashboard summary — keep for now but mark deprecated)
- [x] define and document all environment variables (.env for backend + frontend)
- [x] ensure auth flow works end-to-end (login → register → me → logout)
- [x] run linter + formatter on both frontend and backend
- [x] verify Docker Compose builds and starts

**Acceptance:** App starts. User can register, login, see empty state. Lint passes.

---

### PHASE 2 — Core Navigation Refactor

**Goal:** Restructure navigation to match the new information architecture. No backend changes.

**Tasks:**
- [x] replace Dashboard route (`/`) → Home route (`/`)
- [x] replace Transactions route (`/transactions`) → Activity route (`/activity`)
- [x] remove AddTransaction page routing (no more `/add` route)
- [x] introduce modal-based Add flow (FAB opens modal/sheet instead of navigating)
- [x] implement mobile bottom tabs: Home | Activity | + (FAB) | Bills | More
- [x] implement desktop sidebar: Home | Activity | Bills | Merchants | Categories | Goals | Reports | Settings
- [x] update all internal navigation links
- [x] add redirects from old routes to new routes

**Acceptance:** Navigation matches the new structure. FAB opens modal. Old URLs redirect.

---

### PHASE 3 — Account Model (CRITICAL)

**Goal:** Create the Account entity. This is the foundation for everything that follows.

**Tasks:**
- [x] create Account table (SQLAlchemy model)
  - id, user_id (FK), name, type (checking/savings/credit/cash/investment), balance, currency, is_active, sort_order, created_at, updated_at
- [x] define relationship: Account belongs to User (1:N)
- [x] add account_id column to Transaction model (required FK)
- [x] create default account on user signup (name: "Cash", type: "checking")
- [x] migration: backfill existing transactions to default account
- [x] compute account balance from linked transactions (service layer)
- [x] create Account router: GET /api/accounts/, POST /api/accounts/, PUT /api/accounts/{id}, DELETE /api/accounts/{id}
- [x] create Account service with balance calculation
- [x] add Alembic migration

**Acceptance:** New users get default account. Existing users get backfilled. Balances compute correctly. API returns accounts.

---

### PHASE 4 — Transaction Model Upgrade

**Goal:** Add missing fields to Transaction model to support linking to other entities.

**Tasks:**
- [x] add merchant_id (nullable FK → Merchant — table not built yet, add FK later)
- [x] add bill_id (nullable FK → Bill — table not built yet, add FK later)
- [x] add goal_id (nullable FK → Goal — table not built yet, add FK later)
- [x] add is_pending (boolean, default false)
- [x] add is_recurring (boolean, default false)
- [x] update TransactionCreate schema to include new optional fields
- [x] update TransactionUpdate schema
- [x] update TransactionResponse schema
- [x] update all CRUD endpoints to handle new fields
- [x] add Alembic migration

**Acceptance:** Transaction model has all new columns. API accepts and returns them. Existing data unaffected.

---

### PHASE 5 — Activity Screen

**Goal:** Build the transaction list UI (replaces old Transactions page).

**Tasks:**
- [x] build Activity component (Desktop + Mobile)
- [x] add search bar at top (text search across description, merchant, amount)
- [x] add filters: date range, category, merchant, transaction type
- [x] infinite scroll pagination (load more as user scrolls)
- [x] tap transaction → transaction detail view (modal or slide-over)
- [x] transaction detail: full description, amount, date, merchant, category, account, notes, edit/delete actions
- [x] swipe-to-delete (mobile) with undo toast
- [x] group by date (Today, Yesterday, This Week, Earlier)

**Acceptance:** User can view, search, filter, scroll, and interact with transactions. Detail view works.

---

### PHASE 6 — Home Screen

**Goal:** Build the Home screen (replaces old Dashboard).

**Tasks:**
- [x] total balance display (sum of all account balances)
- [x] account cards: show each account with name, type icon, balance
- [x] recent transactions (last 5, linked from Activity)
- [x] upcoming bills placeholder section (hidden until Phase 14)
- [x] mobile-first layout optimization (cards stack vertically, touch targets 44px+)
- [x] pull-to-refresh on mobile
- [x] desktop: multi-column layout (accounts left, recent activity right)

**Acceptance:** Home shows real balances. Account cards are tappable. Recent transactions link to Activity.

---

### PHASE 7 — Category System Upgrade

**Goal:** Add hierarchy to categories. Pre-populate system categories.

**Tasks:**
- [x] add parent_id column to Category model (nullable FK, self-referential)
- [x] add is_system column (boolean, true for base categories)
- [x] make user_id nullable on Category (null = system category)
- [x] seed system categories:
  - Housing (Rent, Mortgage, Insurance, Repairs)
  - Food & Dining (Groceries, Dining Out, Coffee Shops)
  - Transportation (Gas, Parking, Public Transit, Rideshare)
  - Shopping (Clothing, Electronics, Home Goods, Online)
  - Entertainment (Streaming, Games, Movies, Events)
  - Health & Fitness (Pharmacy, Doctor, Gym, Insurance)
- [x] create Category router with list/create/update/delete endpoints
- [x] create Category service with CRUD + seeding
- [x] update ai.py to use DB categories instead of hardcoded lists
- [x] build Categories frontend page (Desktop) with expandable parent/children hierarchy
  - Utilities (Electric, Water, Internet, Phone)
  - Income (Salary, Freelance, Gift, Refund)
  - Uncategorized
- [x] build category tree logic (get all children of a parent)
- [x] support subcategory assignment in transaction create/update
- [x] add Alembic migration

**Acceptance:** Categories are hierarchical. System categories are seeded. API returns tree structure.

---

### PHASE 8 — Merchant Model Creation

**Goal:** Create the Merchant entity. Auto-generate from transaction descriptions.

**Tasks:**
- [x] create Merchant table (SQLAlchemy model)
  - id, user_id (FK), name, normalized_name, aliases (JSONB), is_hidden, created_at
- [x] normalize merchant names on creation (lowercase, trim, remove special chars)
- [x] auto-generate merchant from transaction description on create
- [x] add alias system: maintain mapping of common variations
  - AMZN → Amazon, SBUX → Starbucks, TGT → Target, WMT → Walmart
- [x] link transaction to merchant (update merchant_id FK from Phase 4)
- [x] create Merchant router:
  - GET /api/merchants/ (list with totals)
  - GET /api/merchants/{id} (detail with history)
  - POST /api/merchants/merge (merge duplicates)
  - PUT /api/merchants/{id} (rename, hide)
- [x] backfill merchants from existing transaction descriptions
- [x] add Alembic migration

**Acceptance:** New transactions auto-create or match merchants. Existing data is backfilled. API returns merchant list.

---

### PHASE 9 — Merchant UI

**Goal:** Build the Merchant screens.

**Tasks:**
- [x] merchant list screen (Desktop sidebar + Mobile More tab)
  - searchable list sorted by total spent
  - shows: merchant name, total spent, transaction count
  - tap → merchant detail
- [x] merchant detail page
  - total spent, transaction count, first/last transaction date
  - spending over time (mini chart)
  - transaction history for this merchant (linked to Activity)
  - category breakdown for this merchant
- [x] merge duplicate merchants UI (suggest when similar names detected)

**Acceptance:** Merchants auto-populate from transactions. Detail shows spending history. Merge works.

---

### PHASE 10 — AI Provider Setup (FREE ONLY)

**Goal:** Integrate free AI APIs for text parsing and OCR. AI must be optional — system works without it.

**Tasks:**
- [x] integrate Groq API (free tier, fast LLM inference)
  - sign up, get API key
  - create Groq service module
  - prompt engineering for transaction parsing
- [x] integrate Gemini API (free tier, vision capabilities)
  - sign up, get API key
  - create Gemini service module
  - prompt engineering for receipt extraction
- [x] define AI abstraction layer
  - BaseAIService interface
  - GroqParser, GeminiParser implementations
  - fallback chain: Groq → Gemini → rule-based
- [x] ensure AI is OPTIONAL
  - feature flag: USE_AI=true/false
  - rule-based parser works as fallback
  - app functions identically without any API keys
- [x] add AI configuration to settings
- [x] document how to get free API keys

**Acceptance:** AI parsing works with API keys. App works without them. Fallback to rule-based is seamless.

---

### PHASE 11 — Transaction AI Parsing

**Goal:** Use AI to parse natural language into structured transactions.

**Tasks:**
- [x] parse "coffee 4.50" → structured result
  - merchant: "Coffee Shop" (extracted or inferred)
  - amount: 4.50
  - category: "Food & Dining" (inferred)
  - type: expense
- [x] support variations:
  - "salary 3200" → Income, $3,200
  - "walmart 84.23" → Walmart, $84.23, Shopping
  - "netflix" → Netflix, (ask for amount), Entertainment
  - "amazon headphones 60" → Amazon, $60.00, Shopping
- [x] return structured transaction preview (client shows before save)
- [x] client-side parsing preferred (AI call only when needed)
- [x] fallback to rule-based parser if AI is unavailable

**Acceptance:** Typing natural text shows instant structured preview. Save creates correct transaction.

---

### PHASE 12 — Receipt Upload System (NEW)

**Goal:** Upload receipt images, extract transaction data using OCR.

**Tasks:**
- [ ] add image upload endpoint (POST /api/upload/receipt)
  - accept JPEG, PNG, HEIC
  - validate file size (< 10MB)
  - store in uploads/ directory
- [ ] mobile camera capture support
  - native camera integration
  - crop/rotate before upload
- [ ] desktop drag & drop upload
  - drag zone component
  - file picker fallback
- [ ] OCR pipeline:
  - Tesseract.js (fallback, runs in browser)
  - Gemini Vision (primary, sends image to API)
  - extract: merchant, total, date, line items
- [ ] map extracted data to transaction fields
- [ ] show preview before saving

**Acceptance:** User can upload receipt photo. OCR extracts data. Preview shows before save.

---

### PHASE 13 — Bills Model

**Goal:** Create the Bill entity for recurring payments.

**Tasks:**
- [x] create Bill table (SQLAlchemy model)
  - id, user_id (FK), name, amount, amount_estimated, frequency (weekly/biweekly/monthly/quarterly/yearly), due_day, category_id (FK), merchant_id (FK), account_id (FK), is_active, is_variable, notes, created_at, updated_at
- [x] link Bill → User (N:1)
- [x] link Bill → Account (N:1)
- [x] link Bill → Category (N:1)
- [x] link Bill → Merchant (N:1, nullable)
- [x] create Bill router
  - GET /api/bills/ (all bills with next due date)
  - POST /api/bills/ (create)
  - PUT /api/bills/{id} (update)
  - DELETE /api/bills/{id}
  - GET /api/bills/upcoming?days=7 (bills due soon)
- [x] upcoming bills calculation (next due date based on frequency + due_day)
- [x] add Alembic migration

**Acceptance:** Bill CRUD works. Upcoming bills API returns correct dates.

---

### PHASE 14 — Bills UI

**Goal:** Build the Bills screens.

**Tasks:**
- [x] upcoming bills section on Home screen (next 7 days)
  - bill name, amount, due date, days until due
  - tappable → Bills detail
- [x] bills screen (Mobile bottom tab + Desktop sidebar)
  - "Upcoming This Week" section
  - all bills list with next due date
  - add bill form (name, amount/frequency/due day/category/account)
  - edit bill
  - delete bill
- [x] bill detail view
  - bill info (name, amount, frequency, due day, category, merchant)
  - payment history (linked transactions)
  - chart for variable bills (electric, water — shows amount over time)
- [x] variable bill support
  - show estimated amount range
  - chart of historical amounts
  - manual entry for each period

**Acceptance:** Bills screen shows all bills with due dates. Home shows upcoming. Variable bills display history.

---

### PHASE 15 — Bill Transaction Linking

**Goal:** Automatically detect when a transaction matches a bill.

**Tasks:**
- [x] detect bill payments automatically
  - match by: merchant_id + approximate amount + date proximity to due_day
  - match by: description containing bill name
- [x] suggest linking transactions to bills
  - "Is this your Rent payment?" toast/question
  - yes/no prompt, not intrusive
- [x] allow manual linking (edit transaction → link to bill)
- [x] create TransactionBillLink table
  - id, transaction_id (FK), bill_id (FK), period_start, period_end, is_auto_linked
- [x] update Home upcoming bills to show linked payments as "Paid ✓"
- [x] update Bill detail to show linked transaction history
- [x] add Alembic migration

**Acceptance:** System detects bill payments. User can confirm linking. Bill history shows linked transactions.

---

### PHASE 16 — Goals System

**Goal:** Create the Goal entity. Replace budgets entirely.

**Tasks:**
- [x] create Goal table (SQLAlchemy model)
  - id, user_id (FK), name, target_amount, current_amount, monthly_contribution, type (save_up/pay_down/monthly_envelope), category_id (FK, nullable), deadline, icon, color, is_active, sort_order, created_at, updated_at
- [x] support three goal types:
  - save_up: accumulate money over time (vacation, emergency fund)
  - pay_down: debt payoff (credit card, loan)
  - monthly_envelope: monthly spending limit (replaces budgets)
- [x] create Goal router
  - GET /api/goals/ (all goals with progress)
  - POST /api/goals/ (create)
  - PUT /api/goals/{id} (update)
  - DELETE /api/goals/{id} (deactivate)
  - POST /api/goals/{id}/contribute (add contribution)
- [x] mark old Budget model as deprecated
- [x] add Alembic migration

**Acceptance:** Goals CRUD works. Three types behave correctly. Old budgets untouched (deprecated).

---

### PHASE 17 — Goals UI

**Goal:** Build the Goals screens.

**Tasks:**
- [x] goals list screen (Desktop sidebar + Mobile More tab)
  - progress cards: icon, name, progress bar, current/target amounts
  - show projected completion date based on monthly contribution
  - color-coded progress (green = on track, yellow = behind, red = off track)
- [x] goal detail view
  - target amount, saved amount, remaining
  - progress over time (chart)
  - contribution history (list)
  - edit goal
- [x] contribution tracking
  - manual: "Add $X to goal"
  - from transaction: when recording, user can link to goal
  - "Save this amount to Vacation Fund?" prompt
- [x] create goal form
  - name, target amount, deadline (optional), icon, color, type
  - for envelopes: monthly limit + category
  - for pay_down: debt amount + interest rate (optional)
- [x] remove Budgets from navigation (keep data for migration reference)

**Acceptance:** Goals list shows progress. Contributions work. Link from transactions works. Budgets replaced.

---

### PHASE 18 — Categories UI (Analytics)

**Goal:** Build category analytics with Nivo charts.

**Tasks:**
- [x] Nivo Pie chart: spending distribution by category
- [x] Nivo Bar chart: category comparison by month
- [x] category breakdown by month (sidebar/selector)
- [x] drill-down category view
  - parent category → subcategories
  - top merchants in this category
- [x] toggle: current month / last month / custom date range
- [x] percentage labels + actual amounts

**Acceptance:** Category charts render correctly. Drill-down works. Date range selector works.

---

### PHASE 19 — Reports System

**Goal:** Create report generation APIs.

**Tasks:**
- [x] monthly report API
  - total income, total expenses, net savings
  - category breakdown with percentages
  - top 5 merchants by spending
  - comparison to previous month (percent change)
- [ ] yearly report API
  - same as monthly but aggregated by year
  - monthly trend data (income/expense per month)
- [x] income vs expense calculation
- [x] comparison vs previous period (month over month, year over year)
- [x] export data preparation (CSV-ready format via /api/export/csv)

**Acceptance:** Report APIs return correct aggregated data. Comparisons work.

---

### PHASE 20 — Reports UI

**Goal:** Build the Reports screen.

**Tasks:**
- [x] summary cards: Income, Expenses, Savings (with +/- change indicator)
- [x] category breakdown (horizontal bar chart or list with percentages)
- [x] top merchants list with totals
- [x] period selector: Month / Year / Custom range
- [x] comparison display: "vs last month: +$120 (4% increase)"
- [x] export CSV button (calls export API, downloads file)
- [x] responsive: desktop shows more detail, mobile shows condensed view

**Acceptance:** Reports screen shows accurate data. Period switching works. CSV downloads.

---

### PHASE 21 — Search System ~~SKIPPED~~

**Goal:** ~~Global search across all transactions.~~ **SKIPPED** — replaced by chatbot FAB which handles transaction lookups and financial questions.

**Tasks:**
- [x] ~~global search bar~~ — not needed, chatbot covers this use case

**Acceptance:** ~~Search returns relevant results. Matches are highlighted. Cmd+K works.~~ Skipped by design.

---

### PHASE 22 — Performance Optimization

**Goal:** Ensure the app is fast at any scale.

**Tasks:**
- [x] API pagination tuning (default 50 per page, max 100)
- [ ] caching for summary endpoints (accounts, bills upcoming, dashboard — cache 60s)
- [x] debounce search input (300ms, implemented in Phase 21)
- [x] optimize transaction queries
  - add database indexes: (user_id, date), (user_id, merchant_id), (user_id, category_id)
  - use selectinload for relationships instead of joinedload where appropriate
- [ ] lazy load chart components (Nivo loaded only on Categories/Reports screens)
- [ ] React.memo on list items
- [ ] virtual scrolling for large transaction lists (if >500 transactions)

**Acceptance:** Home loads <3s with 1000+ transactions. Search returns <1s. Smooth scrolling.

---

### PHASE 23 — Mobile UX Optimization

**Goal:** Make mobile the best experience.

**Tasks:**
- [x] bottom sheet add flow (slides up from bottom, full keyboard support)
- [x] one-tap transaction entry (FAB → type → save, no extra steps)
- [ ] gesture-based navigation (swipe back, swipe to delete, pull to refresh)
- [x] reduce UI clutter (hide non-essential info, progressive disclosure)
- [x] touch targets minimum 44x44px
- [x] no horizontal scroll anywhere
- [x] bottom tab bar always visible (no hidden tabs)
- [ ] safe area insets for notched devices

**Acceptance:** Adding a transaction takes <5 seconds on mobile. No horizontal scroll. All touch targets accessible.

---

### PHASE 24 — Desktop UX Optimization

**Goal:** Make desktop powerful for deep work.

**Tasks:**
- [ ] multi-panel layouts (sidebar + main + detail panel)
- [ ] persistent sidebar with all navigation items visible
- [ ] detailed chart views (larger, more interactive)
- [ ] keyboard shortcuts:
  - Cmd+N: new transaction ✓ (via DesktopLayout useEffect)
  - Escape: close modal ✓ (Radix Dialog handles this)
  - 1-4: switch tabs
- [ ] hover states on all interactive elements
- [ ] resizable panels where appropriate
- [ ] command palette (Ctrl+K) for power users

**Acceptance:** Desktop feels like a native app. Keyboard shortcuts work. Multi-panel navigation is fluid.

---

### PHASE 25 — State Management (Zustand)

**Goal:** Create all necessary Zustand slices for the new architecture.

**Tasks:**
- [x] accountsSlice
  - state: accounts[], activeAccountId, loading
  - actions: fetchAccounts, createAccount, updateAccount, deleteAccount
- [x] activitySlice
  - state: transactions[], filters, searchQuery, pagination, loading
  - actions: fetchActivity, search, filter, setPage, deleteTransaction
- [x] billsSlice
  - state: bills[], upcomingBills[], loading
  - actions: fetchBills, createBill, updateBill, deleteBill
- [x] merchantsSlice
  - state: merchants[], activeMerchant, loading
  - actions: fetchMerchants, fetchMerchantDetail, mergeMerchants
- [x] goalsSlice
  - state: goals[], loading
  - actions: fetchGoals, createGoal, contributeToGoal
- [x] uiSlice
  - state: sidebarOpen, activeModal, theme, searchOpen
  - actions: toggleSidebar, openModal, closeModal, toggleTheme

**Acceptance:** All slices exist. State is reactive. Actions trigger API calls and update state.

---

### PHASE 26 — Data Integrity Layer

**Goal:** Prevent data corruption. Enforce consistency.

**Tasks:**
- [ ] enforce account_id required on all transactions (database NOT NULL)
- [ ] validate merchant linking (merchant_id must reference existing merchant)
- [ ] validate bill linking (bill_id must reference existing bill)
- [ ] validate goal linking (goal_id must reference existing goal)
- [ ] prevent orphan transactions (cascade delete or nullify on account deletion)
- [ ] ensure consistent balances (transaction sum always equals account balance)
- [ ] add database-level constraints where appropriate
- [ ] add service-layer validation for all write operations
- [ ] return clear error messages for constraint violations

**Acceptance:** No orphan transactions. All foreign keys valid. Balances consistent. Errors are clear.

---

### PHASE 27 — Security Hardening

**Goal:** Secure the application against common vulnerabilities.

**Tasks:**
- [x] JWT refresh rotation (single-use refresh tokens, rotate on each refresh)
- [x] API rate limiting (100 req/min per user for general endpoints, 10 req/min for auth) — via SecurityHeadersMiddleware + RateLimitMiddleware
- [x] input validation (Pydantic schemas on all endpoints, sanitize text fields)
- [ ] file upload security (receipt images)
  - validate file type (only JPEG, PNG, HEIC allowed)
  - validate file size (<10MB)
  - scan for malware (basic check)
  - store outside web root
  - random filename generation (no user-supplied names)
- [x] CORS configuration (only allow known origins)
- [x] HTTP headers: X-Frame-Options, X-Content-Type-Options, X-XSS-Protection, Referrer-Policy — via SecurityHeadersMiddleware
- [x] SQL injection prevention (already covered by SQLAlchemy ORM — verify)
- [ ] dependency audit (npm audit, pip audit)

**Acceptance:** Security scan passes. Rate limiting works. File uploads are safe. No vulnerabilities.

---

### PHASE 28 — Offline + Sync Preparation

**Goal:** Prepare for offline usage and background sync.

**Tasks:**
- [ ] local caching strategy
  - cache accounts, recent transactions, upcoming bills in localStorage/IndexedDB
  - show cached data immediately, refresh in background
- [ ] optimistic UI updates
  - on transaction create: show immediately in UI before API response
  - on failure: show error toast, revert optimistic update
- [ ] queue transactions offline
  - store pending transactions in IndexedDB
  - show "pending" badge on queued items
- [ ] sync on reconnect
  - detect online/offline status
  - flush queue when connection returns
  - handle conflicts (server is source of truth)
- [ ] service worker registration (basic, expand later)

**Acceptance:** App works offline (read cached data). Transactions queued offline sync when online. No data loss.

---

### PHASE 29 — Export System

**Goal:** Allow users to export their data.

**Tasks:**
- [x] CSV export endpoint: GET /api/export/csv?date_from=&date_to=
  - all transaction fields
  - merchant name (denormalized)
  - category name (denormalized)
  - account name (denormalized)
- [ ] optional JSON export: GET /api/export/json
  - full data dump (transactions, accounts, categories, merchants, bills, goals)
- [x] date range filtering for export
- [x] frontend export button on Reports screen
- [ ] download file with proper filename (my-finances-2026-06.csv)

**Acceptance:** CSV and JSON exports download correctly. Data matches what's in the app.

---

### PHASE 30 — Statement Import

**Goal:** Import transactions from bank/credit card statements (Excel, PDF, CSV).

**Tasks:**

Backend — Parsing:
- [ ] install `openpyxl` (Excel), `pdfplumber` (PDF), `dateparser` (date detection)
- [ ] create `services/statement_service.py` with:
  - `parse_excel(file)` — read .xlsx rows, detect columns by header keywords (Date, Description, Amount, etc.)
  - `parse_pdf(file)` — extract tables via pdfplumber, detect columns, handle multi-page
  - `parse_csv(file)` — detect delimiter, headers, date formats
  - `detect_format(rows)` — fuzzy-match column headers to known bank formats (Chase, BofA, Citi, etc.)
- [ ] auto-detect bank format from column headers + date format patterns
- [ ] extract per-row: date, description, amount (debit/credit), optional merchant
- [ ] AI fallback: pass unstructured/layout-unknown PDFs to Groq/Gemini for structured extraction

Backend — Transaction Linking:
- [ ] after extraction, run through merchant matching (Phase 8): fuzzy-match description to known merchants
- [ ] run through category auto-assignment (Phase 7): map merchant → category
- [ ] create transaction objects linked to selected account (Phase 3)
- [ ] deduplication: check existing transactions (date + amount + description) to avoid duplicates
- [ ] return preview payload: `{ rows_parsed, rows_duplicate, transactions, unknown_merchants[] }`

API:
- [ ] `POST /api/import/preview` — upload file, return parsed preview (no save)
- [ ] `POST /api/import/confirm` — confirm import, save all transactions
- [ ] `GET /api/import/templates` — list supported bank formats
- [ ] file validation: only .xlsx, .pdf, .csv; max 20MB

Frontend:
- [ ] Import screen (`/import`) accessible from Settings and /more
- [ ] drag-and-drop file upload zone (desktop) + file picker (mobile)
- [ ] preview table: date | description | amount | merchant → category | status (new/duplicate)
- [ ] highlight unmatched merchants for user to assign or skip
- [ ] bulk account selector (which account to import into)
- [ ] confirm button → POST /api/import/confirm → success toast + redirect to Activity
- [ ] import history list (recent imports, row count, date range)

**Acceptance:** User can upload a Chase or generic bank statement. System parses transactions, matches merchants/categories, shows preview. User confirms. Transactions appear in Activity.

---

### PHASE 31 — Final System Integration

**Goal:** Verify everything works together. Ship.

**Tasks:**
- [ ] full end-to-end testing
  - register → login → add transaction → view on Home
  - create bill → view upcoming on Home → pay bill → link
  - create goal → contribute → see progress
  - search → filter → export
- [ ] mobile + desktop parity check
  - every feature works on both
  - no missing functionality on either platform
- [ ] performance verification:
  - add transaction: <5 seconds (from tap to saved)
  - search: <1 second (results appear)
  - home loads: <3 seconds (with 1000+ transactions)
- [ ] security verification:
  - unauthenticated users cannot access protected routes
  - API returns 401 for invalid tokens
  - file uploads are restricted
- [ ] production deployment readiness
  - Docker Compose tested end-to-end
  - environment variables documented
  - database migrations run automatically on startup
  - health check endpoint returns OK

**Acceptance:** All 31 phases complete. App is production-ready.

---

## Final Rules (DO NOT BREAK)

1. **No new features outside this plan.** If it's not in phases 1-30, it doesn't get built.
2. **No redesign mid-phase.** Each phase has a defined scope. Do not expand it.
3. **No skipping phases.** Phase 3 must be complete before Phase 4 starts.
4. **Every phase must be working before moving to the next.** No half-finished phases.
5. **No renaming concepts during a phase.** Names are defined in the plan. Use them.
6. **No changing phase order.** The order is deliberate. Each phase builds on previous ones.

## Browser Testing Rule (MANDATORY)

Every phase must be verified using browser-based testing tools before it is marked complete. Do not rely on code review alone.

**Testing tools available:**
- Chrome DevTools MCP (`chrome-devtools`) — console, network, screenshots, Lighthouse
- Playwright MCP (`playwright`) — browser automation, form filling, navigation, snapshots

**Testing checklist for every phase:**
- [ ] Open the app in the browser (Chrome DevTools)
- [ ] Verify the changes render correctly (visual + console)
- [ ] Verify API requests/responses are correct (DevTools Network tab)
- [ ] Verify no console errors or warnings
- [ ] Run a Lighthouse audit (accessibility, best practices)
- [ ] Test on both mobile and desktop viewports
- [ ] If the phase adds new UI: take a screenshot and verify layout
- [ ] If the phase adds new API: verify request/response bodies
- [ ] Run frontend lint + typecheck (`npm run lint:fix && npm run typecheck`)
- [ ] Run backend lint + format (`ruff check . && ruff format .`)

**Do not skip browser testing.** A phase that passes lint but breaks in the browser is not complete.

## AI Usage Rule (STRICT)

**Use only FREE APIs:**
- Groq (fast text parsing) — free tier
- Gemini (vision OCR) — free tier
- HuggingFace (fallback) — free tier
- Tesseract.js (browser OCR) — completely free, no API key needed

**AI is ONLY for:**
- parsing natural language text into transactions
- receipt extraction (OCR)
- merchant name normalization

**AI is NOT for:**
- calculations (balances, totals, reports)
- report generation
- budget/goal recommendations
- any numerical computation

**AI must always be OPTIONAL.** The app must function fully without any AI API keys.

---

## Result

After Phase 30, you will have:

- a full personal finance system
- mobile + desktop web application
- AI-assisted transaction entry (optional)
- receipt scanning system
- merchant intelligence (auto-generated, searchable)
- goals instead of budgets (motivation > restriction)
- full reporting engine
- export capability
- offline preparation
- production-ready deployment
