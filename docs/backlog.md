# Backlog — Detailed Tickets

> Last updated: 2026-07-16
> This is the execution file `plan.md` refers to. Every roadmap checkbox expands into a
> ticket here. **Work one ticket at a time, in order, exactly as scoped.**

## How to work this file (rules for opencode / Claude Code / any tool)

1. Pick the **lowest-numbered open ticket** whose dependencies are done (a ticket that
   explicitly notes "can run in parallel" may be taken out of order). Do not skip ahead
   otherwise, do not bundle tickets, do not invent work that isn't in a ticket.
2. **Stay inside the ticket's scope.** If you notice something broken outside it, add a
   note under "Discovered" at the bottom of this file — do not fix it now.
3. A ticket is done only when: all acceptance criteria pass · lint/format clean ·
   pytest green · verified with `feature-verify` (Playwright, **both viewports**:
   desktop ≥1024px and mobile 390×844) · reviewed against `rules/code-review.md` ·
   one commit per ticket (`T3: replace python-jose with PyJWT`) · checkbox ticked here
   and in `plan.md`.
4. Specs referenced everywhere: UI = `design-system.md` · schema = `architecture-and-goals.md`
   · AI allocation = `architecture-and-goals.md` §AI task allocation.
5. Ticket numbering has gaps (D2, D4, S5 were retired during planning and removed) —
   a missing ID is not an error and never gets reused.

---

## Phase T — Trust & Cleanup

### [ ] T1 — Pytest setup + money-path tests
**Goal:** money math can't silently break again.
**Build:** `backend/tests/` with pytest + pytest-asyncio; fixtures for an in-memory or
dockerized test DB and a seeded test user. Test suites:
`test_nl_parser.py` (≥16 cases: "coffee 4.50", "spent 25.50 on coffee at starbucks",
"salary 3200", relative dates — "coffee 4.50 yesterday", "lunch 12 last friday",
"rent 1200 on the 1st" (all resolve to correct absolute dates; no date mentioned →
today); missing amount — "netflix" must return a structured result with
`missing: ["amount"]` and the recognized merchant, NOT an error (the UI uses this to ask
the one follow-up question "How much?"); garbage input returns an honest unparseable
result);
`test_report_math.py` (monthly income/expense/net over a fixture set — assert exact
Decimals); `test_bill_matching.py` (auto-link: merchant+amount+date proximity hits and
near-misses).
**Accept:** `cd backend && pytest` green; a deliberately-wrong assertion fails (sanity);
tests use `Decimal`, never float literals compared to floats.
**Files:** `backend/tests/*`, `backend/requirements.in` (+pytest), `docs/DEVELOPMENT.md` §3.

### [ ] T2 — Delete ResponseCacheMiddleware
**Goal:** kill the stale-balance bug (accounts cached 60s; transaction writes never invalidate).
**Build:** remove `ResponseCacheMiddleware`, `_response_cache`, `invalidate_response_cache`
from `core/middleware.py`; remove registration in `main.py`; remove both calls in
`routers/accounts.py`.
**Accept:** grep for `invalidate_response_cache|ResponseCacheMiddleware` returns nothing;
add transaction → account balance correct immediately on Home (verify via Playwright).
**Depends:** —

### [ ] T3 — Replace unmaintained auth libraries
**Goal:** drop abandoned `python-jose` and `passlib`.
**Build:** `core/security.py` only — `python-jose` → `PyJWT` (`jwt.encode/decode`, same
HS256, keep exp handling; catch `jwt.PyJWTError`); `passlib` → `bcrypt` direct
(`bcrypt.hashpw/checkpw`; existing `$2b$` hashes must still verify — no data yet, but
keep compatibility anyway). Unpin `bcrypt` from 4.0.1. Update `requirements.in`, re-lock.
**Accept:** register → login → refresh → authed request all work (Playwright); old-style
hash verifies in a unit test; `pip list` shows no jose/passlib.
**Depends:** T1 (so auth tests exist first).

