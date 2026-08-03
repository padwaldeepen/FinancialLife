# My Financial Life — Plan

> Last updated: 2026-07-29
> Localhost-only, privacy-first personal finance app. One primary user (admin), family later.
> Countries: USA, India, Canada → **country profiles**: one login per person, 1–3 sealed
> single-currency country worlds (USD/INR/CAD), switch at login or top bar. Profiles are
> never merged — no conversion, no exchange rates, anywhere.
>
> **The one-line goal:** open the app and immediately know — where my money goes
> (monthly/annually), which bills recur, what's coming next, and what I should do about it.

---

## Honest Current State (July 2026)

> **Progress note (2026-07-29):** the "Not good enough" table below is the state that
> *motivated* this plan (early July). Most of it is now resolved — Phases T, D, U, I are
> **done**, and Phase S is **S1–S4 done** (upload, tiered extraction, single-receipt review,
> statement mode with dedup). Remaining: S6 (mobile camera), S7 (messy quick-add polish), then
> the two "Next direction" initiatives, then Phase A. Kept below for history; see the roadmap
> and `backlog.md` for what's actually done.

The app today is a **working expense tracker with a real intelligence layer** (recurring
detection, trends, forecast, safe-to-spend, advice) and document understanding (scan/upload →
review → save, with duplicate protection).

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
3. **Private by default, cloud by choice, free by default.** Rules/statistics first — most
   intelligence needs no AI at all. Gemini (free tier) is the **single, optional** cloud
   provider: per-user opt-in with explicit warning, off by default. **Decided 2026-07-29:**
   a local-LLM tier (Ollama) is **dropped as a priority** — not needed, since the goal is
   overwhelmingly rule-based; revisit only if "nothing ever leaves the machine" becomes a
   hard requirement. **DeepSeek / other paid or non-US AI providers are rejected** (cost +
   data-residency/privacy for financial data). A **paid Gemini tier** is a possible *future*
   option — but only if it proves clearly worth it (revisit then); free tier is the default now.
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

**Decision: rebuild, don't restyle.** The current 8-sections-×-2-trees IA is
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

- [x] Design tokens + `theme.tsx` encode the 3-color system; every off-palette color deleted
  — done 2026-07-17 (backlog U1). `design-tokens.css` now only aliases Radix tokens; every
  raw hex/rgb/hsl color and every `box-shadow` deleted project-wide across `.module.css`
  files (flat bordered cards, no shadows); `--bg-deep`/`--bg-panel` undefined-var bug fixed
  by deleting the dead dark-mode overrides they lived in (Radix tokens already resolve
  per-theme). Verified via `tsc`/`lint`/`build` + Playwright screenshots (desktop & mobile,
  light & dark). Full writeup in `backlog.md` U1.
- [x] **Desktop (5 pages)**: Home · Activity · Recurring (bills + subscriptions + budgets) · Insights (absorbs Reports + category analytics) · Manage (absorbs Settings, Categories, Merchants, Goals CRUD)
  — done 2026-07-18 (backlog U3–U7). All five pages live at their final routes with the
  old table-shaped pages retired/redirected. Full writeups per page in `backlog.md`.
- [x] **Mobile (3 tabs + capture)**: Home · Activity · Capture; settings behind avatar; Categories/Merchants/Reports/Goals/More pages deleted
  — done 2026-07-18 (backlog U8). Bills also retired (not explicitly named in the
  ticket text but covered by the same "nothing else" goal — its only remaining
  purpose, the Upcoming Bills preview, already lives on Home). Full writeup in
  `backlog.md` U8.
- [x] **Folder cleanup**: consolidate `src/auth`, `src/hooks`, `src/utils` into `shared/` (target structure in `architecture-and-goals.md`) — rule: `desktop/`/`mobile/` hold only `.tsx` + `.module.css`
  — done 2026-07-18 (backlog U9). Full writeup in `backlog.md` U9.
