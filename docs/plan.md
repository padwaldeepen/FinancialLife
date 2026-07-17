# My Financial Life — Plan

> Last updated: 2026-07-16
> Localhost-only, privacy-first personal finance app. One primary user (admin), family later.
> Countries: USA, India, Canada → **country profiles**: one login per person, 1–3 sealed
> single-currency country worlds (USD/INR/CAD), switch at login or top bar. Profiles are
> never merged — no conversion, no exchange rates, anywhere.
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

| Problem                       | Reality                                                                             |
| ----------------------------- | ----------------------------------------------------------------------------------- |
| **No intelligence**           | Zero lines of insight/recommendation/forecast code — the actual point of the app    |
| **UI is inconsistent**        | Mixed colors, misaligned containers, weak UX flow on both desktop and mobile        |
| **No tests**                  | A finance app with untested money math cannot be trusted over Excel                 |
| **No backups**                | All data in one Docker volume on one disk — riskier than Excel in OneDrive          |
| **No country concept**        | Everyone forced into USD formatting; no India/Canada profiles                       |
| **No provenance / dedup**     | A transaction from a scanned bill + the same one from a bank CSV would double-count |
| **Privacy contradiction**     | Chat/parse can send data to NVIDIA/Gemini/Groq free tiers — not privacy-first       |
| **Doc rot**                   | Docs described bugs as open that were already fixed (stale docs since deleted)      |
| **Duplicated frontend logic** | Desktop and mobile `Activity.tsx` are ~1,100 lines each, near-copies                |

---

## Principles

1. **Trustworthy numbers first.** Tests on money paths before new features; backups before the first real transaction goes in.
2. **Rule-based intelligence first.** Statistics before AI; AI (local-first) only where rules can't reach.
3. **Private by default, cloud by choice, free always.** Rules/Ollama first; Gemini free tier is the single cloud provider, per-user opt-in with explicit warning, off by default. Never a paid API.
4. **Three-color minimalist UI.** One neutral scale, one accent, semantic money colors — nothing else. See `design-system.md`.
5. **Device roles differ.** Mobile = capture (scan, quick-add, glance). Desktop = analyze + manage (reports, admin, bulk edit). Feature set is deliberately bigger on desktop.
6. **Every phase ends with the app answering a money question it couldn't answer before.**
7. **Docs stay honest.** `plan.md` (this file) + `backlog.md` (detailed tickets) + `architecture-and-goals.md` + `design-system.md` + `DEVELOPMENT.md` + `how-it-works.md` (plain-language guide) are the only docs. Anything stale gets deleted — git history is the archive.

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

