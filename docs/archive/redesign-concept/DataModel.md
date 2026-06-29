# Data Model Design

## Entities Required for the New Design

---

## Legend

- 🟢 = Exists in current app (minor or no changes needed)
- 🟡 = Exists but needs significant changes
- 🔴 = New — does not exist yet
- ❌ = Remove

---

## 1. User 🟢

| Field | Type | Notes |
|-------|------|-------|
| id | int | PK |
| email | string | Unique. Login identifier. |
| password_hash | string | bcrypt. No change. |
| name | string | Display name. |
| currency | string | **NEW** Default: USD. Per-user currency setting. |
| first_day_of_week | int | **NEW** 0=Sunday, 1=Monday. For reports. |
| created_at | datetime | |
| updated_at | datetime | |

### Remove
- `username` — redundant with email. Unnecessary complexity.
- `is_admin` — personal finance app. Not needed.
- `is_active` — unused. Remove.

---

## 2. Account 🟡 (renamed from... doesn't exist yet)

**Current state:** The app has no account model. Transactions have no account association.

**Why it matters:** People have multiple accounts. A checking account, a savings account, a credit card. Money is not one lump sum — it lives in specific places. The Home screen must show where money is.

| Field | Type | Notes |
|-------|------|-------|
| id | int | PK |
| user_id | int | FK → users |
| name | string | "Chase Checking", "Savings", "Amex" |
| type | enum | `checking`, `savings`, `credit`, `cash`, `investment` |
| balance | decimal | Current balance |
| currency | string | Default: user's currency |
| is_active | bool | Soft-delete for closed accounts |
| sort_order | int | Display order on Home |
| created_at | datetime | |
| updated_at | datetime | |

### Rules
1. Every user starts with one default account (created on registration).
2. Balances update automatically when transactions are added.
3. Credit card balances are negative (what you owe).
4. Account balance = sum of all transactions + initial_balance.

---

## 3. Merchant 🔴

**Current state:** Merchants are extracted from transaction descriptions via regex, but stored as an inline string. No merchant model exists.

**Why it matters:** The Merchants screen requires aggregating by merchant. A dedicated model enables:
- Automatic merchant creation
- Merchant merging (Amazon vs AMZN vs Amazon.com)
- Merchant-level reports

| Field | Type | Notes |
|-------|------|-------|
| id | int | PK |
| user_id | int | FK → users |
| name | string | Display name |
| normalized_name | string | Lowercase, trimmed, for matching. Auto-derived. |
| aliases | jsonb | ["AMZN", "amazon.com", "Amazon Payments"] — alternative names to match against |
| logo_url | string | Optional. Could fetch from a service later. |
| is_hidden | bool | User can hide merchants from the list |
| created_at | datetime | |

### Auto-creation
When a transaction description contains a known merchant pattern, the merchant is auto-created or matched. If no match, a new merchant is created from the parsed description.

### Rules
1. Merging: If a user taps "Amazon" and they also have "AMZN" as a separate merchant, auto-merge.
2. Aliases: Pre-populated common aliases (AMZN → Amazon, SBUX → Starbucks).
3. No manual merchant CRUD — merchants are derived from transaction data. Users can only hide or merge.

---

## 4. Transaction 🟡

**Changes from current:**

| Change | Reason |
|--------|--------|
| Add `account_id` FK | Every transaction belongs to an account |
| Add `merchant_id` FK (nullable) | Link to merchant model |
| Add `bill_id` FK (nullable) | Link to bill if this is a bill payment |
| Add `goal_id` FK (nullable) | Link to goal contribution |
| Change `category_id` to optional | Unlinked transactions still work |
| Remove `ai_categorized` | Not needed. If uncategorized, show as "Uncategorized". |
| Add `is_pending` bool | For pending/cleared transactions |
| Add `is_recurring` bool | Flag for recurring transactions |

| Field | Type | Notes |
|-------|------|-------|
| id | int | PK |
| account_id | int | FK → accounts. **NEW** |
| user_id | int | FK → users |
| merchant_id | int | FK → merchants. Nullable. **NEW** |
| bill_id | int | FK → bills. Nullable. **NEW** |
| goal_id | int | FK → goals. Nullable. **NEW** |
| amount | decimal | Positive for income, negative for expense |
| description | string | "coffee 4.50" original input |
| category_id | int | FK → categories. Nullable. |
| transaction_type | enum | `income`, `expense`, `transfer` |
| date | date | Transaction date |
| notes | string | Optional user notes |
| is_pending | bool | **NEW** Default: false |
| is_recurring | bool | **NEW** Default: false |
| created_at | datetime | |
| updated_at | datetime | |

### Transfers
A transfer is a special transaction type. Creating a transfer:
- Debits account A
- Credits account B
- Same amount, same date
- Two transaction records linked by a `transfer_id`

---

## 5. Category 🟢

Minimal changes:

| Change | Reason |
|--------|--------|
| Add `parent_id` FK (nullable) | Hierarchical categories (Food → Groceries, Food → Dining Out) |
| Add `icon` string | Already exists. Use lucide-icon names. |
| Remove `user_id` | **🔴 Controversial.** See design note below. |

