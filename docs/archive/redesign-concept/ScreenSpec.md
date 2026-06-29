# Screen Specification

## Every Screen's Question, Content, and Actions

---

## 1. Home

**Question answered:** "How much money do I have right now?"

### Primary Content

```
┌──────────────────────────────────────┐
│  My Financial Life            Jun 28 │
│                                      │
│  ┌────────────────────────────────┐  │
│  │ Total Balance: $12,430.50      │  │
│  │ ▲ up $340 this month           │  │
│  └────────────────────────────────┘  │
│                                      │
│  Accounts                          │
│  ┌──────────────────────────────┐   │
│  │ ● Checking           $4,230 │   │
│  │ ● Savings           $8,200  │   │
│  │ ○ Credit Card        -$250  │   │
│  └──────────────────────────────┘   │
│                                      │
│  Upcoming Bills (next 7 days)      │
│  ┌──────────────────────────────┐   │
│  │ Rent           $1,200  Jul 1 │   │
│  │ Netflix         $15.99 Jul 2 │   │
│  └──────────────────────────────┘   │
│                                      │
│  Recent Activity                    │
│  ┌──────────────────────────────┐   │
│  │ Today                        │   │
│  │ Coffee Shop      $4.50       │   │
│  │ Salary Deposit  $3,200.00    │   │
│  │ Yesterday                    │   │
│  │ Walmart          $84.23      │   │
│  └──────────────────────────────┘   │
└──────────────────────────────────────┘
```

### User Actions

| Action | Behavior |
|--------|----------|
| Tap account card | Show account detail (transactions for this account) |
| Tap upcoming bill | Show bill detail |
| Tap transaction | Show transaction detail |
| Pull to refresh | Refresh balances |
| Long-press transaction | Quick edit amount or category |

### States

| State | Behavior |
|-------|----------|
| First use / no data | Show "Record your first transaction" prompt + example. No setup wizard. |
| Multiple accounts | Show all. Credit cards in red (negative = owed). |
| No upcoming bills | Hide section. |
| Error loading balances | Show cached balances + "Last updated X min ago" warning. |

### Data Requirements

- `GET /api/accounts/` — list of accounts with balances
- `GET /api/bills/upcoming?days=7` — bills due in next 7 days
- `GET /api/transactions/?limit=5` — recent transactions

---

## 2. Activity

**Question answered:** "Where did my money go?"

### Primary Content

```
┌──────────────────────────────────────┐
│  ← Home        Activity           🔍 │
│                                      │
│  [Search transactions...          ]  │
│                                      │
│  Filters: [All] [Income] [Expense]  │
│           [This Month] [Merchant ▾]  │
│                                      │
│  June 2026             Total: -$945  │
│  ┌──────────────────────────────┐   │
│  │ Jun 28                       │   │
│  │ Coffee Shop     ☕   $4.50   │   │
│  │                Food & Dining │   │
│  │ Salary         💰  $3,200   │   │
│  │                Income        │   │
│  │ Jun 27                       │   │
│  │ Walmart         🛒  $84.23  │   │
│  │                Shopping      │   │
│  │ Amazon          📦  $29.99  │   │
│  │                Shopping      │   │
│  │ Netflix         📺  $15.99  │   │
│  │                Entertainment │   │
│  └──────────────────────────────┘   │
│                                      │
│  [View all 147 transactions    →]   │
└──────────────────────────────────────┘
```

### User Actions

| Action | Behavior |
|--------|----------|
| Tap search bar | Open full search (searches descriptions, merchants, amounts, notes) |
| Tap filter chips | Filter the list |
| Tap transaction | Expand: show date, merchant, category, notes, edit/delete |
| Tap merchant name | Navigate to Merchant detail |
| Swipe left (mobile) | Delete transaction (with undo toast) |
| Scroll down | Infinite load more |

### States

| State | Behavior |
|-------|----------|
| Search active | Results grouped by relevance. Highlight matched text. |
| No results | "No transactions match. Try a different search." |
| Filter active | Show active filter chips. Clear all button. |

### Data Requirements

- `GET /api/transactions/?search=&type=&merchant=&category=&date_from=&date_to=&sort=&limit=&offset=`

---

## 3. Add Transaction (FAB / Modal / Sheet)

**Question answered:** "I need to record something."

### Primary Content (Mobile Bottom Sheet / Desktop Slide-over)

```
┌──────────────────────────────────────┐
│  New Transaction              [Done] │
│                                      │
│  ┌──────────────────────────────┐   │
│  │  coffee 4.50                  │   │
│  │                                │   │
│  │  ↓ Coffee Shop                │   │
│  │     $4.50  •  Food & Dining   │   │
│  │     Today  12:30 PM           │   │
│  └──────────────────────────────┘   │
│                                      │
│  [✓ Looks good - Save]             │
│                                      │
│  ─────────────────────────────       │
│  Scan Receipt  │  Manual Entry      │
└──────────────────────────────────────┘
```