### [ ] T4 — Dependency & dead-code audit
**Goal:** no dead or deprecated code left.
**Build:** run `npm outdated`, `npx depcheck`, `pip list --outdated`; delete unused deps,
unused components/endpoints/CSS found. Known suspects: README's structure/feature
sections (describe the pre-rebuild app — align with current docs), `core/cache.py`
(check who imports it; if nobody, delete).
**Accept:** depcheck reports no unused deps; app builds and runs; README stack list
matches package.json/requirements.
**Depends:** T2 (don't audit what's about to be deleted).

### [ ] T5 — Cloud AI opt-in toggle (per user, off by default)
**Goal:** enforce the AI allocation table — private by default, cloud by informed choice,
free tiers only.
**Build:** backend: `ai_cloud_enabled` **per-user** column (default false; T5 runs
before D1, so add it via a small migration here — D1's squash absorbs it into the clean
initial schema); ALL cloud calls route through one provider layer that checks the
requesting user's toggle —
toggle off = cloud skipped entirely (rules/Ollama fallback); no code path may call a
cloud API directly. **Consolidate to ONE cloud provider: Gemini** (free tier, already
configured, does both text and vision) — delete the NVIDIA and Groq provider code,
config keys, and env vars. Frontend Settings: toggle with explicit warning ("your
financial data — including documents you scan — will be sent to Google's AI service;
the free tier may use it to train their models"). Free tier only; no paid API config.
**Accept:** with toggle off, zero outbound calls to AI hosts (assert via mock/log);
user A toggling on doesn't affect user B (test); toggle on shows the warning before
enabling; quick-add still works with no keys at all.
**Depends:** —

### [ ] T6 — Clean-clone setup verification
**Goal:** `git clone` → running app with zero undocumented steps.
**Build:** follow `DEVELOPMENT.md` §1 on a clean checkout (fresh venv, fresh
node_modules, fresh DB volume); fix every deviation found; document exact steps.
**Accept:** the §1 checklist (register→quick-add→bill→reports→export) passes on a clean
environment.
**Depends:** T2–T4.

---

## Phase D — Data Model v2

### [ ] D1 — v2 schema + squashed migration (country-profile model)
**Goal:** the clean schema, once. Spec: `architecture-and-goals.md` §Data Model v2 and
§Country & currency rules.
**Build:** new `profiles` table (user_id FK, country US/IN/CA, currency assigned from
country, `UNIQUE(user_id, country)`); **every financial table re-keyed to `profile_id`**
(accounts, transactions, merchants, bills, goals, budgets, documents) — `user_id`
remains only on users/profiles; backend dependency `get_current_profile` validates the
requested profile belongs to the JWT user on every financial route. **No currency
columns anywhere below profiles; no `exchange_rates` table — profiles are sealed
single-currency worlds, never merged.** Transaction additions: `source` (Literal:
manual/quick_add/csv_import/document_scan), `import_hash` (String, indexed, nullable),
`document_id` (FK documents, nullable). Users table = auth only + `ai_cloud_enabled` +
first-registered-user-becomes-admin logic; explicit cascade rules user→profiles→all.
Registration: country picker → user + first profile + default "Checking" account.
"Add country" endpoint (creates additional profile, max one per country). New table
`documents` (per spec). Frontend: active profile in store + localStorage; `X-Profile-Id`
(or equivalent) on financial requests; `formatCurrency` uses the profile's locale
(en-US/en-IN/en-CA — India gets ₹1,00,000 grouping). Delete all Alembic versions;
generate ONE initial migration. Pydantic models updated; every creation path sets `source`.
**Accept:** fresh DB + `alembic upgrade head` builds everything; first registered user
`is_admin=true`, second not (test); registering with India → default account + amounts
render ₹ lakh-style (Playwright); requesting profile B's data while active on profile A
(or another user's profile) → 404 (tests); user with US+India profiles sees completely
disjoint data per profile (test); hard-deleting a test user leaves zero orphans (test);
pytest green.
**Depends:** T1, T6.

### [ ] D3 — Dedup service
**Goal:** one gate every import path uses. Spec: `architecture-and-goals.md` §Deduplication.
**Build:** `services/ingest/dedup.py`: `compute_import_hash(profile_id, account_id, date,
amount, normalized_desc)` (sha256); `find_duplicates(candidate) -> exact | fuzzy[] | none`
— fuzzy = same amount, date ±3 days, merchant similarity on normalized names.
Pure functions + one DB lookup helper; no router wiring yet (U4 and S3/S4 wire it).
**Accept:** unit tests: exact dup detected; date-shifted dup flagged fuzzy; different
amount not flagged; performance fine on 10k-row fixture.
**Depends:** D1.

### [ ] D5 — Typo-tolerant merchant matching
**Goal:** "wallmart", "starbcks" never create duplicate merchants.
**Build:** in merchant resolution (quick-add, CSV import, document scan all pass through
it): normalize → exact match → else Levenshtein distance ≤2 (≤1 for names ≤5 chars)
against the active profile's existing merchant `normalized_name`s (never across
profiles) → match found = use existing
merchant (surface "matched to Walmart" in the preview so the user can override) → no
match = create new. Pure function in `services/merchant_service.py` + tests.
**Accept:** unit tests: "wallmart"→Walmart, "starbcks"→Starbucks, "wal"≠Walmart (too
short/ambiguous), genuinely new merchant still created; preview shows the correction
(Playwright, both viewports).
**Depends:** D1.

---

## Phase U — UI Rebuild (order + specs: `design-system.md` §5 and §3)

### [ ] U1 — Design tokens + theme
**Goal:** one theme file controls all color, for real.
**Build:** rewrite `styles/design-tokens.css` to only alias Radix tokens (spacing scale,
card anatomy vars, `--money-positive: var(--green-11)`, `--money-negative: var(--red-11)`);
`theme.tsx` stays accentColor="orange" grayColor="slate"; delete every other color
definition project-wide (grep for `#`, `rgb(`, `hsl(` in `*.module.css` → zero hits
except tokens file); fix the undefined `--bg-deep`/`--bg-panel` by removing their usages.
**Accept:** grep clean; app renders in light+dark with no visually broken page (spot-check
via Playwright screenshots of every route, both viewports).
**Depends:** — (can start parallel to Phase D).

### [ ] U2 — Login + Register rebuild
**Goal:** first impression proves the system.
**Build:** both trees: centered single card (max 400px), app name, fields, ONE accent
button; register keeps username/confirm/show-hide + validation; errors inline under
fields (no toasts); Radix components only; keyboard: Enter submits.
**Accept:** visual per `design-system.md` §1–2; login and register flows pass Playwright
in both viewports, light + dark.
**Depends:** U1.

### [ ] U3 — Home rebuild (desktop + mobile)
**Goal:** the daily screen. Spec: §3 table.
**Build:** desktop: safe-to-spend hero placeholder (shows "—" with "needs Phase I" note
until I5), month summary (income/spent/net from reports API), upcoming bills, recent
activity, insight-card slots (empty-state per §4). Mobile: hero + next 3 bills +
this-month-vs-last bar only. **Fix: "Total Balance" must exclude credit accounts** —
show "Cash on hand" (checking+savings+cash) and "Credit owed" separately.
**Profile switcher lands here:** country flag + name in the desktop top bar / mobile
avatar row; switching swaps the active profile (store + localStorage), clears cached
slice data, and reloads — profiles never blend on screen. Login with 2+ profiles asks
"Which country?" once.
**State cleanup here:** shared `useHomeData` hook in `shared/hooks/`; types imported from
slices; staleness check added to `namespaceSlice` (skip refetch <30s; `force` param).
**Accept:** navigating away/back within 30s does not refetch (assert no loading flash);
credit no longer inflates the balance (test fixture + Playwright assertion); switching
profile shows entirely different data with the right currency formatting (Playwright,
user with US+IN fixture profiles); both viewports match §2 alignment rules.
**Depends:** U1, D1.

### [ ] U4 — Activity rebuild (desktop + mobile) + shared logic extraction
**Goal:** replace the two ~1,100-line twins.
**Build:** extract `shared/hooks/useActivityFilters.ts` + `useTransactionList.ts` (search,
filters, infinite scroll, optimistic ops) consumed by both trees. Desktop: dense table,
bulk select+edit (category/account reassignment), CSV import entry + **dedup review
queue UI** (wire D3: exact dups auto-skipped with count shown; fuzzy dups side-by-side
merge/skip/keep-both). Mobile: card list, search, simple filters, swipe-to-delete only.
**State cleanup here:** slice errors surface via a UI toast/inline pattern (no silent
`catch{}`); `updateNotes` gets a real revert; `deleteTransaction` rollback restores
sort position; filter lists read from categories/merchants slices (delete the duplicates
in transactionsSlice).
**Accept:** both pages < 400 lines each; importing the same CSV twice inserts zero
duplicates and shows the review queue (Playwright); a forced API failure on notes-save
shows an error and reverts (mock).
**Depends:** U1, D3.

### [ ] U5 — Recurring page (desktop, new)
**Goal:** bills + budgets in one "what repeats" view (subscriptions section lands in I2).
**Build:** sections: Upcoming (bills with next date, paid ✓), All recurring (bills table:
name, amount, frequency, monthly-equivalent cost, total-per-month headline), Budgets
(progress per §4 — Radix Progress, accent only when on-track-action needed). Bill CRUD
dialogs migrate here; old Bills/BillDetail pages retire when this lands.
**Accept:** every old Bills-page capability reachable here; total-per-month headline is
the Decimal-exact sum of monthly equivalents (weekly ×52/12 etc. — unit test);
Playwright both viewports (mobile: page doesn't exist — verify absence + bills still
visible on mobile Home).
**Depends:** U1.

### [ ] U6 — Insights page (desktop, new)
**Goal:** absorb Reports + Categories analytics.
**Build:** period selector (month/year); breakdown by category and by merchant (Nivo,
§1 rule 3 colors: sorted slate bars, top item accent — replace rainbow pies); MoM and
YoY comparison cards; annual view (12-month Nivo bar). Old Reports page + Categories
analytics tab retire.
**Accept:** numbers match `/api/reports` exactly (cross-check one month by hand in test);
charts are Nivo-only, palette-compliant; Playwright desktop (+ absence on mobile).
**Depends:** U1; D4 (soft).

### [ ] U7 — Manage page (desktop, new)
**Goal:** one home for every maintenance UI.
**Build:** Radix Tabs: Accounts / Categories (hierarchy CRUD) / Merchants (rename, merge,
hide) / Goals (CRUD + contribute; progress stays on Home) / Import (CSV mapping UI moves
here) / AI & Privacy (T5 toggle + Ollama endpoint) / Account (password; **Add country**
— creates an additional country profile, max one per country, D1 endpoint).
Old Settings/Categories/Merchants/Goals pages retire.
**Accept:** every capability of the four retired pages reachable; `window.confirm` gone
(Radix AlertDialog); Playwright desktop flows: create category child, merge merchants,
goal contribute.
**Depends:** U1.

### [ ] U8 — Mobile capture flow + mobile page retirement
**Goal:** mobile = Home/Activity/Capture, nothing else.
**Build:** center tab button → bottom sheet: **Type** (NL quick-add with preview,
following the one-question rule in `design-system.md` §4 — amount missing → one inline
"How much?" follow-up; date/category/account never asked, only correctable in preview)
and **Scan** (disabled with "coming with document scanning" note until S6). Delete mobile
Categories/Merchants/Reports/Goals/More pages + routes (redirect to `/`); tab bar
becomes Home · Capture · Activity; settings via avatar on Home.
**Accept:** two taps from any screen to a saved typed transaction (Playwright 390×844);
deleted routes redirect; no dead imports/CSS remain.
**Depends:** U3, U4.

### [ ] U9 — Folder consolidation + final sweep
**Goal:** target structure from `architecture-and-goals.md`; nothing retired survives.
**Build:** merge `src/auth`, `src/hooks`, `src/utils` into `shared/` (api/hooks/types/
utils); update imports; delete all retired pages/components/CSS; dark-mode audit
(Playwright screenshot every route, both viewports, both themes); alignment audit
against §2.
**Accept:** `desktop/`+`mobile/` contain only `.tsx`+`.module.css`; build green; no
unused files (depcheck + manual); screenshots reviewed.
**Depends:** U2–U8.

---

## Phase I — Intelligence (engines are pure functions in `services/insights/`, test-first)

### [ ] I1 — Recurring detection engine
**Goal:** find everything that repeats. Spec: `architecture-and-goals.md` §Recurring detection.
**Build:** `services/insights/recurring.py`: `detect(transactions) -> list[RecurringCharge]`
— group by merchant_id, **falling back to normalized description when merchant is NULL**
(income like salary deposits often has no merchant — income detection must still work,
I4 depends on it); amount consistency (exact → subscription; ±20% → variable bill);
interval clustering vs 7/14/30/90/365 ±tolerance (3d for weekly, 5d monthly, 15d yearly);
≥3 occurrences; emit merchant, avg amount, cadence, monthly_equivalent (Decimal),
next_expected_date, confidence. Endpoint `GET /api/insights/recurring`.
**Accept:** test-first, ≥10 fixtures: Netflix monthly exact; utility ±15%; biweekly
paycheck; 2-occurrence rejected; price-hike still detected with hike flagged; irregular
merchant rejected.
**Depends:** D1.

### [ ] I2 — Subscriptions section on Recurring page
**Build:** "Detected subscriptions" on U5's page: rows (name, monthly cost, next date,
price-increase flag) under total headline; "not a subscription" dismiss (persisted,
excluded from re-detection); undetected bills remain manually addable.
**Accept:** seeded fixture data shows correct list + total (Playwright); dismiss persists
across reload.
**Depends:** I1, U5.

