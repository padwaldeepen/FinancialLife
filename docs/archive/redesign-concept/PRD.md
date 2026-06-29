# Product Requirements Document — Redesign

## My Financial Life v2

---

## 1. The Fundamental Problem

The current application is organized around **accounting concepts**:
- Transactions
- Categories
- Budgets

But people do not think like accountants. They think in **life questions**:
- "How much money do I have?"
- "Can I afford this?"
- "When is rent due?"
- "How much have I spent at Amazon?"

The current navigation (Dashboard → Transactions → AddTransaction → Budgets) asks the user to **translate their life into accounting terms** before they can use the app. This is the same mistake every other finance app makes.

## 2. The Redesign Principle

**Every screen answers exactly one question.**

If a screen tries to answer two questions, split it.
If a screen answers no clear question, remove it.
If a screen requires the user to know accounting terms to use it, rename it.

## 3. The New Navigation

### Mobile (Bottom Tab Bar)

| Tab | Question It Answers | Replaces |
|-----|-------------------|----------|
| **Home** | "How much money do I have?" | Dashboard |
| **Activity** | "Where did my money go?" | Transactions |
| **+** (FAB) | "I need to record something" | AddTransaction |
| **Bills** | "What bills are due?" | New |
| **More** | Everything else | Budgets + Settings + Profile |

### Desktop (Sidebar)

| Item | Question It Answers | Replaces |
|-----|-------------------|----------|
| Home | "How much money do I have?" | Dashboard |
| Activity | "Where did my money go?" | Transactions |
| Bills | "What bills are due?" | New |
| Merchants | "How much have I spent at [store]?" | New |
| Categories | "Where is my money going?" | (part of Dashboard) |
| Goals | "Am I saving enough for what matters?" | Budgets |
| Reports | "How did this month/year go?" | New |
| Settings | "How do I configure the app?" | Settings + Profile |

## 4. Screens Removed or Replaced

| Current Screen | Decision | Reason |
|---------------|----------|--------|
| Dashboard | **Replaced by Home** | The Dashboard was a dumping ground for charts. Home focuses on one thing: balances. |
| Budgets | **Replaced by Goals** | Budgets are rigid and accounting-oriented. Goals are motivational and human. |
| AddTransaction (page) | **Replaced by FAB + Modal** | Adding a transaction should not require navigation. It should be accessible from anywhere. |
| Settings (placeholder) | **Merged into More** | Not a primary navigation destination. |
| Profile (placeholder) | **Merged into More** | Not a primary navigation destination. |

## 5. Screens Added

| New Screen | Why It Exists |
|-----------|--------------|
| **Bills** | One of the top-3 financial questions is "What bills are due?" Every adult asks this. It was missing entirely. |
| **Merchants** | People ask "How much have I spent at Walmart?" repeatedly. A dedicated merchant view answers this instantly. |
| **Goals** | People save for things (vacation, emergency fund, new laptop), not abstract category limits. Goals replace budgets. |
| **Reports** | Periodic reviews help people understand patterns. Annual, quarterly, monthly views. |

## 6. What Stays

| Feature | Why It Stays |
|---------|-------------|
| Natural language input | "coffee 4.50" is the fastest way to record a transaction. Keep as primary input method. |
| Merchant extraction | Parsing merchants from descriptions is critical for the Merchants screen. |
| Category breakdown | Still useful as a secondary view. Move to Categories screen. |
| Search | Essential. Move to Activity screen as primary action. |
| Receipt scan (Tesseract) | Kept but demoted. It's a secondary input path for complex receipts. |
| JWT auth | Works fine. No change needed. |
| Zustand + slices | Good architecture. Extend to new domains. |
| Radix + CSS Modules | Clean separation. Keep. |

## 7. Feature Audit — Identify & Remove

### Remove

| Feature | Why Remove |
|---------|-----------|
| **Admin role** (`is_admin` field) | This is a personal finance app. Admin/multi-tenant roles add complexity for zero user benefit. Unless a household mode is planned, remove it. |
| **OCR as primary input** | Receipt scanning via Tesseract is slow, error-prone, and battery-intensive. Keep it as an advanced option, not a primary feature. The main Add screen should default to NL text. |
| **Pie chart on Home** | Pie charts are beautiful but useless for decision-making. Move category breakdown to the Categories tab where it belongs. |
| **Budget warnings** | The concept of "over budget" is replaced by "how are you tracking toward your goal?" which is more helpful and less stressful. |

### Keep but Change

| Feature | Current State | New State |
|---------|-------------|-----------|
| Quick-add endpoint | Separate from create | Unified: parse happens client-side, single create call |
| Dashboard summary API | Returns flat income/expense/net | Returns accounts list + balances + upcoming bills + recent activity |
| Categories | Flat list | Hierarchical (Food → Groceries, Food → Dining Out) |
| Transaction type | income/expense only | Add: transfer (between accounts) |

## 8. Key UX Changes

1. **Search is always visible.** On every screen, there is a search entry point. Search is not a filter buried in a page.

2. **Add is always one tap.** FAB on mobile. Cmd+K or a "+" button on desktop. Never more than one action to start recording.

3. **Dates are human.** "Today", "Yesterday", "Monday" instead of "2026-06-28". Relative dates everywhere.

4. **Merchants are auto-created.** Every transaction description is parsed for a merchant name. No manual merchant setup.

5. **Accounts before categories.** The first screen shows money by account (checking, savings, credit cards). Categories come later.

6. **No empty states that require setup.** The app should be useful from the first transaction. No "create your first category" prompts.

## 9. Success Metrics

| Metric | Target |
|--------|--------|
| Time to record a transaction | <5 seconds |
| Time to check balance (open app) | <3 seconds |
| Time to find a past transaction | <10 seconds |
| Daily active usage | User opens app at least once per day |
