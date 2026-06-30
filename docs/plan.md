# Development Plan

## Phase 22 — Missing Mobile Routes
Add routes for pages that exist but are inaccessible on mobile:
- `/categories` → Categories page
- `/merchants` → Merchants page
- `/reports` → Reports page
- Add bottom tab bar items for these (or nest under "More")

## Phase 23 — Reports Store Slice
- Create `reportsSlice.ts` with monthly, summary, and category report actions
- Wire into `useBoundStore.ts`
- Update desktop + mobile Reports pages to use the slice instead of direct `api.get()` calls

## Phase 24 — Budgets Slice Cleanup
- Wire `budgetsSlice` into `useBoundStore.ts` (or remove the dead code if budgets are fully deprecated)

## Phase 25 — Account Management UI
- Add `createAccount`, `updateAccount`, `deleteAccount` actions to `accountsSlice`
- Build account management dialog (create/edit form with name, type, currency fields)
- Add account management to Settings page or a dedicated route
- Add "Add Account" button to Home page accounts section
- Delete confirmation dialog

## Phase 26 — Category Management UI
- Add `createCategory`, `updateCategory`, `deleteCategory` actions to `categoriesSlice`
- Add create/edit/delete dialogs to Categories page
- Category form: name, color picker, parent category selector, icon

## Phase 27 — Full Transaction Edit Dialog
- Add `updateTransaction` action to `transactionsSlice` (full edit, not just notes)
- Extend Activity detail dialog to edit: amount, description, type, category, merchant, account, date, is_pending, is_recurring
- Remove 87 inline styles — replace with CSS Module classes

## Phase 28 — Goal & Bill Edit Dialogs
- Add `updateGoal` action to `goalsSlice`; add edit dialog to Goals page
- Add `updateBill` action to `billsSlice`; add edit dialog to Bills page
- Goal edit: name, target amount, monthly contribution, type, deadline, color, icon
- Bill edit: name, amount, frequency, due day, account, category, variable flag

## Phase 29 — Forgot Password / Password Reset
- Backend: `POST /forgot-password` (generate reset token, store with expiry)
- Backend: `POST /reset-password` (validate token, update password)
- Backend: Email sending infrastructure (SMTP config, email templates)
- Frontend: ForgotPassword page (email input, success message)
- Frontend: ResetPassword page (token from URL, new password form)
- Register both routes in DesktopApp + MobileApp

## Phase 30 — Inline Style Cleanup
- Remove all 87 `style={{ }}` occurrences across all TSX files
- Replace with CSS Module classes
- Dynamic styles (colors, transforms) via CSS custom properties set from component
- Progress bars → Radix `<Progress>` component

## Phase 31 — Skeleton Loading States
- Create shared `Skeleton` usage patterns (Radix `<Skeleton>` available)
- Add skeleton loading states to: Home, Activity (first load), Bills, Categories, Goals, Merchants, Reports
- Add error boundaries to each page

## Phase 32 — Keyboard Shortcuts & Command Palette
- Desktop: Ctrl+K command palette (search pages, quick actions)
- Desktop: Global keyboard shortcuts (n to new transaction, / to search, etc.)
- Desktop: Keyboard navigation in transaction list (arrow keys)
- Mobile: No equivalent needed

## Phase 33 — Mobile Polish
- Replace Dialog with bottom sheet for AddTransactionModal on mobile
- Add swipe-to-delete to mobile Bills list
- Add pull-to-refresh to mobile Categories, Goals, Merchants, Reports
- Add mobile FAB to Home page directly

## Phase 34 — Desktop Polish
- Collapsible sidebar (hamburger menu at < 1024px)
- Hover states on all cards (Merchants, etc.)
- Breadcrumb navigation
- Responsive grid adjustments at 768-1023px breakpoints

## Phase 35 — Shared Utilities
- Currency formatter (replace inline `.toFixed(2)`)
- Date formatting utilities (replace duplicate `formatDate` functions)
- Amount color helper (income = green, expense = red)
- Shared types for common entities

## Phase 36 — Registration Form Improvements
- Add `username` field to Register page
- Add password confirmation field
- Client-side validation (password strength, email format, username requirements)
- Auto-generate username from email as fallback only

## Phase 37 — Merchant Enhancements
- Add rename merchant to merchant detail dialog
- Add backfill trigger button to Merchants page
- Add upload/merge functionality

## Phase 38 — Bill–Transaction Linking UI
- In bill detail: show linked transactions, allow manual linking
- In transaction detail: show linked bill, allow linking/unlinking
- Wire up existing `suggestBillLink` and `linkTransactionToBill` actions in UI

## Phase 39 — Data Export
- Backend: CSV/PDF export endpoints for transactions
- Frontend: Export button on Activity page (current filters applied)
- Reports page: PDF export of charts and summaries

## Phase 40 — Onboarding Flow
- New user welcome wizard after registration
- First account setup guidance
- Sample transaction seeding
- Tooltip hints on first visit

## Phase 41 — Auth Improvements
- Fetch full user profile via `GET /api/auth/me` after login
- Persist `full_name`, `username` in auth store
- Proactive token refresh before expiry (not just on 401)
- Show user name in TopBar popover (currently shows email only)

## Phase 42 — Testing
- Backend: pytest setup, conftest.py, test database
- Frontend: Vitest + React Testing Library setup
- Test auth flows (login, register, refresh)
- Test transaction CRUD
- Test NL parsing rules
- Test store actions with mock API

## Phase 43 — DevOps
- GitHub Actions CI (lint, typecheck, test on PR)
- Docker Compose for development (FastAPI + PostgreSQL + Vite proxy)
- Pre-commit hooks (lint-staged with eslint + prettier + ruff)
- `.nvmrc` for Node version pinning

## Phase 44 — Notifications
- Upcoming bill notifications (browser push / in-app toast)
- Goal milestone notifications
- Large transaction alerts
- Monthly spending summary notification