### [ ] I3 — Trends & anomaly engine
**Build:** `services/insights/trends.py`: MoM/YoY per category and total; anomaly =
current month category spend > 2× trailing-3-month avg (min $50 and ≥3 months history —
honesty rule: insufficient data → no claim); 3-month rising streak detection. Structured
`Insight` objects with evidence (the numbers behind the claim). `GET /api/insights/`.
**Accept:** unit tests incl. honesty cases (2 months history → no anomaly emitted).
**Depends:** D1.

### [ ] I4 — Cash-flow forecast engine
**Build:** `services/insights/forecast.py`: 60–90 day daily simulation — start = cash
accounts balance; + income on expected paydays (from I1 income detection); − recurring
bills on expected dates (I1); − avg daily discretionary (trailing 3 months, excluding
recurring); output daily balance series + crunch points (days < buffer).
**Accept:** hand-computed 30-day fixture matches exactly (test); insufficient data →
explicit "needs ~2 months" response, not a guess.
**Depends:** I1.

### [ ] I5 — Safe-to-spend + Home hero wiring
**Build:** `safe_to_spend = cash balance − (bills due before next payday) − (goal
contributions due)`; endpoint + wire U3's hero (both viewports); sub-line: "next paycheck
in N days, $X in bills before then".
**Accept:** fixture math exact (test); hero live on both Homes (Playwright); insufficient
data shows honest empty state.
**Depends:** I4.