- [x] **T1 Parser contract** (done 2026-07-17): relative dates ("yesterday", "last friday", "on the 1st", "N days ago", month+day), Decimal amounts, `missing: ["amount"]` contract, dates wired into parse/quick-add. **Decision: no pytest files — all verification via Playwright MCP against the running app** (owner's call; supersedes the original "pytest" wording)
- [x] **T2 Deleted `ResponseCacheMiddleware`** (done 2026-07-17): stale-balance cache gone; balances update instantly after adding a transaction (verified)
- [x] **T3 Auth libs replaced** (done 2026-07-17): PyJWT 2.10 + bcrypt 5.0; python-jose/passlib uninstalled; register→login→authed flows verified in the real app
- [x] **T5 Cloud AI opt-in** (done 2026-07-17): per-user `ai_cloud_enabled` (migration c2d3e4f5a6b7), single provider layer, **NVIDIA + Groq deleted — Gemini only** (chat converted too); Settings toggle with warning on desktop + mobile; verified both directions (on → `ai_provider: gemini`; off → rules only, zero cloud calls)
- [x] **T4 Dead-code pass — complete** (done 2026-07-17): `core/cache.py` deleted (zero
      importers), README TanStack Query lie fixed, jose/passlib/NVIDIA/Groq config removed.
      Depcheck sweep: `@nivo/core` was an unused direct dependency (Nivo's chart packages
      pull it in transitively) — removed, build re-verified clean. `ruff check .` on backend:
      zero issues. `pip list --outdated`: only patch/minor bumps available (alembic, asyncpg,
      fastapi, PyJWT, uvicorn) — noted, not chased; no urgent/major versions pending
- [x] **T6 Setup verification — complete** (done 2026-07-17): full `DEVELOPMENT.md` §1
      checklist run against the running app via Playwright MCP — register→login, quick-add
      (`coffee 4.50` → parsed correctly, saved, appears in Activity), bill create, bill
      linking, Reports charts, CSV export (file downloaded and its contents verified byte-for-byte
      correct). **Two real bugs found and fixed along the way** (exactly what this ticket
      exists to catch):
  1. 🔴 `GET /api/bills/{id}/history` **500 error** — `func.date_trunc("month", ...)`
     called separately in `select()`/`group_by()`/`order_by()` created three distinct
     bind parameters; Postgres rejected the query as an invalid GROUP BY (`"transactions.date"
must appear in the GROUP BY clause"`) even though the SQL was textually identical
     across clauses. Fixed by building the expression once and reusing the same object
     (`backend/services/bill_service.py`) — the standard SQLAlchemy fix for this class of bug.
  2. 🔴 **Bill→transaction linking silently broken from a cold start** — `BillDetail.tsx`
     (both desktop and mobile) read the "link transaction" candidate list from the shared
     `transactions` Zustand slice but never fetched it themselves; the list only had data
     if the user happened to visit Activity/Home first in the same session. A user going
     straight to Bills → Link Transaction after login saw "No unlinked transactions found"
     even with matching transactions in the database. Fixed: both `BillDetail.tsx` files
     now fetch transactions when the link dialog opens if not already loaded.
  - **Known, deliberately deferred to Phase U** (not a T6 blocker — cosmetic staleness,
    not incorrect data): after quick-add saves from the dashboard modal, Home's balance/
    recent-activity don't refresh until the next navigation — the underlying transaction
    _is_ saved correctly (verified via Activity), Home's slices just aren't force-refreshed
    on modal-close. `docs/backlog.md` U3/U4 need an explicit "force refresh on mutation
    from elsewhere" step, not just the 30s staleness skip currently scoped there.
- [x] Docs consolidated, stale reports deleted
- [x] **Bonus fix**: `formatCurrency` used `Math.abs()` — negative balances displayed as positive money; fixed and verified (−$16.50 renders correctly)
- [x] **State-ownership fix** (done 2026-07-17, caught by the project owner reviewing the
      T5 diff): the AI cloud toggle was built as local `useState` + its own `useEffect` fetch,
      duplicated in both desktop and mobile Settings — violates "Zustand for shared/server
      state" (`rules/zustand.md`, which now documents the ownership test explicitly). Moved
      into `authSlice`: `login`/`register`/`verifyToken` now hydrate the full user profile via
      a new `fetchCurrentUser` action (`GET /api/auth/me`) so `auth.user` carries
      `full_name`/`username`/`ai_cloud_enabled` everywhere instead of the slim token-response
      fields; `updateAiCloudEnabled` action added with optimistic update + revert. **Found and
      fixed a real bug while doing this**: called a sibling action via `get().fetchCurrentUser()`,
      which is `undefined` inside `namespaceSlice` (get() only exposes state, not actions) —
      broke the post-login promise chain silently (login succeeded but never navigated).
      Fixed by closing over `set` directly; re-verified login/toggle end-to-end on both
      viewports after the fix (`rules/zustand.md` now documents this trap for future work)

### Phase D — Data Model v2 (~1 week)

Schema changes are cheapest now, before intelligence and scanning are built on top.
**Decision: no real data exists yet, so implement v2 directly in the models and squash
Alembic to one clean initial migration** — no legacy upgrade path to maintain. (From the
day real data goes in, every change gets a proper incremental migration again.)
**Decision made mid-phase: no ORM anywhere — raw SQL via `asyncpg` only.** SQLAlchemy
stays installed solely for Alembic's migration runner, never imported in application
code. Full rationale and the contract for writing queries/migrations: `rules/database.md`.
Full schema in `architecture-and-goals.md`. Summary:

- [x] **D1 — done 2026-07-17**: v2 schema in one squashed initial migration (raw SQL,
      no ORM) — the **country-profile model**: `profiles` table (1–3 per user, country →
      currency, sealed, never merged); every financial table re-keyed to `profile_id`;
      registration = country picker → first profile + default account; "Add country" for a
      second profile; `source`/`import_hash`/`document_id` on Transaction; `documents`
      table; users = auth only + first-user-becomes-admin. No currency columns below
      profiles, no exchange rates, no conversion — a profile is one currency by
      construction. Frontend: `X-Profile-Id` header, profile-aware `formatCurrency`
      (₹1,00,000 lakh grouping verified live). Verified end-to-end via Playwright + curl
      (both viewports): registration, currency formatting, and — critically — cross-profile
      access returns 404 even with a valid token from a different user.
- [x] **D3 — done 2026-07-17**: Dedup service (`services/ingest/dedup.py`): `import_hash` exact match + fuzzy (same amount, date ±3 days, Jaccard similarity ≥0.5 on merchant/description) — one gate for every import path, per profile. Verified against the live DB: exact/fuzzy/none all correct, 1.3ms avg on a 10k-row fixture. Not wired to any router yet — U4 and S3/S4 do that.
- [x] **D5 — done 2026-07-17**: Typo-tolerant merchant matching (Levenshtein, per profile) — "wallmart"→Walmart, no duplicate merchants. Wired into quick-add/CSV import/document-scan's shared `find_or_create_merchant`, plus the `/parse` preview now shows the corrected name before save. Verified live: DB-level match tests + real UI test on both viewports (typed "walmart", preview showed the existing near-typo "Walmar" record, not a new one).

### Phase U — UI Rebuild: 5 pages, 3 colors (~3–4 weeks)

**Decision: rebuild, restyle.** The current 8-sections-×-2-trees IA is
table-shaped (one page per DB table = Excel thinking). Keep the shell (auth flow,
routing, axios interceptor, store infrastructure, theme); build the question-shaped
page map from `design-system.md` §3 fresh; delete retired pages as they're absorbed.
**Grounded in 2026 fintech UI/UX research** (`design-system.md` §0 — sources in §6):
neutral+accent+semantic color structure, elevated-neutral (never pure white/black)
backgrounds, flat/shadowless cards, bottom-nav-for-3-5-destinations (validates the
3-tab mobile structure exactly), and two new rules the research surfaced — **calm
motion** (functional only, no decorative/celebratory animation) and **transparent AI**
(every insight card shows its evidence + a dismiss, cloud-generated text visually
marked). The "70% of users abandon apps over complex navigation" finding is the
standing justification for replacing the old 8-page table-shaped IA.

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
- [ ] Extraction tiers: **A** Ollama vision (local, private) → **B** Gemini vision (only when the user's T5 toggle is on) → **C** Tesseract + rules (zero AI setup, never silently to cloud)
- [ ] Understanding: "Walmart $30" → merchant = Walmart, category inferred from history + line items (groceries vs alcohol vs travel), date, amount
- [ ] Statement mode: credit-card/bank PDF → _list_ of transactions, each run through dedup
- [ ] **Dedup gate on every import**: exact `import_hash` match = auto-skip; fuzzy match = "possible duplicate" review UI with merge/skip/keep-both
- [ ] Document attached to resulting transaction(s) — tap any transaction to see its source
- [ ] Typed-input AI fallback (S7): messy phrasing/typos parsed by Ollama (or Gemini if opted in) when the rules parser can't — preview + one-question rule unchanged

### Phase A — Admin Panel (~1–2 weeks)

Desktop-only, `is_admin` gated (column already exists).
**Isolation rule: every user has their own separate dashboard and data.** All queries are
scoped by `user_id` (already true in the schema); admin manages the _system_, never sees
another user's transactions, insights, or dashboard.

- [ ] User management (create/deactivate family users — groundwork for family use later)
- [ ] System data: manage system categories
- [ ] Data tools: per-user export-all, backup-now trigger, dedup audit log
- [ ] Job visibility: last backup, pending documents count

### Later (only after the above is real and used daily)

- **Automated backups** — deferred while the app holds only test data, but a **hard gate
  before the first real transaction goes in**: scheduled `pg_dump` (Task Scheduler) to a
  second location + one tested restore (the DB volume is the only part of this project
  with no second copy anywhere — code has git, data has nothing)
- Net-worth via monthly balance snapshots per account — **per profile** (a US trendline, an India trendline; never combined)
- LAN/HTTPS access so the phone PWA + camera scanning works away from the desk (Caddy or Tailscale)
- Family accounts (schema is ready; needs LAN access + auth polish first)
- Country-profile content (financial concepts/terminology per country) layered onto recommendations

---

## What each phase unlocks (localhost, desktop + mobile)

| After phase | On desktop you can…                                                                                                  | On your phone (same WiFi) you can…                                                  |
| ----------- | -------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| **T**       | trust the numbers (tested money math, no stale balances), use AI knowing exactly what leaves the machine             | same app as today, just correct                                                     |
| **D**       | register with your country, add a second country profile, see ₹/$/C$ formatted right, import CSVs without duplicates | log in and switch country profiles                                                  |
| **U**       | use the 5 clean pages (Home/Activity/Recurring/Insights/Manage), bulk edit, review imports                           | use the 3-tab app: glance at Home, browse Activity, quick-add via Capture in 2 taps |
| **I**       | see safe-to-spend, forecast curve, detected subscriptions with monthly total, insight cards with advice              | see safe-to-spend + upcoming bills at a glance                                      |
| **S**       | drop a receipt/bill/statement PDF on the app → review → done; every transaction links to its document                | **scan a bill with the camera** (or pick from gallery) → review → saved             |
| **A**       | manage family users, system categories, backups, review the dedup audit                                              | — (admin is desktop-only)                                                           |

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