- [x] **State cleanup** — done 2026-07-22. Silent `catch {}` blocks in `merchantsSlice.fetchMerchantDetail`, `billsSlice.fetchUpcomingBills`/`fetchBillHistory` now toast on failure; `updateNotes` rollback was already correct (verified, no bug present — the plan note predated a fix already landed). `isFresh` staleness gating (already present in `accounts`/`transactions`/`bills.upcoming`) extended to `goals`, `categories`, `budgets`, `merchants`, `recurringInsights`, `safeToSpend`, `advice` — each gets a `lastFetchedAt` field and an `opts?: { force?: boolean }` param; `reportsSlice.fetchReports` deliberately left as-is per its existing "Home depends on this exact signature" comment. Mobile Home's pull-to-refresh updated to pass `{ force: true }` to `fetchSafeToSpend` so the explicit refresh still bypasses the cache. Filter lists (`useTransactionFilters`) and shared types were already sourced from the slices, not duplicated — verified, no change needed. `tsc`/`eslint` clean; verified live via Playwright (staleness skip renders cached data instantly on a repeat visit within 30s, no stuck loading state).
- [x] Fixed by construction — verified 2026-07-22, no work needed: dark-mode CSS vars (`--bg-deep`/`--bg-panel`, already deleted in U1), duplicate FAB (mobile has exactly one `CaptureSheet` mount in `MobileLayout`), `window.confirm()` (zero occurrences in the codebase), credit-card balances summed into "Total Balance" (`useHomeData.ts` already splits `cashOnHand`/`creditOwed`, no "Total Balance" concept exists) — all four were already resolved by earlier work, most documented inline where they were fixed.

### Phase I — Intelligence (~3–5 weeks) ← **the point of the project** — **DONE 2026-07-22 (backlog I1–I6)**

All rule-based, no AI required, test-first (pure functions over transaction lists).

- [x] **Recurring detection** (I1): group by merchant → amount consistency (exact for subscriptions, ±20% for utilities) + interval consistency (~7/14/30/90/365 days) → 3+ hits = recurring; predicts next date & amount. Plus detected-subscriptions section with dismiss (I2).
- [x] **Spending reports** (I3): monthly + annual breakdowns by category/merchant, month-over-month and year-over-year trends, anomaly flags ("food up 40% this month") — honesty-gated (no claim without enough history)
- [x] **Cash-flow forecast** (I4): day-by-day 90-day balance simulation (paydays + recurring bills + avg daily discretionary); crunch-point warnings; ≥60-day-history gate
- [x] **Safe-to-spend** (I5): balance minus everything spoken-for before next payday — the hero number on both Home screens
- [x] Insight/advice cards on Home (I6, top 3–5): rule-generated, evidence-backed, dismiss-by-type, optional Gemini *phrasing* only; honest "not enough data yet" states

### Phase S — Document Understanding (~3–4 weeks)

Upload or scan a bill / receipt / credit-card statement / bank document → app understands and updates itself. **Never auto-commits: extract → review screen → dedup check → save.**

- [x] Upload (desktop) into the `documents` table (S1) — **done**; camera scan (mobile) = **S6, next**
- [x] Extraction tiers (S2) — **done, Gemini-only**: **B** Gemini vision (only when the T5 toggle is on) → **C** local, always-on (pdfplumber text-layer for digital PDFs, Tesseract OCR for photos) + rules. **Tier A (Ollama) dropped** per the AI decision above — not built, not needed.
- [x] Understanding (S2): merchant matched via D5, category auto-inferred from merchant history → keyword rules → Gemini hint; date, amount, confidence. Single-receipt review screen (S3) with dedup + paperclip back to source.
- [x] Statement mode: credit-card/bank PDF → _list_ of transactions, each run through dedup — **done 2026-07-29 (backlog S4)**
  - **Design decided 2026-07-23** (web research on statement parsing — pdfplumber table
    extraction vs. LLM: consensus is a *hybrid*, deterministic where the layout is clean +
    LLM for format variety, since every bank lays statements out differently and
    regex-per-bank doesn't scale). Maps onto S2's existing two tiers: **tier C** =
    pdfplumber table extraction + per-row regex (date/description/amount), always on, zero
    cloud, works on digital statement PDFs; **tier B** = Gemini statement extraction
    (`extract_statement`, mirrors `extract_receipt`) only when the T5 toggle is on — this
    is where the endless bank-layout variety is actually handled. No Ollama needed (same
    reasoning as S2). The **D3 dedup gate already solves the hard part** (statement rows
    overlap heavily with already-entered transactions): every row runs through
    `find_duplicates`, exact dupes default-unchecked, fuzzy flagged — the "3 known + 2 new
    → exactly 2 inserted" test. Review UI is a multi-row table (per-row include checkbox,
    editable category, dedup badge), distinct from S3's single-receipt dialog. See
    `docs/backlog.md` S4 for the full build log.
