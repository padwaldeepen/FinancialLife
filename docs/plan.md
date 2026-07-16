# My Financial Life — Plan

> Last updated: 2026-07-16
> Localhost-only, privacy-first personal finance app. One primary user (admin), family later.
> Countries: USA, India, Canada → in practice: USD, INR, CAD with USD as base currency.
>
> **The one-line goal:** open the app and immediately know — where my money goes
> (monthly/annually), which bills recur, what's coming next, and what I should do about it.

---

## Honest Current State (July 2026)

The app today is a **working expense tracker** with a lot of surface area and some real gaps.

### Working
- Natural-language quick-add, full transaction CRUD, search/filter, CSV import/export
- Accounts, categories (hierarchy), merchants (merge/dedup), bills (auto-link), goals, budgets
- Monthly reports with charts, receipt OCR (Tesseract.js), optional AI chat
- Data-integrity fixes are applied: money columns are `Numeric(12,2)`, FKs on
  `bill_id`/`goal_id`, `SECRET_KEY` required, `/parse` requires auth

### Not good enough (why this plan exists)
| Problem | Reality |
|---|---|
| **No intelligence** | Zero lines of insight/recommendation/forecast code — the actual point of the app |
| **UI is inconsistent** | Mixed colors, misaligned containers, weak UX flow on both desktop and mobile |
| **No tests** | A finance app with untested money math cannot be trusted over Excel |
| **No backups** | All data in one Docker volume on one disk — riskier than Excel in OneDrive |
| **Single currency** | No INR/CAD, no exchange rates |
| **No provenance / dedup** | A transaction from a scanned bill + the same one from a bank CSV would double-count |
| **Privacy contradiction** | Chat/parse can send data to NVIDIA/Gemini/Groq free tiers — not privacy-first |
| **Doc rot** | Docs described bugs as open that were already fixed (now archived to `docs/archive/`) |
| **Duplicated frontend logic** | Desktop and mobile `Activity.tsx` are ~1,100 lines each, near-copies |

---

## Principles

1. **Trustworthy numbers first.** Tests on money paths before new features; backups before the first real transaction goes in.
2. **Rule-based intelligence first.** Statistics before AI; AI (local-first) only where rules can't reach.
3. **Privacy-first means local-first AI.** Ollama for document understanding; cloud APIs opt-in only.
4. **Three-color minimalist UI.** One neutral scale, one accent, semantic money colors — nothing else. See `design-system.md`.
5. **Device roles differ.** Mobile = capture (scan, quick-add, glance). Desktop = analyze + manage (reports, admin, bulk edit). Feature set is deliberately bigger on desktop.
6. **Every phase ends with the app answering a money question it couldn't answer before.**
7. **Docs stay honest.** `plan.md` (this file) + `backlog.md` (detailed tickets) + `architecture-and-goals.md` + `design-system.md` + `DEVELOPMENT.md` + `how-it-works.md` (plain-language guide) are the only living docs. Everything else goes to `docs/archive/`.

### Explicitly OUT of scope
- ❌ Email/SMS ingestion (bank CSV + document scan covers it)
- ❌ Tax filing or tax documents (handled outside the app)
- ❌ Bank API sync (Plaid etc. — costs money, breaks privacy)
- ❌ Cloud deployment, CI/CD, multi-region anything
- ❌ Paid APIs of any kind

---

## Roadmap

> **Execution detail lives in [`backlog.md`](backlog.md)** — every checkbox below is
> broken into Jira-style tickets there (scope, build steps, acceptance criteria, files,
> dependencies). Coding tools work from the backlog, one ticket at a time, in order —
> never from this summary alone.