### Input Methods (Priority Order)

| Method | How It Works |
|--------|-------------|
| **NL Text (default)** | Type what you bought and how much. App parses merchant, amount, category automatically. |
| **Manual Entry** | Form fields: amount, description, merchant, category, account, date, notes |
| **Receipt Scan** | Camera → Tesseract OCR → pre-fill form. Slow but useful for complex receipts. |

### NL Parsing Examples

```
"coffee 4.50"           → Coffee Shop, $4.50, Food & Dining
"walmart 84.23"         → Walmart, $84.23, Shopping
"salary 3200"           → Salary, $3,200.00, Income
"netflix 15.99"         → Netflix, $15.99, Entertainment
"rent 1200"            → Rent, $1,200.00, Housing
"amazon headphones 60"  → Amazon, $60.00, Shopping
"gas 45"                → Shell (or generic), $45.00, Transportation
```

### User Actions

| Action | Behavior |
|--------|----------|
| Type in NL field | Live preview below updates as you type |
| Tap Save | Parse + create transaction. Return to previous screen. Show subtle success toast. |
| Tap Scan | Open camera for receipt photo |
| Tap Manual | Show full form |
| Swipe down (mobile) | Dismiss sheet without saving |

### States

| State | Behavior |
|-------|----------|
| Empty field | "What did you spend?" placeholder text |
| Typing | Real-time parsing preview below |
| Parsing failed | Show manual form pre-filled with raw text |
| Saving | Animated checkmark on save button |
| Error | "Couldn't save. Try again." with retry button |

### Key Design Decisions

1. **No separate page.** Adding a transaction should never take you away from what you were doing.
2. **Parse happens client-side.** No round-trip to server for parsing. Instant feedback.
3. **One field, not three.** Amount + description in one natural string. The app figures it out.
4. **Save is the last step.** Confirm the parsed result, fix if wrong, then save.

---

## 4. Bills

**Question answered:** "What bills are due? What do I pay every month?"

### Primary Content

```
┌──────────────────────────────────────┐
│  ← Home           Bills             │
│                                      │
│  Upcoming This Week                 │
│  ┌──────────────────────────────┐   │
│  │ Jul 1  Rent         $1,200  │   │
│  │       Account: Checking      │   │
│  │ Jul 2  Netflix        $15   │   │
│  │       Account: Credit Card   │   │
│  └──────────────────────────────┘   │
│                                      │
│  All Bills                          │
│  ┌──────────────────────────────┐   │
│  │   Rent              $1,200/mo│   │
│  │   Due 1st • Housing          │   │
│  │                             │   │
│  │   Netflix             $15/mo│   │
│  │   Due 2nd • Entertainment   │   │
│  │                             │   │
│  │   Electric          $65-95/mo│   │
│  │   Due 15th • Utilities      │   │
│  │   ↕ varies each month       │   │
│  │                             │   │
│  │   Internet              $80  │   │
│  │   Due 20th • Utilities      │   │
│  └──────────────────────────────┘   │
│                                      │
│  [+] Add Bill                       │
└──────────────────────────────────────┘
```

### User Actions

| Action | Behavior |
|--------|----------|
| Tap bill | Show detail: payment history, average, trend graph |
| Tap "Add Bill" | Form: name, amount (or variable), frequency, due date, category, account |
| Swipe to delete | Remove bill |
| Tap history | "Electricity — last 6 months" with amount per month |

### States

| State | Behavior |
|-------|----------|
| No bills | "Add your first bill. Rent, subscriptions, anything you pay regularly." |
| Variable bill (electric) | Show range: $65-95/mo. Show history chart. |
| Bill due today | Highlighted. Mark as "Due Today". |
| Bill overdue | Red. Mark as "Overdue — 3 days ago". |

### Data Requirements

- `GET /api/bills/` — all bills with next due date
- `GET /api/bills/{id}/history` — past payments for this bill
- `POST /api/bills/` — create bill
- `PUT /api/bills/{id}` — update bill
- `DELETE /api/bills/{id}` — remove bill

---

## 5. Merchants

**Question answered:** "How much have I spent at [store]?"

### Primary Content