### [ ] I6 — Insight cards + advice
**Build:** rules generate advice per AI allocation table (rank subscription costs, flag
increases, budget drift, goal pacing) — deterministic, evidence attached, template-worded;
local AI (if Ollama present) may rephrase only. Top 3–5 cards on desktop Home with
dismiss; each card links to its evidence (e.g., the subscription row).
**Accept:** with Ollama absent everything still renders (templates); no card ever shows
a number that isn't in its evidence payload (test the generator).
**Depends:** I1, I3, U3.

---

## Phase S — Document Understanding

### [ ] S1 — Documents storage + upload
**Build:** `documents` table lives since D1; add file storage `backend/uploads/{user_id}/`
(uuid names, path never client-controlled); `POST /api/documents` (multipart, jpg/png/pdf,
≤15MB, auth, sets status=pending), `GET /api/documents/{id}` (ownership-checked, serves
file); desktop upload dropzone on Activity import area.
**Accept:** upload→fetch roundtrip; other user's document → 404 (test); oversize/wrong
type rejected cleanly.
**Depends:** D1.

### [ ] S2 — Extraction service (local AI, tiered)
**Build:** `services/ingest/document_extract.py`: tier A = Ollama vision (model
configurable, e.g. qwen2.5-vl class) → structured JSON {merchant, date, total, line_items?,
category_hint}; tier B fallback = cloud vision (Gemini) **only when the user's T5 toggle is on**;
tier C = Tesseract + regex (total/date/merchant heuristics) — the no-Ollama, no-opt-in
path. All routing through the T5 provider layer. Store result in
`documents.extracted_json`; category inference: merchant history first (rules), then hint.
Extracted amounts flow through D5 merchant matching before the review screen.
**Accept:** fixture receipts (clear, blurry, non-receipt) produce sane JSON or honest
`{"confidence": "low"}`; with Ollama stopped + toggle off, tier C still returns totals on
clear fixtures with zero outbound calls (assert); with toggle on, cloud fallback engages
and is logged as such.
**Depends:** S1, T5 (provider layer), D5 (merchant matching).