### Phase T — Trust & Cleanup ← **do first, ~1 week**
Make the foundation safe before building on it.
- [ ] **Tests on money paths**: pytest for NL parser, report aggregation, bill matching; keep in `backend/tests/`
- [ ] **Dead/deprecated audit**: `npm outdated` + unused-dependency check; delete unused code, components, and endpoints found along the way
- [ ] **Delete `ResponseCacheMiddleware`** — it caches `/api/accounts/` (with balances) for 60s and transaction mutations never invalidate it → stale balances after adding a transaction; pointless at localhost scale
- [ ] **Replace unmaintained auth libs**: `python-jose` → `PyJWT`, `passlib` → direct `bcrypt` (passlib is abandoned; it's why bcrypt is pinned to 4.0.1)
- [ ] **Setup verification**: clean-clone → `docker compose up` → app works; fix anything that breaks; record exact steps in `DEVELOPMENT.md`
- [ ] **Privacy fix**: cloud AI (NVIDIA/Gemini/Groq) OFF by default, behind an explicit settings toggle with a "data leaves this machine" warning
- [x] Docs consolidated, stale reports archived

### Phase D — Data Model v2 (~1 week)
Schema changes are cheapest now, before intelligence and scanning are built on top.
**Decision: no real data exists yet, so implement v2 directly in the models and squash
Alembic to one clean initial migration** — no legacy upgrade path to maintain. (From the
day real data goes in, every change gets a proper incremental migration again.)
Full schema in `architecture-and-goals.md`. Summary:
- [ ] `currency` (USD/INR/CAD) on Transaction; `base_currency` on User
- [ ] `exchange_rates` table, fed by Frankfurter (free, keyless, ECB rates), cached locally — one fetch per day max
- [ ] `source` on Transaction: `manual | quick_add | csv_import | document_scan`
- [ ] `documents` table (uploaded/scanned files) + `transaction.document_id` provenance link
- [ ] **Dedup support**: `import_hash` on Transaction + fuzzy-match lookup (same amount, date ±3 days, similar merchant) used by every import path
- [ ] Alembic migration per change; reports converted to base-currency aware

### Phase U — UI Rebuild: 5 pages, 3 colors (~3–4 weeks)
**Decision: rebuild, don't restyle.** The current 8-sections-×-2-trees IA is
table-shaped (one page per DB table = Excel thinking). Keep the shell (auth flow,
routing, axios interceptor, store infrastructure, theme); build the question-shaped
page map from `design-system.md` §3 fresh; delete retired pages as they're absorbed.
- [ ] Design tokens + `theme.tsx` encode the 3-color system; every off-palette color deleted
- [ ] **Desktop (5 pages)**: Home · Activity · Recurring (bills + subscriptions + budgets) · Insights (absorbs Reports + category analytics) · Manage (absorbs Settings, Categories, Merchants, Goals CRUD)
- [ ] **Mobile (3 tabs + capture)**: Home · Activity · Capture; settings behind avatar; Categories/Merchants/Reports/Goals/More pages deleted
- [ ] **Folder cleanup**: consolidate `src/auth`, `src/hooks`, `src/utils` into `shared/` (target structure in `architecture-and-goals.md`) — rule: `desktop/`/`mobile/` hold only `.tsx` + `.module.css`
- [ ] **State cleanup** (while pages are rebuilt): surface slice errors to the UI — no more silent `catch {}`; real rollback on failed updates (`updateNotes` claims to revert and doesn't); staleness check in `namespaceSlice` (skip refetch when < 30s fresh — kills the loading flash on every navigation); one source of truth for filter lists; shared types imported from slices, no local copies
- [ ] Fixed by construction: dark-mode CSS vars, duplicate FAB, `window.confirm()`, credit-card balances summed into "Total Balance"

### Phase I — Intelligence (~3–5 weeks) ← **the point of the project**
All rule-based, no AI required, test-first (pure functions over transaction lists).
- [ ] **Recurring detection**: group by merchant → amount consistency (exact for subscriptions, ±20% for utilities) + interval consistency (~7/14/30/90/365 days) → 3+ hits = recurring; predicts next date & amount
- [ ] **Spending reports**: monthly + annual breakdowns by category/merchant, month-over-month and year-over-year trends, anomaly flags ("food up 40% this month")
- [ ] **Cash-flow forecast**: day-by-day 60–90 day balance simulation (paydays + recurring bills + avg daily discretionary); crunch-point warnings
- [ ] **Safe-to-spend**: balance minus everything spoken-for before next payday — the number on the home screen
- [ ] Insight cards on Home (top 3–5), honest "not enough data yet" states

### Phase S — Document Understanding (~3–4 weeks)
Upload or scan a bill / receipt / credit-card statement / bank document → app understands and updates itself. **Never auto-commits: extract → review screen → dedup check → save.**
- [ ] Upload (desktop) and camera scan (mobile) into the `documents` table
- [ ] Extraction tier 1: local LLM via **Ollama** (vision model, e.g. Qwen-VL class) — private, free
- [ ] Extraction tier 2 fallback: Tesseract OCR + rules (works with zero AI setup)
- [ ] Understanding: "Walmart $30" → merchant = Walmart, category inferred from history + line items (groceries vs alcohol vs travel), date, amount
- [ ] Statement mode: credit-card/bank PDF → *list* of transactions, each run through dedup
- [ ] **Dedup gate on every import**: exact `import_hash` match = auto-skip; fuzzy match = "possible duplicate" review UI with merge/skip/keep-both
- [ ] Document attached to resulting transaction(s) — tap any transaction to see its source

### Phase A — Admin Panel (~1–2 weeks)
Desktop-only, `is_admin` gated (column already exists).
**Isolation rule: every user has their own separate dashboard and data.** All queries are
scoped by `user_id` (already true in the schema); admin manages the *system*, never sees
another user's transactions, insights, or dashboard.
- [ ] User management (create/deactivate family users — groundwork for family use later)
- [ ] System data: manage system categories, merchant normalization rules, recurring-detection overrides
- [ ] AI settings: Ollama endpoint, cloud toggles, per-provider on/off
- [ ] Data tools: backup now, export all, import review queue, dedup audit log
- [ ] Job visibility: last exchange-rate fetch, last backup, scan queue status

### Later (only after the above is real and used daily)
- **Automated backups** — deferred while the app holds only test data, but a **hard gate
  before the first real transaction goes in**: scheduled `pg_dump` (Task Scheduler) to a
  second location + one tested restore (the DB volume is the only part of this project
  with no second copy anywhere — code has git, data has nothing)
- Net-worth via monthly balance snapshots per account (US + India + Canada accounts, base-currency trendline)
- LAN/HTTPS access so the phone PWA + camera scanning works away from the desk (Caddy or Tailscale)
- Family accounts (schema is ready; needs LAN access + auth polish first)
- Country-profile content (financial concepts/terminology per country) layered onto recommendations

---

## Definition of "done properly" (applies to every phase)
1. Works end-to-end via the UI, not just the API — **verified by driving the running app
   with Playwright in BOTH viewports** (the `feature-verify` skill: exercise the exact
   flow on desktop ≥1024px AND mobile 390×844, assert the numbers, screenshot evidence,
   console clean — the trees are separate, one passing proves nothing about the other)
2. Money math covered by tests
3. Lint + format clean (`npm run lint:fix && npm run format:fix` / `ruff check . && ruff format .`)
4. Code reviewed against `rules/code-review.md` before commit
5. Alembic migration for any schema change
6. This file updated: checkbox ticked, surprises noted
