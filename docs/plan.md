# My Financial Life — Plan

> Last updated: 2026-08-08
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
   **Re-validated by measurement 2026-08-08 (ZA)** after the owner asked whether to go
   adaptive: the two-tree split is **kept**. `mobile/` is 2,709 LOC to `desktop/`'s 8,107
   across half the pages — a genuinely smaller capture app, not a parallel copy, so a
   wholesale merge would mean forcing 4,572 lines of desktop-only pages down to 390px and
   producing the squeezed-desktop-on-a-phone this principle exists to prevent. Two
   corrections do apply: **tablets get the desktop tree** (the `max-width: 1023px` switch
   was a routing bug that stranded iPad portrait — ZB), and **auth is shared** (Login/
   Register were 248-vs-247 and 349-vs-339 near-identical twins — ZC). `shared/` may hold
   JSX for those two pages only.
6. **Every phase ends with the app answering a money question it couldn't answer before.**
7. **Docs stay honest.** `README.md` (plain-language pitch + setup) + `plan.md` (this file) + `backlog.md` (detailed tickets) + `architecture-and-goals.md` + `design-system.md` + `DEVELOPMENT.md` are the only docs. Anything stale gets deleted — git history is the archive. (`how-it-works.md` was folded into `README.md` 2026-08-05 — its "[coming soon]" tags had all shipped, making it a second, drifting copy of what the README should say.)

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

### Phase R — Review Remediation & Polish (from the 2026-07-30 audit) ← **do R1–R3 before daily use**

Two whole-codebase agent audits before the owner starts using it for real. **Architecture is
strong** (per-profile isolation, Decimal money, clean slices/services); the findings are real but
targeted. Detail + acceptance in [`backlog.md`](backlog.md) R1–R6.

**Ship-ready block (before daily use):**
- [x] **R1 — Correctness fixes:** ChatBot hardcoded account/`$`; `category_spending` broken date
  window; missing `account_id` ownership check on transaction writes. Done 2026-08-05 — also
  caught & fixed a hardcoded `$` in the chat *backend* replies (not just the ChatBot component)
  while verifying live. See backlog.md R1 Result.
- [x] **R2 — Palette & polish sweep:** remove off-spec purple/blue/amber hues + money-colour-on-icons
  + DB category colours as swatches → slate ink + one orange accent (design-system §1); Home
  insights loading Skeleton. *The single highest-impact change for "looks intentional in 2026."*
  Done 2026-08-05 — see backlog.md R2 Result (also caught & fixed a stray amber badge in
  `StatementReviewDialog.tsx` not in the original ticket).
- [x] **R3 — Capture UX:** offer **both** gallery upload and direct camera on every device (drop the
  forced `capture`); document the HTTPS-for-phone-camera constraint honestly. Done 2026-08-05 —
  see backlog.md R3 Result.
- [x] **R7 — Spontaneous-logout investigation** (folded in from a session-scratch note,
  2026-08-06): navigating between pages was randomly kicking logged-in users back to
  `/login` with a valid backend session. Two of three root causes found and fixed,
  verified under ~150 rapid-navigation cycles with zero repeats: (1) the auth rate
  limiter's strict 10/60s bucket covered all of `/api/auth/*`, including `/refresh` and
  `/me` which fire on every page load — tightened to only `/login`/`/register`
  (`backend/core/middleware.py`); the frontend also stopped treating any refresh error
  (429/network/5xx) as a definite logout — only a real 401 clears the session now
  (`isDefiniteAuthFailure()` in `frontend/src/shared/api/authRefresh.ts`, plus
  retry-with-backoff in `authSlice.ts`'s `verifyToken()` and a single-flight refresh to
  stop concurrent callers racing each other). (2) a duplicate bundled `immer` copy meant
  `enableMapSet()` registered on the wrong instance, throwing on every `transactions`
  slice update touching `selectedIds: Set<number>` — fixed via `resolve.dedupe`/
  `optimizeDeps.include` in `frontend/vite.config.ts`. **Still open, not blocking**: a
  third, much rarer client-side-only cause (zero network requests, zero console errors
  around the event) — unreproduced despite the stress testing above; revisit if it
  recurs with more frequency. Also noted, not yet investigated: Manage → Categories can
  show **duplicate categories** (a real "Food & Dining" alongside a same-named
  user-created one with 0 subcategories) — suspected cause is quick-add's category-name
  matching creating a new category instead of matching the existing system one; needs a
  categorizer/matching-logic look.
