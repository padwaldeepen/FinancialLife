# My Financial Life — Architecture & Goals

> This is a personal finance app running on localhost.
> Goal: Understand where my money goes and get advice on saving more.

---

## What Exists Today

### Data Model
- **Users** — single user (me), JWT auth
- **Accounts** — checking, savings, credit, cash, investment with balances
- **Transactions** — amount, description, type (income/expense), date, linked to account/category/merchant
- **Categories** — hierarchical (parent/child), system + user-created, with colors/icons
- **Merchants** — auto-extracted from transactions, deduplication, merge support
- **Bills** — recurring expenses with frequency, due dates, variable amounts, auto-linking to transactions
- **Goals** — save_up, pay_down, monthly_envelope with progress tracking
- **Budgets** — per-category or total, monthly/weekly/yearly periods

### What the App Does
1. Log transactions via natural language ("coffee 4.50" → structured transaction)
2. Show spending by category (pie charts), by merchant, by month
3. Track bills and auto-detect when they're paid
4. Track savings goals with progress
5. Generate monthly reports (income, expenses, net, breakdown)
6. Export data to CSV
7. AI chatbot for questions (optional, works without API keys)

### Tech Stack
- **Frontend**: React 19, TypeScript, Vite, CSS Modules, Radix UI, Nivo charts, Zustand
- **Backend**: FastAPI, SQLAlchemy 2.x, PostgreSQL, Alembic, JWT auth
- **AI**: Rule-based parsing + optional Gemini/Groq (free APIs only)
- **Infrastructure**: Docker Compose, localhost only

---

## What's Broken (From Code Review)

### Data Integrity (Must Fix)
- Money columns use `Float` → rounding errors. Should be `Numeric(12,2)`.
- `bill_id`/`goal_id` on Transaction have no ForeignKey → any integer accepted.
- `account_type`, `transaction_type`, `frequency` accept any string → typos corrupt reports.
- `compute_upcoming` doesn't await db.execute() → bills always show as "paid".
- No `amount > 0` validation → negative amounts accepted.

### UI (Should Fix)
- Dark mode broken on mobile (undefined CSS variables).
- Two floating add buttons on mobile.
- `window.confirm()` instead of Radix Dialog.
- ChatBot uses raw `<div>`s instead of Radix components.

### Security (Nice to Fix for Localhost)
- `/api/transactions/parse` has no auth.
- SECRET_KEY defaults to empty string.
- No password strength requirements.

---

## The Goal: From Tracker to Advisor

### What I Want
I want to open this app and immediately understand:
1. **Where is my money going?** → Category breakdown, merchant analysis
2. **How much am I earning vs spending?** → Income vs expense trends
3. **Where can I save money?** → Spending analysis, subscription detection
4. **Am I on track?** → Goal progress, budget status
5. **What should I do next?** → Personalized recommendations

### What's Missing

#### Insight Layer (Know What's Happening)
- **Recurring expense detection**: Find charges that repeat monthly (subscriptions, bills)
- **Spending anomaly detection**: "Your food spending jumped 40% this month"
- **Trend analysis**: "Your entertainment spending has increased 3 months in a row"
- **Category drift**: "You budgeted $200 for dining, you've spent $340"

#### Recommendation Layer (Know What to Do)
- **Savings opportunities**: "You could save $85/month by cutting these 3 subscriptions"
- **Bill optimization**: "Your phone bill increased 15% — shop around?"
- **Budget adjustments**: "Based on your income, here's a realistic budget"
- **Goal pacing**: "At current rate, you'll reach your emergency fund goal in 8 months"

#### Forecasting Layer (Know What's Coming)
- **Cash flow forecast**: "Based on income and upcoming bills, you'll have $1,200 left this month"
- **Safe-to-spend**: "You have $450 left for discretionary spending this week"
- **Bill impact**: "Adding this $50/month subscription leaves $200 buffer"

---

## Architecture for Intelligence

### Current State
```
User Input → Transaction → Database → Reports (manual)
                                     → Chatbot (reactive)
```