```
┌──────────────────────────────────────┐
│  ← Activity         Merchants       │
│                                      │
│  [Search merchants...             ]  │
│                                      │
│  Top Merchants (This Year)          │
│  ┌──────────────────────────────┐   │
│  │ Amazon              $2,340  →│   │
│  │ Walmart             $1,890  →│   │
│  │ Costco              $1,200  →│   │
│  │ Publix                $840  →│   │
│  │ Shell                 $620  →│   │
│  └──────────────────────────────┘   │
│                                      │
│  All Merchants (Alphabetical)       │
│  ┌──────────────────────────────┐   │
│  │ Amazon         $2,340  47 tx │   │
│  │ Apple          $1,200   3 tx │   │
│  │ Best Buy         $540   2 tx │   │
│  └──────────────────────────────┘   │
└──────────────────────────────────────┘
```

### Merchant Detail (tapped)

```
┌──────────────────────────────────────┐
│  ← Merchants          Amazon         │
│                                      │
│  Total: $2,340.00                    │
│  47 transactions                     │
│  First: Jan 12, 2025                 │
│  Most recent: Jun 25, 2026           │
│                                      │
│  Spending Over Time                  │
│  [━━━━━━━━━━━━━━━━━━━━━━━━━━━]       │
│  Jan  Feb  Mar  Apr  May  Jun       │
│                                      │
│  Recent                              │
│  ┌──────────────────────────────┐   │
│  │ Jun 25  Echo Dot    $39.99  │   │
│  │ Jun 18  Dog food     $52.30 │   │
│  │ Jun 10  Batteries    $14.99 │   │
│  │ Jun 2   Shampoo      $22.50 │   │
│  │ [Show all 47 →]              │   │
│  └──────────────────────────────┘   │
│                                      │
│  Categories at Amazon                │
│  Shopping      $1,800                │
│  Entertainment   $340                │
│  Electronics     $200                │
└──────────────────────────────────────┘
```

### User Actions

| Action | Behavior |
|--------|----------|
| Tap merchant | Merchant detail page |
| Search merchants | Filter list by name |
| Tap transaction in detail | Navigate to that transaction in Activity |

### Data Requirements

- `GET /api/merchants/` — all merchants with totals
- `GET /api/merchants/{name}` — merchant detail with history
- Merchants are derived from transaction data. No create/update needed.

---

## 6. Categories

**Question answered:** "Where is my money going?"

### Primary Content

```
┌──────────────────────────────────────┐
│  ← Home          Categories         │
│                                      │
│  [This Month] [Last Month] [Year]   │
│                                      │
│  Spending by Category                │
│                                      │
│  Housing          $1,350    35%      │
│  ████████████████████░░░░░░░░░░     │
│                                      │
│  Food & Dining      $680    17%      │
│  ██████████░░░░░░░░░░░░░░░░░░░░     │
│                                      │
│  Shopping           $520    13%      │
│  ███████░░░░░░░░░░░░░░░░░░░░░░░     │
│                                      │
│  Transportation     $340     9%      │
│  █████░░░░░░░░░░░░░░░░░░░░░░░░░     │
│                                      │
│  Entertainment      $210     5%      │
│  ███░░░░░░░░░░░░░░░░░░░░░░░░░░░     │
│                                      │
│  [View All Categories →]             │
└──────────────────────────────────────┘
```

### Category Detail (tapped)

```
┌──────────────────────────────────────┐
│  ← Categories     Food & Dining     │
│                                      │
│  This month: $680                    │
│  Last month: $590  ▲ 15%            │
│                                      │
│  Subcategories                       │
│  Groceries       $420                │
│  Dining Out      $260                │
│                                      │
│  Top Merchants                       │
│  Publix          $210                │
│  Walmart         $180                │
│  Chipotle         $85                │
│  Starbucks        $52                │
│                                      │
│  Recent                              │
│  ┌──────────────────────────────┐   │
│  │ Jun 27  Walmart     $84     │   │
│  │ Jun 26  Chipotle    $18     │   │
│  │ Jun 25  Publix      $56     │   │
│  └──────────────────────────────┘   │
└──────────────────────────────────────┘
```

### Data Requirements

- `GET /api/categories/summary?period=month` — spending by category with totals
- `GET /api/categories/{id}` — category detail with subcategories, merchants, recent tx

---

## 7. Goals

**Question answered:** "Am I saving enough for what matters to me?"

### Primary Content