- [x] **Fresh-start DB wipe** — done 2026-08-08 (owner's call). Backed up first, then
  **consolidated migrations 8 → 5** (X1/Y7/E1's `ALTER TABLE`s folded into the table
  definitions, since with no real data that's where they belong), dropped the volume,
  rebuilt from empty, and smoke-tested register → quick-add → transfer → upload →
  library on the clean DB. See backlog.md W9.

**Code-health block (can run while in use — invisible to the user):**
- [ ] **R4 — Backend DRY:** ~~all Gemini via `GeminiService`~~ done 2026-08-05 (shared
  `call_gemini()`). Remaining: account/category ownership helpers ✅ (landed early, as part of
  R1's write-path fix — see backlog.md), one balance function, shared spent-this-period +
  `ai_cloud_enabled` fetch, parameterize the `_fee_leakage` SQL, share Jaccard.
- [ ] **R5 — Frontend DRY/state:** move the ~50 duplicated quick-add lines into `quickAddModalSlice`
  actions (no API calls in components); move/retire ChatBot.
- [ ] **R6 — Over-engineering & dead code:** ~~drop the single-impl `BaseAIService` ABC, the
  `_row_to_bill_dict` no-op, unused `get_leaf_categories` + dead `ParseResult.date`~~ done
  2026-08-05. Remaining: money request-models `float → Decimal`.

### Phase V — State Management Consolidation & Radix/CSS Debt (recovered plan, 2026-08-05)

A plan drafted mid-session got lost before it was ever turned into a ticket or executed;
recovered and re-verified against live code. Detail + acceptance in
[`backlog.md`](backlog.md) V0–V5.

- [x] **V0 — Node LTS bump:** `node:22.23.1-slim` → `node:24.19.0-slim`. Done — confirmed
  live in `frontend/Dockerfile` 2026-08-06.
- [x] **V1 — Consolidate slice files:** merge each domain's data slice + form/page slice
  (currently separate files) into one file per domain. Done — confirmed live: no
  separate `*FormSlice.ts`/`*PageSlice.ts` files remain, `store/slices/` is one file per
  domain.
- [x] **V2 — Finish useState → Zustand migration:** the 13 originally-listed call sites
  (`BillDetail`, `AccountTab` password form, `ChatBot`, mobile `Activity`/`Home`,
  `AddTransactionModal` both trees) → slice actions — done, confirmed live. **Correction
  2026-08-06**: the initial "zero occurrences" re-check used a grep pattern
  (`useState(`) that misses generic-typed calls like `useState<T>(...)`; a proper
  re-check found 2 the original ticket didn't cover — `PendingReceipts.tsx`'s single
  `useState<PendingDocument | null>` (one flag, fine per the rule's own exception) and
  `BillFormDialog.tsx`'s `useState<BillFormValues>` (a multi-field form object — a real
  gap, not in V2's original scope, noted in `backlog.md`'s Discovered section for a
  future ticket rather than fixed here).
- [ ] **V3 — Toast/CRUD into slice actions:** down to 6 files still calling
  `toast.success`/`toast.error` directly (`StatementReviewDialog`, `DocumentReviewDialog`,
  `DocumentViewerDialog`, `Activity`, `AdminTab`, `AccountTab`) — the other 8 of the
  original 14 are already converted. Shared `getErrorDetail`/`refetchCollection` helpers
  already exist in `store/namespaceSlice.ts`.
- [x] **V4 (skeletons only) — done**: `grep 'className="skeleton"'` across `desktop/`/
  `mobile/` returns zero — all converted to Radix `<Skeleton>`. **Still open**: missing
  `Dialog.Description`/a11y + inconsistent `Dialog.Root` ownership across the 6 dialog
  components; duplicated `.emptyState`/`.sectionHeader`/`.row` CSS classes; stale doc
  references in `rules/frontend.md` and `rules/zustand.md`.
- [x] **V5 — Lint cleanup** — done 2026-08-08. `eslint src` is **0 errors, 0 warnings**.
  The `no-explicit-any` cases in `namespaceSlice.ts` were **attempted and reverted**: an
  `unknown`-based generic cascaded ~30 errors across every slice and added more casting
  than it removed. Left deliberately, with the attempt documented so it isn't repeated.

### Phase W — Pre-merge polish & upload pipeline upgrade (planned 2026-08-06)

Bug batch + upload rework found before merging `feat/premium-ui-redesign` into `main`.
Detail + acceptance in [`backlog.md`](backlog.md) W0–W7.

- [x] **W0 — Dialog button alignment:** right-align `AddTransactionModal`, `BillFormDialog`,
  Goals' Create/Contribution dialogs to match the established `Flex justify="end"` pattern
  used everywhere else. Done 2026-08-06.
- [x] **W1 — Activity tab:** relocate the transaction-count text into the filter bar;
  live-diagnose the reported date-filter/UI issue (nothing structurally broken found
  statically, or live). Done 2026-08-06 — count relocated; date filters checked live,
  nothing broken found (see backlog.md W1 Result).
- [x] **W2 — Add Transaction "bounce" + desktop upload failure:** live-reproduce both
  before patching (no static bug found in either). Done 2026-08-06 — neither reproduced
  live; no code change (see backlog.md W2 Result).
- [x] **W3 — Manage restructure:** fold `AiPrivacyTab` into `AccountTab`, delete the
  standalone tab. Done 2026-08-06.
- [x] **W4 — Category suggestion:** pre-highlight a suggested category (via the existing
  `categorize()`) when editing a transaction in `TransactionDetailDialog`, still fully
  editable. Done 2026-08-06 — **scope-corrected**: the two keyword tables turned out to
  be different granularity by design, not duplicated; kept separate rather than merged
  (see backlog.md W4 Result for why).
- [x] **W5 — Sidebar identity:** show `full_name || username || email` instead of email.
  Done 2026-08-06.
- [x] **W6 — Upload pipeline upgrade:** multi-file upload, auto-detect receipt vs.
  statement (drop the manual picker, keep a one-click re-classify escape hatch), and
  `.xlsx` support via the existing CSV-import pipeline rather than a new extraction path.
  Done 2026-08-06 — used `exceljs` instead of the originally-named `xlsx`/SheetJS
  (unpatched CVEs, see backlog.md W6 Result). All three pieces verified live end-to-end.
- [x] **W7 — Testing/tooling:** delete `frontend/e2e/debug.spec.ts`; add e2e coverage for
  what W0–W6 touch; a whole-codebase unused-CSS-class sweep; document the
  chrome-devtools MCP Lighthouse/perf workflow (no new dependency). Done 2026-08-06 —
  also fixed 8 of 14 pre-existing `auth-flow.spec.ts` tests that were silently failing
  (stale required fields/routes), removed 7 genuinely dead CSS classes, and fixed one
  real accessibility gap (Activity's date-filter inputs) found via the new Lighthouse
  baseline — see backlog.md W7 Result.

**Phase W complete** — all of W0–W7 done and verified live 2026-08-06.

### Phase X — Bulk ingestion & the document library (planned 2026-08-08)

From a QA pass driving the live app as the daily-use owner. Phase W made upload
multi-file; Phase X makes it work at the owner's real scale (point at a folder of years
of statements and receipts) and closes the honesty gap that **once a document is
reviewed there is currently no way to ever see it again** — `GET /api/documents/` only
returns `status='pending'`, and `documents` doesn't even store the original filename.
Detail + acceptance in [`backlog.md`](backlog.md) X1–X4.

- [x] **X1 — Document library:** `original_filename` + `content_sha256` columns; list
  endpoint gains `status`/`kind`/search/date filters (default stays pending-only so
  existing callers don't change); a **Documents** tab under Manage showing everything
  ever uploaded, linked to the transaction it became. Done 2026-08-08 — also added
  `linked_transaction_count` (a statement import yields many transactions from one
  document, so a lone id would misrepresent it), and verified the filename is stored
  display-only: `../../../etc/passwd.png` lands as `passwd.png` with the on-disk path
  still the generated uuid. See backlog.md X1 Result.
- [x] **X2 — Folder upload with real progress** (done 2026-08-08): `webkitdirectory` + recursive
  `webkitGetAsEntry()` folder walk; a **triage summary shown before upload starts**
  (receipts/statements · spreadsheets · other · skipped-with-reason); genuine
  `onUploadProgress` bars, 3–5 concurrent uploads instead of the current sequential loop,
  per-file retry/remove; a **stage indicator** (`queued → uploading → extracting → needs
  review → saved`) and a persistent "38 uploaded · 12 still need review" summary, because
  a batch isn't done when bytes land — it's done when the review queue is empty; content
  hashing so re-dropping the same folder is a safe no-op.
- [x] **X3 — Honest unparseable-file handling** (done 2026-08-08): new `kind='other'` — store, list, and
  label files the app can't parse instead of showing a red "Failed" that reads like a bug.
  **Tax documents stay out of scope** (owner's call 2026-08-08): a W-2/1099/Form 16/T4 is
  just an `other` document — stored, never parsed, no tax-specific detection or fields.
- [x] **X4 — Review queue at scale** (done 2026-08-08): paginate/virtualize; bulk approve-as-extracted for
  high-confidence rows (still through the D3 dedup gate); sort by confidence so documents
  needing a human decision surface first.

### Phase Y — Gap closure (promoted to tickets 2026-08-08, owner's call)

The QA pass produced a researched gap list (measured against Firefly III / Actual /
ezBookkeeping and mainstream 2026 apps); the owner asked for it to become real work.
Detail + acceptance in [`backlog.md`](backlog.md) Y1–Y7. **Y1 and Y2 come first.**

- [x] **Y1 — Backups (hard gate):** done 2026-08-08. `scripts/backup.ps1` dumps inside the
  container and `docker cp`s the bytes out (a PowerShell stdout redirect corrupts a
  compressed dump), refuses to keep an implausibly small file, and only prunes old
  backups after a verified-good new one. **Restore actually performed:** `pg_restore` into
  a scratch DB matched all five table row counts and `SUM(amount)` to the cent (10302.69).
  Task Scheduler setup + restore procedure documented in `DEVELOPMENT.md` §2.
  **Caveat:** the admin "Backup now" button is structurally broken (backend container
  can't see `scripts/` and has no `pwsh`) — left alone rather than widening the ticket,
  recorded in backlog.md's Discovered list.
- [x] **Y2 — Net worth over time** (done 2026-08-08): monthly balance snapshots per account, **per
  profile**, never blended across countries; honesty-gated trendline on Insights. The
  biggest missing *number* in an app pitched as "know where my money goes" — `grep
  net_worth` currently returns zero hits.
- [ ] **Y3 — Proactive "needs attention" on Home:** the rule engines already compute
  bill-due, forecast crunch, and spend anomalies and then never tell anyone. In-app only
  — **no push infrastructure** — reusing I6's evidence + dismiss card pattern.
- [~] **Y4 — Tablet breakpoint — superseded by ZB** (2026-08-08): the fix belongs inside
  the adaptive-architecture decision, not as a standalone breakpoint tweak. Don't work it.
- [x] **Y5 — Mobile settings:** done 2026-08-08. The name bug was real and the root cause
  was a **phantom `name?` field on the `User` type that nothing ever set** — deleted it so
  the compiler catches the next reader, rather than adding a third fallback. **The nav-
  clipping half was my error**: it came from a full-page screenshot rendering a sticky bar
  mid-content. Measured in the DOM — 136px of clearance, nothing clipped. No change made.
- [x] **Y6 — Two honesty fixes:** done 2026-08-08. Import dialog got a header X (footer
  Cancel would still have stranded the upload step). Quick Add's missing date wasn't a
  render bug — the backend always returned it, but the client type had no `date` field so
  it was discarded on arrival; added and shown on both trees.
- [x] **Y7 — Merchant → category learning:** done 2026-08-08. A `default_category_id` on
  `merchants` (migration 0007) rather than a rules table — merchants are already
  per-profile, are the unit the user already manages, and one-merchant-one-category stays
  explainable. Precedence: this-transaction choice > learned rule > keyword table.
  Clearing is a dedicated endpoint because `exclude_none=True` made a null unexpressible.
  Verified: correct Chipotle once → the next parse *and* quick-add both use Dining Out;
  clearing restores keyword behaviour. Known gap: typo'd input yields no merchant at all
  upstream, so rules don't fire there (noted in Discovered).

**Deliberately deferred, not ticketed:** PWA installability (pairs with the LAN/HTTPS item
in Later — installing a localhost-only app to a phone home screen is near-pointless before
that), and mobile auto-capture/batch scan (belongs with X2's bulk work).

### Phase Z — Visual redesign: Dribbble-style repaint (owner's call, 2026-08-08)

**This phase deliberately supersedes `design-system.md` §1/§2 and reverses R2's palette
decision** (R2 removed purple/blue/amber to reach slate + one orange). The owner has
decided the app should follow the modern fintech-dashboard look — dark-first, richer
accent palette, gradients, bento grids. Recorded explicitly and dated so the docs don't
quietly contradict themselves. Detail + acceptance in [`backlog.md`](backlog.md) Z0–Z5.

**Objection on record:** Dribbble shots are portfolio pieces optimised to look good as a
static JPEG — not to stay readable across 200 transaction rows at 2am on a phone in
daylight. The risk isn't ugliness, it's legibility debt that only appears at real data
volume. **Z5 is the gate that catches it** and can block the phase.

**Non-negotiable through the repaint:** colour lives only in `design-tokens.css` +
`theme.tsx` (no hex in any `.module.css` — this is the only reason a repaint is cheap and
reversible); money keeps green/red semantics on amounts only; WCAG AA on all text in both
themes; both trees get it.

- [x] **ZA — Adaptive architecture: decided 2026-08-08.** Answers the owner's "should we do
  adaptive design and flow?" — **the app is already adaptive in the strongest form**: two
  separate UI trees switched by one hard `max-width: 1023px` query at `main.tsx:23`.
  **Measuring the trees overturned the initial "merge it all" instinct.** `mobile/` is
  2,709 LOC vs `desktop/`'s 8,107 across half the pages, and 4,572 LOC of desktop-only
  pages (Manage, Recurring, Merchants, Goals, Insights, Categories) have no mobile
  counterpart — a merge would force those down to 390px and produce exactly the
  squeezed-desktop-on-a-phone the split prevents. **Decision: keep the two trees, fix two
  things** — tablets routed to the desktop tree (**ZB**, supersedes Y4) and auth shared
  (**ZC**: Login 248-vs-247, Register 349-vs-339 near-identical twins). Both land before
  Z1, never inside the repaint.
- [x] **ZB — Route tablets to the desktop tree** (supersedes Y4): done 2026-08-08 at a
  **767px** threshold. Took four changes, not one — the old 1024 boundary was encoded in
  three places (`main.tsx`, the sidebar's `display: none`, and the layout's 240px gutter)
  that all had to move together, or tablets would have got the desktop tree with its only
  navigation hidden. The real blocker was a flexbox default: `.main` had `min-width: auto`
  so it refused to shrink below Manage's 624px tab strip — fixed with `min-width: 0` plus
  a scrolling tab strip. All 5 destinations verified at 768 with no horizontal scroll.
- [x] **ZC — Login + Register into `shared/`**: done 2026-08-08. Four page dirs became two;
  the only real differences were card chrome, heading size and `id` prefixes that existed
  just to avoid duplicate DOM ids. Kept behind responsive values at Radix's `sm` (768px) —
  the same boundary as ZB's router split, so they can't drift apart. Caught a real bug in
  verification: Radix Card paints in **two** pseudo layers (`::before` fill, `::after`
  border) and hiding only `::after` left a white panel on mobile. `shared/` may hold JSX
  for these two pages only — documented in `CLAUDE.md`.
- [ ] **Z0 — Define the language first** (rewrite design-system.md §1/§2, one approved
  dark Home mock with realistic data volume). Also settles **Radix Themes vs. Radix
  Primitives**: the app uses 24 Themes components; Primitives (accessible behaviour) are
  worth keeping, the *styled* layer is what fights a custom aesthetic. Mantine/Chakra/MUI
  just swap one opinionated look for another; shadcn/ui needs Tailwind, which is banned.
  If the styled layer goes, it's **its own migration ticket before Z2** — never bundled
  with the repaint, or Z5 can't attribute a regression.
- [x] **Z1 — Token layer + theme:** done 2026-08-08, and the proof point held — the whole
  app went dark with **zero component edits**. The contrast gate caught a real
  pre-existing bug: dark mode was rendering the *light* theme's red for every money
  amount (3.73:1, under AA) because `--money-negative` was declared on `:root`, outside
  `.radix-themes` — a `var()` inside a custom property resolves where it's declared.
  Zero AA failures now across all 5 pages in both themes.
- [x] **Z2 — Home as a bento grid** — done 2026-08-08. Only the container and tile spans
  changed; all content/logic identical. Key lesson: group tiles by *natural height* per
  row, or a short tile beside a tall one leaves a hole. **The hero gradient took three
  attempts** — the contrast gate rejected a saturated orange fill twice (2.02:1 then
  2.51:1; white-on-orange can't clear AA at body sizes) before landing on an
  accent-*tinted* tile at 6.82:1 that keeps the focal point and stays readable.
- [x] **Z3 — Insights + charts** — done 2026-08-08. The finding: **3 of 4 charts didn't
  need a categorical palette, they needed the right form** — one was colouring by *rank*,
  two were using a *sequential* ramp on a single series (colour encoding nothing). Those
  are now one hue each. The one genuinely categorical chart (Merchants' pie) moved off
  unvalidated DB hexes onto a fixed slot order, **validated with the dataviz script**
  against our real surfaces (CVD ΔE 9.1 light / 8.4 dark — PASS). `--chart-1..8` is a
  bounded exception to the 3-colour rule: chart marks only.
- [x] **Z4 — Activity, Manage, dialogs sweep** — done 2026-08-08. Z1's token layer had
  already carried every surface (raw-colour audit: zero hits), so the real work was the
  a11y gap V4 flagged: **14 dialogs emitted `aria-describedby` pointing at an element
  that was never rendered** — a dangling reference, worse than none. All now described.
- [x] **Z5 — Legibility gate: PASSED 2026-08-08** at 562 transactions / 14 categories /
  9 months. **Zero AA failures** across both themes, both viewports, all pages. It
  blocked three times first and caught four real defects invisible to tsc/eslint/e2e/
  screenshots — including dark mode rendering the *light* theme's red for every money
  amount. Recurring root cause worth remembering: **Radix steps 9–10 are surfaces,
  11–12 are text**; a surface step used as text passes every automated check and
  quietly fails readers.

**Phase Z complete** — Z0–Z5 done and verified 2026-08-08.

### Phase E — Edge cases real users hit (researched 2026-08-08)

The owner asked for an app that "should not be complicated but should cover all the edge
cases the user has problems with". Researched against what people actually complain about
in 2026 finance apps and receipt scanners. Detail in [`backlog.md`](backlog.md) E1–E5,
**ordered by how badly the failure corrupts the numbers**.

**Already ahead of the market — do not re-solve:** duplicate transactions are the #1
complaint about mainstream apps and D3's dedup gate already covers every import path;
miscategorisation is #2 and Y7 now learns corrections; bank-sync breakage is #3 and
doesn't apply here by design.

- [x] **E1 — Transfers: done 2026-08-08.** Migration 0008 adds `to_account_id`; balance maths rewritten as a UNION of per-account deltas (FILTERed income/expense sums moved *neither* balance for a transfer). Verified: a 500 transfer moved Checking −500 and Savings +500 with expense totals unchanged; invalid cases 422. Entry point: **quick-add learned the pattern** rather than adding a form surface — `"transfer 500 to savings"` works, requires both a verb and a destination ("moved house" stays an expense), takes no category or merchant, and **refuses** an unresolvable or ambiguous destination instead of falling back to an expense. Measuring inverted
  the assumption: the aggregates are already correct (reports filter on explicit
  `income`/`expense`, so `transfer` is excluded by construction), but
  `grep -rn "'transfer'" frontend/src` returns **zero hits** — the backend supports the
  type and **no UI exposes it**, pushing users to record transfers as expenses and
  double-count.
- [ ] **E2 — Refunds treated as income.** A returned jacket should reduce Shopping, not
  add to salary. The statement parser already reads `CR`/trailing-minus; the gap is
  downstream.
- [ ] **E3 — Split transactions.** One supermarket receipt is groceries + household +
  wine. `grep split` finds nothing in the money path, so every category total is
  approximate.
- [x] **E4 — Wrong-currency receipts: done 2026-08-08.** Scanning an INR
  receipt under the US profile currently has no defined behaviour and would store it as
  USD — an ~85x silent corruption. Detect and refuse; **never convert**.
- [ ] **E5 — Multi-page and awkward statements.** Verify against a real multi-page PDF
  before changing anything; likely gaps are rows split across page breaks and repeated
  headers parsing as transactions.

**Z0 now has a proposed answer** (in `backlog.md` under Z0) rather than being blocked:
dark-first keeping orange, depth via elevation instead of glassmorphism, exactly one
gradient on the Safe-to-Spend hero, bento Home, squircles, motion stays functional-only,
Radix Themes stays. It adds no screen, setting or step — complexity is spent on Phase E
instead, where it buys the user something. **Awaiting sign-off.**

**Strategic flag raised with it:** "attractive to sell" conflicts with this repo's
localhost-only, one-login-per-person premise. Looking sellable is cheap; *being* sellable
means multi-tenancy, hosting, onboarding, billing and support — a different product.
Decide that separately from the visual work.

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
