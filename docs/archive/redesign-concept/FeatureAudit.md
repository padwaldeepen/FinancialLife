# Feature Audit

## Every Feature — Keep, Change, or Remove

---

## Audit Method

Each feature of the current application is listed below with:

- **Verdict:** Keep | Change | Remove
- **Why:** Reasoning based on user value
- **If Change:** What it becomes

---

## Current Screens / Pages

| Feature | Verdict | Why | New Form |
|---------|---------|-----|----------|
| **Dashboard** | Remove | Tries to answer too many questions at once. Pie chart + bar chart + recent transactions = no clear focus. | Replaced by **Home** which answers exactly one question: "How much money do I have?" |
| **Transactions** | Change | The concept is correct (list of transactions) but the name is accounting-speak. | Renamed to **Activity**. Same data, clearer name. |
| **AddTransaction (page)** | Remove | Adding a transaction should not require navigation. It should be a modal/sheet available from anywhere. | Replaced by **FAB → modal**. One tap from any screen. |
| **Budgets** | Remove | Budgets are rigid, guilt-inducing, and accounting-oriented. People do not think in category limits. | Replaced by **Goals**. Motivational progress toward things the user cares about. |
| **Settings (placeholder)** | Keep | Settings are necessary but not a primary destination. | **Compact form in More tab.** One scroll, no sub-pages. |
| **Profile (placeholder)** | Remove | A profile page has no daily use case in a personal finance app. | **Merged into Settings.** Name, email, preferences. |

---

## Current Backend Endpoints

| Endpoint | Verdict | Why |
|----------|---------|-----|
| `POST /api/auth/register` | Keep | Core auth. No change needed. |
| `POST /api/auth/login` | Keep | Core auth. No change needed. |
| `POST /api/auth/refresh` | Keep | Token rotation. Keep. |
| `POST /api/auth/logout` | Keep | Keep. |
| `GET /api/auth/me` | Keep | Keep. Returns user profile + settings. |
| `POST /api/transactions/` | Change | Add `account_id` required. Add optional `merchant_id`, `bill_id`, `goal_id`. |
| `GET /api/transactions/` | Change | Rename to `/api/activity/`. Add merchant filter. Accept `merchant_id`. |
| `GET /api/transactions/{id}` | Change | Return richer response with merchant, account, bill links. |
| `PUT /api/transactions/{id}` | Change | Allow updating merchant, account, bill links. |
| `DELETE /api/transactions/{id}` | Keep | No change needed. |
| `GET /api/transactions/summary/dashboard` | Remove | Endpoint designed for old Dashboard. Replace with account-based endpoint. |
| `POST /api/transactions/parse` | Change | Keep but move to client-side. Server endpoint becomes fallback. |
| `POST /api/transactions/quick-add` | Keep | Unified create with parse. Keep as single endpoint. |
| `GET /api/budgets/` | Remove | Replaced by `/api/goals/`. |
| `POST /api/budgets/` | Remove | Replaced by goals. |
| `GET /api/budgets/{id}` | Remove | |
| `PUT /api/budgets/{id}` | Remove | |
| `DELETE /api/budgets/{id}` | Remove | |
| `POST /api/ai/categorize` | Keep | Rule-based categorization. Useful as server-side fallback. |
| `GET /api/ai/categories` | Keep | List system categories. Keep. |

---

## Current Frontend Components

| Component | Verdict | Why |
|-----------|---------|-----|
| **ProtectedRoute** | Keep | Auth guard. Still needed. |
| **Sidebar (Desktop)** | Change | Update nav items: Home, Activity, Bills, Merchants, Categories, Goals, Reports, Settings. |
| **TopBar (Desktop)** | Keep | User menu, dark mode toggle, logout. Keep. Add search entry point. |
| **BottomTabBar (Mobile)** | Change | New tabs: Home, Activity, +, Bills, More. |
| **FAB (Mobile)** | Keep | FAB concept is correct. Keep. Trigger Add modal. |
| **Desktop Dashboard** | Remove | Replace with new Home component. |
| **Mobile Dashboard** | Remove | Replace with new Home component. |
| **Desktop Transactions** | Change | Rename to Activity. Keep list + filters + search. |
| **Mobile Transactions** | Change | Same as Desktop. |
| **Desktop AddTransaction** | Remove | Replaced by modal/sheet. |
| **Mobile AddTransaction** | Remove | Replaced by bottom sheet. |
| **Desktop Budgets** | Remove | Replaced by Goals. |
| **Mobile Budgets** | Remove | Replaced by Goals. |
| **Desktop Login** | Keep | No change needed. |
| **Mobile Login** | Keep | No change needed. |
| **Desktop Register** | Keep | No change needed. |
| **Mobile Register** | Keep | No change needed. |