```
┌──────────────────────────────────────┐
│  ← Home              Goals          │
│                                      │
│  ┌──────────────────────────────┐   │
│  │ ✈️ Vacation Fund          │   │
│  │ $2,000 / $5,000            │   │
│  │ ████████████░░░░░░░░  40%  │   │
│  │ $300/mo → Mar 2027          │   │
│  └──────────────────────────────┘   │
│                                      │
│  ┌──────────────────────────────┐   │
│  │ 🚨 Emergency Fund           │   │
│  │ $3,000 / $10,000            │   │
│  │ ██████░░░░░░░░░░░░░░  30%   │   │
│  │ $200/mo → Dec 2027           │   │
│  └──────────────────────────────┘   │
│                                      │
│  ┌──────────────────────────────┐   │
│  │ 💻 New Laptop               │   │
│  │ $800 / $2,000               │   │
│  │ ████████░░░░░░░░░░░░  40%   │   │
│  │ No monthly contribution      │   │
│  └──────────────────────────────┘   │
│                                      │
│  [+ New Goal]                        │
└──────────────────────────────────────┘
```

### Goal Detail (tapped)

```
┌──────────────────────────────────────┐
│  ← Goals         Vacation Fund      │
│                                      │
│  Target: $5,000                      │
│  Saved:  $2,000                      │
│  Left:   $3,000                      │
│                                      │
│  Progress Over Time                  │
│  [░░░░░░░░░░░░░░░░░░░░░░░░░░]        │
│  Started: Jan 2026                   │
│  Projected: Mar 2027                 │
│                                      │
│  Contributions                       │
│  ┌──────────────────────────────┐   │
│  │ Jun 1  +$300                │   │
│  │ May 1  +$300                │   │
│  │ Apr 1  +$300                │   │
│  │ Mar 5  +$200 (first)        │   │
│  └──────────────────────────────┘   │
│                                      │
│  [+ Add Contribution]                │
└──────────────────────────────────────┘
```

### How Goals Replace Budgets

| Concept | Old (Budgets) | New (Goals) |
|---------|-------------|-------------|
| Mindset | "Don't overspend in X" | "Save toward X" |
| Emotion | Restriction, guilt | Motivation, progress |
| Flexibility | Hard limits, warnings | Adjustable, aspirational |
| Time horizon | Monthly | Any (months to years) |

Goals do not prevent spending. They show progress toward things you care about. If someone wants a monthly limit on dining out, that's an **Envelope** (a sub-type of goal with a monthly reset). But the default should be goals.

### Data Requirements

- `GET /api/goals/` — all goals with progress
- `GET /api/goals/{id}` — goal detail with contributions
- `POST /api/goals/` — create goal
- `PUT /api/goals/{id}` — update goal
- `POST /api/goals/{id}/contribute` — add contribution

---

## 8. Reports

**Question answered:** "How did I do this month/year?"

### Primary Content

```
┌──────────────────────────────────────┐
│  ← Home            Reports          │
│                                      │
│  [Month ▾] [Year ▾]                 │
│                                      │
│  Summary (June 2026)                 │
│  Income:    $4,200                   │
│  Expenses:  -$3,150                  │
│  Savings:   +$1,050  ▲ 25%          │
│                                      │
│  Where your money went               │
│  Housing        $1,350   43%         │
│  Food             $680   22%         │
│  Shopping         $520   16%         │
│  Transport        $340   11%         │
│  Entertainment    $210    7%         │
│  Health            $50    1%         │
│                                      │
│  Comparison (vs Last Month)          │
│  Spending: +$120  ▲ 4%              │
│  Biggest change: Food +$90 (+15%)   │
│                                      │
│  Top 5 Merchants                     │
│  Amazon        $340                  │
│  Walmart       $280                  │
│  Publix        $210                  │
│  Shell         $180                  │
│  Costco        $150                  │
│                                      │
│  [Download as CSV]                   │
└──────────────────────────────────────┘
```

### User Actions

| Action | Behavior |
|--------|----------|
| Change period | Refresh all data for selected period |
| Tap category | Navigate to Category detail |
| Tap merchant | Navigate to Merchant detail |
| Download CSV | Export transactions for this period |

### Data Requirements

- `GET /api/reports/summary?period=month&date=2026-06` — income, expenses, savings, comparison
- `GET /api/reports/export?date_from=&date_to=` — CSV export

---

## 9. Settings (in More tab)

**Question answered:** "How do I configure the app?"

### Content (compact, single scroll)

- Profile: name, email
- Preferences: currency, date format, first day of week, default account
- Theme: dark mode toggle
- Data: export all, delete all
- About: version, links

### Rationale

Settings is not a primary destination. It should be compact, accessible from a gear icon, and never interrupt the user's flow.

---

## Summary: Questions → Screens

| User Question | Screen |
|--------------|--------|
| How much money do I have? | Home |
| Where did my money go? | Activity |
| I need to record a transaction | Add (FAB/modal) |
| What bills are due? | Bills |
| How much have I spent at X? | Merchants |
| Where is my money going by category? | Categories |
| Am I saving enough? | Goals |
| How did this month/year go? | Reports |
| How do I configure the app? | Settings |