- [x] **Dedup gate on every import** (D3 + S3/S4): exact `import_hash` match = auto-skip; fuzzy match = "possible duplicate" review UI with merge/skip/keep-both — **done**
- [x] Document attached to resulting transaction(s) — tap any transaction to see its source (paperclip, S3) — **done**
- [x] **S6 — Mobile scan capture** — **done 2026-07-29** (backlog S6): mobile Capture "Scan" card → camera (`capture="environment"`, gallery fallback over LAN HTTP) → existing S1–S3 pipeline → mobile review sheet (auto-category, dedup) → save; pending-receipts banner on Activity so interrupted scans aren't orphaned. Verified live at 390×844.
- [x] **S7 — Messy quick-add fallback** (Gemini-only) — **done 2026-07-29** (backlog S7): audit found the pipeline was Gemini-*first* when the toggle was on (sent everything to cloud); **fixed to rules-first**, Gemini fallback only when rules can't find the amount + toggle on — so common inputs never leave the machine even with the toggle on. Verified via curl + log inspection (zero outbound calls when expected). **No Ollama.**

### Next direction — decided 2026-07-29 (after Phase S completion)

Reassessed against the owner's real goal: one financial life across USA/India (Canada later),
ingest every receipt/bill/statement, a proper dashboard, and genuine guidance ("what's
useless, how to save"). **Remittance** is handled the lightweight way (a category, below) —
the heavy linked-legs+FX version is deferred. Two rule-based initiatives, **no new AI**:

- [x] **1. Multi-country documents** (locale-aware *local* parsing) — **done 2026-07-29** (backlog N1): `profile.country` now flows into `parse_receipt_text`/`parse_statement_text` so Indian/Canadian formats parse **without** the cloud — DD/MM-vs-MM/DD by locale (with auto-swap on impossible dates), ₹/lakh-grouping amounts (`_CURRENCY` + 2-or-3-digit groups), CR/DR credit markers, and India/Canada merchant vocabulary (Zomato/Ola/Airtel/Flipkart/UPI/…) in `_CATEGORY_KEYWORDS`. Fixture + live-per-profile verified; no US regression.
- [x] **2. Deeper advisor + remittance-as-a-category** — **done 2026-07-29** (backlog N2):
  three new rule-based advice cards in `services/insights/advice.py` — **savings-rate coaching**
  (income vs spend; overspending is urgent, below-20% nudges the gap, healthy gets a positive
  note; no card when income is 0), **fee/interest leakage** (the honest, detectable "useless
  spend" — trailing-90-day fees/interest; deliberately not guessing "unused subscriptions"),
  and **remittance** (money sent home this month). Budget/goal guidance already existed
  (`budget_drift`/`goal_pacing`). **Remittance-as-a-category** shipped: new "Money Sent Home"
  system category + provider keywords (Wise/Remitly/Xoom/Western Union/MoneyGram/…) that
  **auto-tag from statements**; the advisor sums it. Sealed-profile model intact (just a
  US-profile expense, no conversion). Fixture + live + desktop-Playwright verified.

### Phase A — Admin Panel — **DONE 2026-07-29 (backlog A1–A2)**

Desktop-only, `is_admin` gated (column already exists).
**Isolation rule: every user has their own separate dashboard and data.** All queries are
scoped by `user_id` (already true in the schema); admin manages the _system_, never sees
another user's transactions, insights, or dashboard.

- [x] User management (create/deactivate family users) — `routers/admin.py` + Manage "Admin" tab (A1/A2); self- and last-admin deactivation guards; created users get a profile + base accounts and log in to a fresh empty dashboard
- [x] System data: manage system categories — global `is_system` CRUD (create/rename/recolor/delete)
- [x] Data tools: backup-now trigger (runs `scripts/backup.ps1` if present, else honest "not configured"); per-user export stays self-scoped on `/api/export` (admin never reads another user's rows). **Dedup audit log not built** — no dedup-event store exists yet; omitted rather than faked
- [x] Job visibility: pending-documents count + aggregate system counts (users/transactions); last-backup shown once backups are configured
- **Isolation verified:** non-admin → 403 on every admin route; the only `FROM transactions` in the admin router is an aggregate `COUNT(*)` — no admin route returns another user's ledger

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