### Design Decision: Shared vs User-specific Categories

**Recommended: Shared base categories, user-extensible.**

1. System provides ~15 base categories (Housing, Food & Dining, Transportation, Shopping, Entertainment, Health, Utilities, Insurance, Education, Travel, Personal Care, Gifts, Income, Uncategorized, Transfer).
2. Users can create sub-categories under any base category.
3. Users can rename base categories for their own view.
4. This avoids 100 identical "Food" categories being created per user.

| Field | Type | Notes |
|-------|------|-------|
| id | int | PK |
| parent_id | int | FK → categories. Nullable. |
| name | string | "Groceries" |
| color | string | Hex color. Default: #6B7280 |
| icon | string | lucide icon name |
| is_system | bool | **NEW** True for base categories |
| user_id | int | FK → users. Nullable. Null = system category. |
| sort_order | int | |
| created_at | datetime | |

---

## 6. Bill (Recurring Payment) 🔴

**Why it exists:** One of the top-3 financial questions is "What bills are due?" This requires a dedicated model.

| Field | Type | Notes |
|-------|------|-------|
| id | int | PK |
| user_id | int | FK → users |
| name | string | "Rent", "Netflix", "Electric Bill" |
| amount | decimal | Fixed amount. Null for variable bills (utilities). |
| amount_estimated | decimal | Estimated amount for variable bills |
| frequency | enum | `weekly`, `biweekly`, `monthly`, `quarterly`, `yearly` |
| due_day | int | Day of month (1-31). For monthly. |
| category_id | int | FK → categories |
| merchant_id | int | FK → merchants. Nullable. |
| account_id | int | FK → accounts. Default payment account. |
| is_active | bool | True by default |
| is_variable | bool | **NEW** True for bills where amount changes (electric, water) |
| notes | string | |
| created_at | datetime | |
| updated_at | datetime | |

### Automatic Transaction Linking
When a transaction matches a bill (same merchant + approximate amount + same period), the app suggests linking it. Over time, this becomes automatic.

### Rules
1. Bills do not auto-create transactions. They show as "upcoming" with a suggested amount.
2. When the user pays a bill, they record it via Add. The app detects the match retrospectively.
3. Exception: User can enable "auto-create" for fixed-amount bills (rent, subscriptions).

---

## 7. Goal 🔴 (replaces Budget)

| Field | Type | Notes |
|-------|------|-------|
| id | int | PK |
| user_id | int | FK → users |
| name | string | "Vacation Fund", "Emergency Fund" |
| target_amount | decimal | Total savings target |
| current_amount | decimal | Saved so far |
| monthly_contribution | decimal | Target monthly amount |
| type | enum | `save_up` (accumulate), `pay_down` (reduce debt), `monthly_envelope` |
| category_id | int | FK → categories. For envelopes (monthly dining budget). Nullable. |
| deadline | date | Optional target date |
| icon | string | lucide icon name |
| color | string | Hex color |
| is_active | bool | |
| sort_order | int | |
| created_at | datetime | |
| updated_at | datetime | |

### Goal Types

| Type | Behavior |
|------|----------|
| `save_up` | Standard goal. Save money over time. Progress bar goes up. |
| `pay_down` | Debt payoff. Target = amount owed. Progress bar goes up as you pay. |
| `monthly_envelope` | Monthly spending limit (replaces traditional budgets). Resets each month. |

### How Envelopes Work
- Monthly limit for a category (e.g., $400 for Dining Out)
- Spending counts against envelope automatically (via category matching)
- At end of month, unused amount rolls over (optional) or resets
- This is the bridge for users who want traditional budget limits

---

## 8. Transaction → Bill Link 🔴

| Field | Type | Notes |
|-------|------|-------|
| id | int | PK |
| transaction_id | int | FK → transactions |
| bill_id | int | FK → bills |
| period_start | date | Bill period this payment covers |
| period_end | date | |
| is_auto_linked | bool | True if linked automatically |

---

## Entity Relationship Summary

```
User (1) ──< Account (many)
User (1) ──< Merchant (many)
User (1) ──< Bill (many)
User (1) ──< Goal (many)

Account (1) ──< Transaction (many)
Merchant (1) ──< Transaction (many)
Category (1) ──< Transaction (many)
Bill (1) ──< Transaction (many)
Goal (1) ──< Transaction (many)

Category (1) ──< Category (many)  [self-referential for hierarchy]
Bill (1) ──< TransactionBillLink (many)
Transaction (1) ──< TransactionBillLink (many)

User (1) ──< Category (many)  [user-created subcategories]
```

## Tables Removed

- None. The existing 4 tables (User, Category, Transaction, Budget) stay, though Budget is replaced by Goal.

## Tables Added

- Account
- Merchant
- Bill
- Goal
- TransactionBillLink

## Tables Changed

- Transaction: +5 new columns, -1 removed column
- User: +2 new columns, -2 removed columns
- Category: +2 new columns (parent_id, is_system)
- Budget: Replace with Goal. Migrate data or drop.
