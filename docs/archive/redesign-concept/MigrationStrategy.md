# Migration Strategy

## How to Evolve from Current to New Without Losing Momentum

---

## Principle

Do not try to rebuild everything at once. The current app works for basic transaction tracking. The new design adds screens and capabilities while keeping what works.

The migration happens in **4 phases**. Each phase ends with a working, shippable application.

---

## Phase 1: Foundation — Accounts & Navigation (Week 1-2)

### Goal
Establish the new navigation structure and account model. The app still looks similar but the skeleton is new.

### Backend Changes

1. **Create Account model + migration**
   - Add `accounts` table
   - Create default account for existing users
   - Add `account_id` FK to transactions table

2. **Update User model**
   - Drop `username` column
   - Drop `is_admin` column
   - Drop `is_active` column
   - Add `currency` column (default: USD)
   - Add `first_day_of_week` column (default: 1)

3. **Create Account router + service**
   - `GET /api/accounts/` — list accounts with balances
   - `POST /api/accounts/` — create account
   - `PUT /api/accounts/{id}` — update account name/type
   - `DELETE /api/accounts/{id}` — deactivate account

4. **Update Transaction model**
   - Add `account_id` (required, default to user's first account)
   - Add `merchant_id` (nullable, will populate in Phase 2)
   - Add `is_pending` (default: false)
   - Add `is_recurring` (default: false)

5. **Update Dashboard summary endpoint**
   - Return account balances alongside income/expense
   - Return upcoming bills placeholder (empty until Phase 3)

### Frontend Changes

1. **New navigation structure**
   - Mobile: Home | Activity | + | Bills | More
   - Desktop: Home | Activity | Bills | Merchants | Categories | Goals | Reports | Settings

2. **Redesign Home screen**
   - Total balance at top
   - Account cards below
   - Recent activity (last 5 transactions)
   - Upcoming bills (hidden if empty)

3. **Rename Dashboard to Home**
   - Old Dashboard route `/` → New Home
   - Old Transactions route → Activity

4. **FAB component**
   - Floating action button on mobile
   - Cmd+K or "+" button on desktop
   - Opens Add modal/sheet (not a page)

5. **Add "More" tab content**
   - Settings gear
   - Link to Categories
   - Link to Goals (placeholder until Phase 4)
   - Export data button
   - Dark mode toggle
   - Logout

### What Breaks

| Breaking Change | Mitigation |
|----------------|-----------|
| Transaction model gains required `account_id` | Migration sets all existing transactions to user's default account |
| Username column removed | Previously unused in the UI anyway |
| Old navigation URLs change | Redirect /transactions → /activity, /add → modal no longer a route |

### Verification
- Existing login/register still works
- Existing transactions are still visible under Activity
- Home shows accounts + balances
- FAB opens add modal

---

## Phase 2: Merchants & Smart Parsing (Week 3-4)

### Goal
Deliver the Merchants screen. Improve NL parsing to extract merchants reliably.

### Backend Changes

1. **Create Merchant model + migration**
   - Create `merchants` table
   - Backfill merchants from existing transaction descriptions
   - Auto-merge common variations (AMZN → Amazon, SBUX → Starbucks)

2. **Update NL parser**
   - Improve merchant extraction regex
   - Add merchant alias matching
   - Client-side parse preview (realtime as user types)

3. **Create Merchant router**
   - `GET /api/merchants/` — list with totals
   - `GET /api/merchants/{id}` — detail with history
   - `POST /api/merchants/merge` — merge duplicate merchants
   - `PUT /api/merchants/{id}` — rename, hide, set aliases

4. **Update Transaction creation**
   - Parse merchant from description on create
   - Auto-create or match to existing merchant
   - Store `merchant_id` on transaction

5. **Transfer transaction type**
   - Add `transfer` to transaction_type enum
   - Transfer logic: debit one account, credit another

### Frontend Changes

1. **Merchants screen (desktop sidebar, More tab on mobile)**
   - Searchable list sorted by total spent
   - Merchant detail with spending chart, transaction history, category breakdown
   - Merge duplicates UI

2. **Improved Add modal**
   - Real-time parse preview as user types
   - Shows merchant icon + name, amount, category
   - One-tap save

3. **Activity screen updates**
   - Show merchant name + icon on each transaction row
   - Tappable merchant name → Merchant detail
   - Group by merchant option

### What Breaks

| Breaking Change | Mitigation |
|----------------|-----------|
| Transaction gains nullable `merchant_id` | Auto-populated on create. Existing transactions get merchant on next edit or via backfill migration. |

### Verification
- Typing "amazon 60" creates transaction linked to Amazon merchant
- Merchants screen shows list with totals from existing data
- Merchant detail shows spending over time

---

## Phase 3: Bills & Recurring Payments (Week 5-6)

### Goal
Deliver the Bills screen. Answer "What bills are due?"

### Backend Changes

1. **Create Bill model + migration**
   - Create `bills` table
   - No data backfill — this is new data entry

2. **Create Bill router**
   - `GET /api/bills/` — all bills with next due date
   - `POST /api/bills/` — create bill
   - `PUT /api/bills/{id}` — update
   - `DELETE /api/bills/{id}` — remove
   - `GET /api/bills/upcoming?days=7` — bills due soon

3. **Create TransactionBillLink model**
   - `GET /api/bills/{id}/history` — past payments linked to this bill

4. **Update Transaction creation**
   - Suggest bill match when description/merchant matches a known bill
   - "Is this your rent payment?" prompt
   - Auto-link if user confirms

### Frontend Changes

1. **Bills screen (bottom tab on mobile, sidebar on desktop)**
   - "Upcoming This Week" section
   - All bills list
   - Add bill form (name, amount, frequency, due day, category, account)
   - Bill detail with payment history and chart (for variable bills like electric)

2. **Home screen update**
   - Show upcoming bills in the next 7 days
   - Tap → Bills screen

3. **Activity screen update**
   - Show bill-linked transactions with bill icon
   - "This is a bill payment" badge

### Verification
- User creates a bill for "Rent $1,200 due 1st"
- Home shows "Rent due in 3 days"
- When user records rent, app asks "Link to Rent bill?"
- Bill detail shows payment history

---

## Phase 4: Goals & Reports (Week 7-8)

### Goal
Replace budgets with goals. Deliver Reports screen.

### Backend Changes

1. **Create Goal model + migration**
   - Drop `budgets` table (or migrate to goals)
   - Create `goals` table
   - Create `goal_contributions` table (optional — could track via linked transactions)

2. **Create Goal router**
   - CRUD for goals
   - Contribution tracking

3. **Create Reports endpoints**
   - `GET /api/reports/summary?period=month&date=2026-06`
   - `GET /api/reports/export?date_from=&date_to=`

4. **Delete old Budget model**
   - Remove budgets table
   - Remove budgets router (entirely replaced by goals)

### Frontend Changes

1. **Goals screen**
   - Progress cards for each goal
   - Create goal form
   - Goal detail with contribution history
   - "Add from transaction" option when recording

2. **Reports screen**
   - Month/Year selector
   - Income vs expenses summary
   - Category breakdown with percentages
   - Comparison to previous period
   - Top merchants
   - CSV export

3. **Remove Budgets page**
   - Replace with Goals in navigation
   - Old route redirects

4. **Remove Pie chart from Home**
   - Category breakdown moves to Categories tab
   - Home stays focused on balances

### Verification
- User creates "Vacation Fund" goal
- User contributes $300 via a transaction
- Goal progress updates
- Reports show monthly summary with comparison

---

## Migration Summary Timeline

```
Week 1-2:   Accounts + Navigation          ← WE ARE HERE
                 │
Week 3-4:   Merchants + Smart Parsing
                 │
Week 5-6:   Bills + Recurring Payments
                 │
Week 7-8:   Goals + Reports
                 │
         DONE: All screens shipped
```

## What to Ship After All 4 Phases

- v2.0 — All new screens functional
- v2.1 — CSV/OFX import (current Phase 10 on roadmap)
- v2.2 — Offline support (current Phase 13)
- v2.3 — Investment tracking (current Phase 12, simplified)
- v2.4 — Advanced reports (Sankey, forecasting)