---

## Current Zustand Store

| Slice | Verdict | Why |
|-------|---------|-----|
| **authSlice** | Keep | Works. Add user preferences to response. |
| **transactionsSlice** | **Not yet built** | Needs to be created. Should match Activity screen needs. |
| **UI slice** | **Not yet built** | Needs to be created. sidebar open, active modal, dark mode (move from authContext). |

### New Slices Needed

| Slice | State | Actions |
|-------|-------|---------|
| **accountsSlice** | accounts[], activeAccountId | fetchAccounts, createAccount, updateAccount |
| **activitySlice** | transactions[], filters, searchQuery, pagination | fetchActivity, search, filter, deleteTransaction |
| **billsSlice** | bills[], upcomingBills[] | fetchBills, createBill, updateBill, deleteBill |
| **merchantsSlice** | merchants[], activeMerchant | fetchMerchants, fetchMerchantDetail, mergeMerchants |
| **goalsSlice** | goals[] | fetchGoals, createGoal, contributeToGoal |

---

## Current Models

| Model | Verdict | Notes |
|-------|---------|-------|
| **User** | Change | Remove `username`, `is_admin`, `is_active`. Add `currency`, `first_day_of_week`. |
| **Category** | Change | Add `parent_id`, `is_system`. Make user_id nullable (system categories). |
| **Transaction** | Change | Add `account_id`, `merchant_id`, `bill_id`, `goal_id`, `is_pending`, `is_recurring`. Remove `ai_categorized`. |
| **Budget** | Remove | Replace with Goal model. |
| **Account** | **NEW** | Required. See DataModel.md. |
| **Merchant** | **NEW** | Required. See DataModel.md. |
| **Bill** | **NEW** | Required. See DataModel.md. |
| **Goal** | **NEW** | Required. See DataModel.md. |
| **TransactionBillLink** | **NEW** | Optional. See DataModel.md. |

---

## Current Dependencies (Frontend)

| Dependency | Verdict | Notes |
|-----------|---------|-------|
| React 19 | Keep | Core. No change. |
| Radix Themes | Keep | Works well for this use case. |
| Radix Icons / Lucide | Keep | Good icon set for categories/merchants. |
| Nivo (Pie/Bar) | Change | Move charts to Categories + Reports screens. Remove from Home. |
| Zustand | Keep | Good state management. Add slices. |
| Axios | Keep | HTTP client. Works. |
| react-router-dom | Keep | Routing. No change. |
| Tesseract.js | Keep but demote | OCR is secondary input. Keep as advanced option. |
| date-fns | Keep | Date formatting. Keep. |
| Immer | Keep | State mutations. Keep. |

---

## Current Dependencies (Backend)

| Dependency | Verdict | Notes |
|-----------|---------|-------|
| FastAPI | Keep | Core framework. No change. |
| SQLAlchemy | Keep | ORM. No change. |
| Alembic | Keep | Migrations. **Start using properly** (stop relying on auto-create). |
| asyncpg | Keep | PostgreSQL driver. No change. |
| python-jose | Keep | JWT. No change. |
| passlib | Keep | Password hashing. No change. |
| pydantic v2 | Keep | Validation. No change. |
| uvicorn | Keep | ASGI server. No change. |

---

## Summary: Features by Verdict

| Verdict | Count | Items |
|---------|-------|-------|
| **Keep** | 22 | Auth, search, NL parsing, Radix, Zustand, FastAPI, SQLAlchemy, etc. |
| **Change** | 20 | Transaction model, User model, Category model, Sidebar, BottomTabBar, etc. |
| **Remove** | 18 | Dashboard, Budgets, Profile page, AddTransaction page, admin role, username, pie charts on Home, old summary endpoint, etc. |
| **NEW** | 5 models + 6 slices + 4 screens | Account, Merchant, Bill, Goal, TransactionBillLink + all new screens |