### Target State
```
User Input → Transaction → Database → Insight Engine → Dashboard Cards
                                          ↓
                                     Recommendation Engine → Advice Panel
                                          ↓
                                     Forecasting Engine → Cash Flow View
```

### What Needs to Be Built

#### 1. Insight Engine (Backend Service)
A service that analyzes transaction data and produces insights:
- `analyze_spending_patterns(user_id)` → category trends, anomalies
- `detect_recurring_charges(user_id)` → subscription list
- `compare_periods(user_id, period1, period2)` → month-over-month changes
- Returns structured insight objects with evidence

#### 2. Recommendation Engine (Backend Service)
Takes insights and produces actionable recommendations:
- `generate_recommendations(user_id, insights)` → savings suggestions
- `score_recommendation(recommendation)` → priority/confidence
- Rule-based first, AI-enhanced later

#### 3. Forecasting Engine (Backend Service)
Projects future balances based on patterns:
- `forecast_cash_flow(user_id, months_ahead)` → projected income/expenses
- `calculate_safe_to_spend(user_id)` → discretionary budget
- `project_goal_completion(user_id, goal_id)` → estimated completion date

#### 4. Advisor Dashboard (Frontend)
New UI elements that surface intelligence:
- **Insight cards** on Home screen (top 3-5 insights)
- **Recommendations panel** with dismiss/act actions
- **Forecast view** with projected balances
- **Spending health score** (simple 0-100 metric)

---

## Recommended Build Order

### Phase A: Fix Data Integrity (2-3 days)
Make the data reliable before building intelligence on top of it.
1. Float → Numeric migration
2. ForeignKey fixes
3. Enum validation
4. Bill bug fix

### Phase B: Fix UI (1-2 days)
Make the app pleasant to use daily.
1. Dark mode fix
2. Duplicate FAB removal
3. Radix Dialog for confirmations

### Phase C: Insight Engine (1-2 weeks)
The most valuable addition. Start with:
1. Recurring charge detection (find repeats)
2. Monthly spending comparison ("this month vs last month")
3. Category trend analysis (3-month moving average)
4. Anomaly detection (spending > 2x average)

### Phase D: Recommendations (1 week)
Turn insights into advice:
1. "You can save $X by cutting Y" suggestions
2. Budget adherence warnings
3. Goal pacing advice

### Phase E: Forecasting (1 week)
Project the future:
1. Cash flow projection (income - known expenses)
2. Safe-to-spend calculation
3. Goal completion timeline

### Phase F: Polish (ongoing)
Make it all beautiful:
1. Insight cards on dashboard
2. Recommendation dismiss/act UI
3. Forecast visualization
4. Spending health score

---

## AI Strategy

### Free-Only Approach
All intelligence should work without paid APIs:
1. **Rule-based first**: Pattern matching, statistical analysis, threshold checks
2. **Free AI second**: Gemini/Groq for natural language summaries of insights
3. **Optional enhancement**: User can add API keys for richer analysis

### Example: Recurring Charge Detection (Rule-Based)
```python
# Group transactions by merchant + similar amount
# If same merchant + amount ±10% appears 3+ times in 3 months
# → Mark as recurring, calculate monthly cost
```

### Example: Savings Recommendation (Rule-Based)
```python
# Find recurring charges
# Rank by amount (highest first)
# Flag charges with increasing trend
# Generate: "Your top 3 subscriptions cost $X/month. 
#            #2 increased 15% last quarter."
```

### Example: Cash Flow Forecast (Statistical)
```python
# Average income (last 3 months) - Average expenses (last 3 months)
# Subtract known upcoming bills
# Add goal contributions
# = Projected end-of-month balance
```

---

## Key Principle: Simplicity

This is a personal app, not a SaaS product. The intelligence should be:
- **Simple**: One-line insights, not complex dashboards
- **Actionable**: "Cancel subscription X" not "Your spending patterns suggest..."
- **Honest**: "I don't have enough data yet" instead of guessing
- **Local**: All analysis runs on my machine, no data leaves

The goal is to open the app once a week, glance at the dashboard, and know exactly where I stand and what to do.