### [ ] S3 — Review screen (nothing auto-commits)
**Build:** desktop: pending documents queue → editable extracted fields side-by-side with
the image → dedup check (D3) runs before save → exact dup auto-flagged, fuzzy shows
merge/skip/keep-both → save creates transaction(s) with source=document_scan,
document_id set, document status=reviewed.
**Accept:** Playwright: upload fixture receipt → review → save → transaction in Activity
with paperclip link back to image; saving same receipt twice → duplicate flagged, no
double insert.
**Depends:** S2, U4.

### [ ] S4 — Statement mode (credit-card / bank PDF)
**Build:** extraction returns transaction *list* for statements; review screen renders
rows (include-checkbox, editable category, dedup status per row — critical: statement
rows usually duplicate already-imported transactions → default-exclude exact matches,
flag fuzzy).
**Accept:** fixture statement with 3 known + 2 new transactions → exactly 2 inserted
(Playwright + DB assert).
**Depends:** S3.

### [ ] S6 — Mobile scan capture
**Build:** enable U8's Scan button: camera via `<input type="file" accept="image/*"
capture="environment">` (native camera on HTTPS/localhost; degrades to gallery picker
over LAN HTTP per `DEVELOPMENT.md` §5). **One-line explainer before first camera use**
("Snap the whole receipt — the app reads it on this device") — researched UX finding:
a brief purpose note before the permission prompt dramatically raises camera acceptance.
Then upload → extraction → mobile-simplified review (fields + dedup verdict) → save.
**Accept:** Playwright 390×844 with fixture image upload → transaction saved; camera
limitation documented in-UI when unavailable.
**Depends:** S3, U8.

### [ ] S7 — Local-AI quick-add fallback (typed input)
**Goal:** weird phrasing and messy typing still parse — privately.
**Build:** in the parse pipeline: rules parser first (T1 contract); if it fails or
returns low confidence AND Ollama is available → local LLM extracts structured JSON
(amount, description, merchant, type, relative date) with a strict JSON-schema prompt;
result flows through D5 merchant matching and the normal preview (one-question rule
unchanged). Ollama absent → cloud fallback **only if the user's T5 toggle is on**;
otherwise the rules result stands. All via the T5 provider layer.
**Accept:** with Ollama running: "pais 30 dolar grocery wallmart yesteday" → correct
preview (amount 30, Walmart matched, date = yesterday); Ollama stopped + toggle off:
degrades to rules result, zero outbound calls (assert); toggle on: cloud fallback engages.
**Depends:** T1, D5, S2 (Ollama client exists).

---

## Phase A — Admin Panel (desktop Manage tab, `is_admin` only)

### [ ] A1 — Admin API
**Build:** `routers/admin.py` + `require_admin` dependency: user list/create/deactivate
(**never** anyone's financial data — isolation rule), system-category CRUD, job
status (last backup timestamp if configured, pending documents count),
per-user export-all (each user can export only their own data; admin triggers nothing
that reads another user's rows), backup-now trigger (runs `scripts/backup.ps1` when
present; reports "not configured" otherwise).
**Accept:** non-admin → 403 on every route (test); admin cannot fetch another user's
transactions via any admin route (test proves absence).
**Depends:** D1.

### [ ] A2 — Admin UI
**Build:** "Admin" tab in Manage, visible only when `is_admin`; users table, system
categories editor, job/status cards, dedup audit list (skipped/merged imports).
**Accept:** hidden for non-admin (Playwright as both users); create user → new user logs
in fresh with own empty dashboard.
**Depends:** A1, U7.

---

## Discovered (parking lot — do not act without a ticket)

- README still describes the pre-rebuild app (fix in T4).
- `docs/DEVELOPMENT.md` §2 backup script: create `scripts/backup.ps1` when backups
  activate (gate: before first real data — see plan.md Later).
