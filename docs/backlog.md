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
   verified against the real running app — `feature-verify` (Playwright, **both
   viewports**: desktop ≥1024px and mobile 390×844) for anything UI-reachable, or a
   short-lived scratch script against the live DB (deleted after use) for backend-only
   logic with no UI surface yet · reviewed against `rules/code-review.md` · one commit
   per ticket (`T3: replace python-jose with PyJWT`) · checkbox ticked here and in
   `plan.md`. **No test files are kept in the repo** (decided under T1, 2026-07-17) —
   correctness is proven against the real system each time, not asserted in a
   persisted suite.
4. Specs referenced everywhere: UI = `design-system.md` · schema = `architecture-and-goals.md`
   · AI allocation = `architecture-and-goals.md` §AI task allocation.
5. Ticket numbering has gaps (D2, D4, S5 were retired during planning and removed) —
   a missing ID is not an error and never gets reused.

---

## Phase T — Trust & Cleanup

### [x] T1 — Money-path correctness (parser, reports, bill matching) — done 2026-07-17
**Goal:** money math can't silently break again.
**Decision made on this ticket, applies project-wide:** no pytest / no `backend/tests/`
— verify against the real running app instead (Playwright for UI-reachable flows,
scratch scripts against the live DB for backend-only logic), per rule 3 above.
**Build:** parser contract — relative dates ("coffee 4.50 yesterday", "lunch 12 last
friday", "rent 1200 on the 1st" all resolve to correct absolute dates; no date
mentioned → today); missing amount — "netflix" returns a structured result with
`missing: ["amount"]` and the recognized merchant, NOT an error (the UI asks the one
follow-up "How much?"); garbage input returns an honest unparseable result. Money math
uses `Decimal` throughout, never float literals compared to floats.
**Accept — verified live:** quick-add exercised through the real UI with each of the
above phrasings (Playwright) — correct amount/date/merchant every time, "netflix" alone
correctly triggers the one-question follow-up; report math cross-checked against real
seeded transactions (Activity + Reports pages showing matching totals); bill
auto-linking verified end-to-end in T6 (create bill → quick-add a matching transaction
→ appears "Paid ✓").

### [x] T2 — Delete ResponseCacheMiddleware — done 2026-07-17
**Goal:** kill the stale-balance bug (accounts cached 60s; transaction writes never invalidate).
**Build:** remove `ResponseCacheMiddleware`, `_response_cache`, `invalidate_response_cache`
from `core/middleware.py`; remove registration in `main.py`; remove both calls in
`routers/accounts.py`.
**Accept:** grep for `invalidate_response_cache|ResponseCacheMiddleware` returns nothing;
add transaction → account balance correct immediately on Home (verify via Playwright).
**Depends:** —

### [x] T3 — Replace unmaintained auth libraries — done 2026-07-17
**Goal:** drop abandoned `python-jose` and `passlib`.
**Build:** `core/security.py` only — `python-jose` → `PyJWT` (`jwt.encode/decode`, same
HS256, keep exp handling; catch `jwt.PyJWTError`); `passlib` → `bcrypt` direct
(`bcrypt.hashpw/checkpw`; existing `$2b$` hashes must still verify — no data yet, but
keep compatibility anyway). Unpin `bcrypt` from 4.0.1. Update `requirements.in`, re-lock.
**Accept:** register → login → refresh → authed request all work (Playwright, verified
live); `pip list` shows no jose/passlib.
**Depends:** T1.

### [x] T4 — Dependency & dead-code audit — done 2026-07-17
**Goal:** no dead or deprecated code left.
**Build:** run `npm outdated`, `npx depcheck`, `pip list --outdated`; delete unused deps,
unused components/endpoints/CSS found. Known suspects: README's structure/feature
sections (describe the pre-rebuild app — align with current docs), `core/cache.py`
(check who imports it; if nobody, delete).
**Accept:** depcheck reports no unused deps; app builds and runs; README stack list
matches package.json/requirements.
**Depends:** T2 (don't audit what's about to be deleted).

### [x] T5 — Cloud AI opt-in toggle (per user, off by default) — done 2026-07-17
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
**Accept:** with toggle off, zero outbound calls to AI hosts (verified live — no Gemini
request fires); user A toggling on doesn't affect user B (checked directly against the
DB/API); toggle on shows the warning before enabling; quick-add still works with no
keys at all.
**Depends:** —

### [x] T6 — Clean-clone setup verification — done 2026-07-17
**Goal:** `git clone` → running app with zero undocumented steps.
**Build:** follow `DEVELOPMENT.md` §1 on a clean checkout (fresh venv, fresh
node_modules, fresh DB volume); fix every deviation found; document exact steps.
**Accept:** the §1 checklist (register→quick-add→bill→reports→export) passes on a clean
environment.
**Depends:** T2–T4.

---

## Phase D — Data Model v2

### [x] D1 — v2 schema + squashed migration (country-profile model) — done 2026-07-17
**Goal:** the clean schema, once. Spec: `architecture-and-goals.md` §Data Model v2 and
§Country & currency rules.

**Architecture decision made mid-ticket: no ORM anywhere, raw SQL only.** The project
moved from SQLAlchemy ORM to `asyncpg` with hand-written parameterized SQL for every
query, in every router/service. SQLAlchemy remains installed **only** for Alembic's
async migration runner (`env.py`); it is never imported in `routers/` or `services/`.
`database/models.py` is now plain `@dataclass` type hints, not ORM-mapped classes. Full
contract in `rules/database.md`. Real finding along the way: Alembic's async engine
(via SQLAlchemy's asyncpg dialect) only allows **one SQL statement per `op.execute()`**
— a migration written as one big multi-statement string fails with "cannot insert
multiple commands into a prepared statement." Fixed by making `0001_initial_schema.py`
a list of individual statements executed in a loop; documented as a hard rule so future
migrations don't hit the same wall.

**Second decision made mid-ticket: Zustand for any component with 2+ pieces of local
state, not just shared/server state** (supersedes the earlier "ownership over count"
rule in `rules/zustand.md` — owner's call, documented with the date). Applied
immediately to `Register.tsx` (both trees): all form fields, `showPassword`,
`submitting`, and `errors` moved into a new `registerFormSlice.ts`, with a
`resetRegisterForm()` action called on mount so a half-filled form from a previous
visit never leaks into a fresh one — verified by Playwright (switched countries mid-fill,
then revisited `/register` fresh and saw the default US state, not the stale India one).
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
**Accept — all verified against the running app (Playwright + curl), both viewports:**
fresh DB + `alembic upgrade head` builds all 12 tables ✅; first registered user
`is_admin=true`, second not ✅ (curl, DB check); registering with India → default
"Checking" account created + Home renders **₹0.00** (real lakh-grouping locale,
`Intl.NumberFormat('en-IN')` via `useActiveCurrency`) ✅; `X-Profile-Id` header
confirmed on outgoing requests ✅; requesting another user's profile ID → **404 "Profile
not found"** even with a valid token (curl test: own profile 200, other user's profile
404) ✅; two users (US + India) have completely disjoint profiles/accounts, confirmed in
DB ✅; desktop (1280px) and mobile (390px) both clean, zero console errors ✅.
**Not separately pytest'd** — Phase T's owner decision to verify via Playwright against
the running app instead of pytest files (recorded under T1) applies here too.
**Depends:** T1, T6.

### [x] D3 — Dedup service — done 2026-07-17
**Goal:** one gate every import path uses. Spec: `architecture-and-goals.md` §Deduplication.
**Build:** `services/ingest/dedup.py`: `compute_import_hash(profile_id, account_id, date,
amount, normalized_desc)` (sha256, amount quantized to 2dp so 42.5 and 42.50 hash the
same); `find_duplicates(candidate, conn) -> DedupResult` (`status: exact|fuzzy|none`)
— exact short-circuits on `import_hash`; fuzzy = same amount (never fuzzy on amount),
date within ±3 days, Jaccard word-overlap similarity ≥0.5 on normalized
merchant/description (reuses `merchant_service.normalize_name`). Pure functions + one
DB lookup helper; no router wiring yet (U4 and S3/S4 wire it).
**Accept — verified against the live DB** (no UI surface yet, so exercised directly
with the real asyncpg driver rather than Playwright — matches T1's owner decision to
verify against the running system, adapted to a service with no router yet): exact dup
(identical amount/date/description) → `status=exact` ✅; date-shifted dup (+2 days,
reworded description "Grocery Store" → "Grocery Store Purchase") → `status=fuzzy`,
similarity=0.67 ✅; different amount (same date/description) → `status=none` ✅; date
outside the ±3-day window → `status=none` ✅ (bonus case beyond the ticket's minimum);
10,000-row fixture, 20 repeated calls → **1.30ms average** ✅.
**Depends:** D1.

### [x] D5 — Typo-tolerant merchant matching — done 2026-07-17
**Goal:** "wallmart", "starbcks" never create duplicate merchants.
**Build:** `services/merchant_service.py`: `levenshtein_distance` (plain DP, no new
dependency) + `find_fuzzy_merchant` (normalize → Levenshtein ≤2, or ≤1 for names
≤5 chars, against the active profile's existing merchant `normalized_name`s only —
never across profiles) + `find_matching_merchant` (exact-then-fuzzy, read-only).
`find_or_create_merchant` now calls `find_matching_merchant` before inserting, so
quick-add/CSV import/document scan (all three already funnel through this one
function) get typo tolerance automatically. **Preview correction wired live**:
`/api/transactions/parse` resolves the extracted merchant name through
`find_matching_merchant` (read-only — nothing saved yet) via a new
`_preview_merchant_name` helper, and `AddTransactionModal.tsx` (both trees) gained a
merchant badge in the preview card to display it — this closes a real gap found along
the way: the rules-parser branch of `/parse` never populated `merchant` in the
response at all before this ticket.
**Accept — verified against the live DB and the real UI:**
direct-script test against live Postgres: "wallmart"→existing Walmart (same id) ✅,
"starbcks"→existing Starbucks (same id) ✅, "wal"→creates new, does NOT match Walmart
✅, genuinely new merchant ("Trader Joes") still created ✅. **Live UI test, both
viewports**: seeded an existing near-typo merchant "Walmar", typed "walmart 500" in
quick-add → preview correctly showed a **"Walmar"** merchant badge (matched to the
existing record instead of creating a duplicate "Walmart") on both desktop (1280px)
and mobile (390px), zero console errors either time.
**Discovered, logged to parking lot (not fixed — out of scope):**
`AddTransactionModal.tsx` (both trees) has 6 `useState` calls, violating the current
Zustand rule — flagged for a future U-ticket, not touched here.
**Depends:** D1.

---

## Phase U — UI Rebuild (order + specs: `design-system.md` §5 and §3)

### [x] U1 — Design tokens + theme — done 2026-07-17
**Goal:** one theme file controls all color, for real.
**Build:** rewrite `styles/design-tokens.css` to only alias Radix tokens (spacing scale,
card anatomy vars, `--money-positive: var(--green-11)`, `--money-negative: var(--red-11)`);
`theme.tsx` stays accentColor="orange" grayColor="slate"; delete every other color
definition project-wide (grep for `#`, `rgb(`, `hsl(` in `*.module.css` → zero hits
except tokens file); fix the undefined `--bg-deep`/`--bg-panel` by removing their usages.
**Accept:** grep clean; app renders in light+dark with no visually broken page (spot-check
via Playwright screenshots of every route, both viewports).
**Depends:** — (can start parallel to Phase D).
**Result:** `design-tokens.css` rewritten to only alias Radix tokens — motion easing/duration,
`--radius-card`/`--radius-section` (now aliased to `--radius-4`/`--radius-5` instead of raw
px), spacing, skeleton shimmer (aliased to `--gray-3`/`--gray-4`), and new
`--money-positive`/`--money-negative` aliases (swapped in at the 3 places that had inline
`var(--green-11)`/`var(--red-11)`). Removed entirely: the raw-rgba shadow scale (6 tokens),
raw-rgba glass properties, `--bg-deep`/`--bg-panel` raw hex, the dark-mode raw-hex body
override, and the unused `.glass`/`.premiumCard` decorative classes. Removed every
`box-shadow` declaration and its `var(--shadow-*)` refs across ~24 `.module.css` files
project-wide (cards now use `border: 1px solid var(--gray-4)` where they need visual
definition, nothing where they don't); flattened two decorative gradient+overlay balance
hero cards (desktop + mobile Home) to solid `var(--accent-9)`; fixed 6 raw `color: white`
usages to `var(--accent-contrast)`. Fixed the `--bg-deep`/`--bg-panel` bug at its 3 usage
sites (`MobileLayout`, mobile `Login`, mobile `Register`) — these were dead dark-mode
overrides layered on top of already-correct Radix tokens (`var(--gray-1)`/`var(--color-panel)`
etc. already resolve per-theme), so the fix was deletion, not redefinition; same treatment
applied to 4 components using undefined `--glass-*` blur tokens (Sidebar, TopBar, mobile
AddTransactionModal, mobile BottomTabBar) — their solid base background was already correct,
the glass dark-mode override was the only broken/dead code. **Verified:** grep clean
project-wide (zero `#`/`rgb(`/`hsl(`/`box-shadow` in `*.module.css` outside intentional
token-scale definitions); `tsc --noEmit`, `lint:fix`, and `build` all clean; Playwright
screenshots of Home/Settings (desktop, light + dark) and Home/Login (mobile 390×844, light +
dark) confirmed no visually broken page — flat bordered cards, solid accent balance hero, no
undefined-variable gaps. Verified against a throwaway registered account, deleted after.

### [x] U2 — Login + Register rebuild — done 2026-07-17
**Goal:** first impression proves the system.
**Build:** both trees: centered single card (max 400px), app name, fields, ONE accent
button; register keeps username/confirm/show-hide/**country** + validation; errors
inline under fields (no toasts); Radix components only; keyboard: Enter submits.
**Note (D1 already landed part of this):** the country `Select` and Zustand-backed form
state (`registerFormSlice.ts`, `resetRegisterForm()` on mount) already exist and are
functionally correct — this ticket is a **visual restyle to the token system**, not a
rebuild from scratch. Don't recreate the field or the slice; re-skin what's there
(replace ad-hoc CSS module colors with `design-system.md` §1 tokens, apply the
centered-card/spacing rules) and verify the existing behavior still holds.
**Accept:** visual per `design-system.md` §1–2; login and register flows pass Playwright
in both viewports, light + dark; country picker and form-reset-on-mount still work
post-restyle.
**Depends:** U1.
**Result:** card width tightened to 400px (was 420px) on desktop in both trees; already
token-only/no-shadow from U1's pass, so no further color work needed. **Found and fixed
a rule violation while re-skinning:** `Login.tsx` (both trees) still held 5 separate
`useState` calls — a leftover from before the Zustand rule (`rules/zustand.md`: 2+ pieces
of local state → Zustand, not `useState`) was established and applied to `Register.tsx`
earlier this session. Since this ticket touches these exact files, fixed the inconsistency
rather than leaving it: added `loginFormSlice.ts` (mirrors `registerFormSlice.ts` —
fields, validation, `resetLoginForm()` on mount) and moved both `Login.tsx` files onto it.
**Also fixed the "no toasts" requirement literally**, which the previous implementation
didn't meet — server-side failures (bad credentials, duplicate email) went through
`toast.error()` on both Login and Register, in both trees. Added `formError` to both
`loginFormSlice` and `registerFormSlice`, rendered as an inline Radix `Callout.Root
color="red"` above the fields (no popup) — `react-hot-toast` import removed from all 4
files. **Found and fixed a pre-existing centering bug** (user noticed the desktop card was
pinned top-left, not centered, despite `.page { display: flex; align-items: center;
justify-content: center }` in the CSS): `main.tsx` imported `@radix-ui/themes/styles.css`
*after* `DesktopApp.tsx`'s transitive imports, so Radix's own `.rt-Box { display: block }`
landed later in the final stylesheet than the page's `.page` class — both single-class
selectors, so the cascade tie went to whichever rule was injected last, not to intent.
Confirmed via `getComputedStyle` + a `document.styleSheets` scan before fixing. Fix: moved
the two global stylesheet imports (`@radix-ui/themes/styles.css`, `./styles/index.css`) to
the top of `main.tsx`, above every component import, with a comment explaining why the
order matters — component CSS Modules must always be able to win ties against Radix's base
styles. This predates U1/U2 (the bug was already there when this session started); it
surfaced now because verifying U2's centering requirement is what caught it. Re-verified
Home and Settings (protected, `DesktopLayout`-wrapped pages) after the reorder to confirm
no other page was silently depending on the old, accidental order — both rendered
identically to before. **Verified:** `tsc --noEmit`, `lint:fix`, `build` all clean; Playwright — desktop
1280×900: triggered a real bad-credentials login and confirmed the inline Callout renders
(no toast), registered a throwaway account end-to-end (country picker + validation +
redirect to Home), form-reset-on-mount confirmed empty on revisit; mobile 390×844: Login
screenshot confirmed same flat/bordered/no-shadow treatment. Throwaway accounts deleted
after.

### [x] U3 — Home rebuild (desktop + mobile) — done 2026-07-18
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
**Found in T6 verification (2026-07-17):** the quick-add modal (opened from Home) saves
correctly but never force-refreshes Home's `accounts`/`transactions` slices on close —
balance and recent-activity look stale until the next navigation. The 30s staleness
skip above is the wrong tool for this; the modal's success handler must call
`fetchAccounts({ force: true })` / `fetchTransactions({ reset: true, force: true })`
(or equivalent) directly, not rely on time-based staleness.
**Found in D5 (2026-07-17), parking lot:** `AddTransactionModal.tsx` (both trees, used
from Home's "Add Transaction" button) has 6 `useState` calls — violates the current
Zustand rule (2+ pieces of local state → Zustand). This ticket touches the modal's
call site; converting its internal state to a slice (mirror `registerFormSlice.ts`) can
land here or in U8 (whichever actually edits the modal component first) — just don't
let both tickets skip it assuming the other handles it.
**Accept:** navigating away/back within 30s does not refetch (assert no loading flash);
credit no longer inflates the balance (test fixture + Playwright assertion); switching
profile shows entirely different data with the right currency formatting (Playwright,
user with US+IN fixture profiles); both viewports match §2 alignment rules.
**Depends:** U1, D1.
**Result:** `useHomeData` (`shared/hooks/`) is the one implementation of the
accounts/transactions/bills fetch + derived state, used by both trees. Staleness: added
an `isFresh(lastFetchedAt, thresholdMs=30_000)` helper to `namespaceSlice.ts` (shared,
not reimplemented per slice); `accountsSlice`, `transactionsSlice` (scoped to the plain
unfiltered `reset` call only — Activity's filtered/searched fetches always hit the
network), and `billsSlice.fetchUpcomingBills` all gained a `force` param + a
`lastFetchedAt` field and skip the refetch when fresh. Every mutation-triggered call
that must always be fresh (Bills.tsx create/update/delete, both trees) was updated to
pass `force: true` so staleness-gating a shared action didn't silently break them.
**Credit exclusion — found and fixed a sign bug while implementing it:** account balance
is computed backend-side as `income - expense` uniformly across account types
(`account_service.get_account_balance`), so a credit account's balance goes *negative*
as debt accrues (confirmed against a seeded fixture: a $500 charge produced `balance:
-500`, not `+500` as the ticket's "credit inflates the balance" framing implied).
`cashOnHand` sums checking/savings/cash only (credit never enters it, regardless of
sign); `creditOwed` negates the credit-type sum so the UI shows a positive "amount
owed." Verified via a seeded credit account + $500 expense: Home showed "Cash on hand
$0.00" / "Credit owed $500.00" as two separate stats, never summed into one number.
**Profile switcher:** `useProfileSwitch` (`shared/hooks/`) is shared cross-device logic
(switch + reload), used by desktop `TopBar.tsx`'s popover and a new mobile avatar row in
`Home.tsx`; both list every profile (flag + country name + currency, via new
`shared/utils/countries.ts`) with the active one highlighted, plus "Add {country}" for
any country the user doesn't already have a profile in. **Found and fixed a
cross-profile data-bleed bug while testing this**: `addProfile`'s own action switches
`activeProfileId` immediately but every already-mounted slice keeps showing the *old*
profile's data until something forces a refetch — confirmed live (added an India profile
while on US, currency symbol switched to ₹ but the account list still showed the US
credit card). Fixed by having `useProfileSwitch` reload the page after both
`switchProfile` and `addProfile`, matching the ticket's "clears cached slice data, and
reloads" — a full reload was the only way to guarantee no slice anywhere (not just
Home's three) keeps stale cross-profile data. **"Which country?" once**: `authSlice`
gained a `needsProfilePick` flag, set in `applyAuthResponse` only when there's no prior
`localStorage` choice AND 2+ profiles exist (checked *before* `resolveActiveProfile`
writes its own default, since that write would otherwise erase the "first ever login"
signal). Rendered as a new shared `ProfilePickPrompt` (`shared/components/` — logic-only
cross-device gate, same exception as `ProtectedRoute`, not a DRY violation per
`rules/frontend.md`), mounted once in `main.tsx` alongside `DesktopApp`/`MobileApp`. Also
reloads on choice, for the same data-bleed reason as above (the page underneath started
fetching under the auto-resolved default the instant it loaded, before the user's actual
pick lands). **Quick-add force-refresh + Zustand conversion:** added
`quickAddModalSlice.ts` (mirrors `registerFormSlice.ts`/`loginFormSlice.ts`) and moved
both `AddTransactionModal.tsx` files off their 6 `useState` calls onto it — this ticket
was the first to touch the modal, so per the parking-lot note it landed here rather than
deferring to U8. Save success now calls `fetchAccounts({force:true})`,
`fetchTransactions({reset:true,force:true})`, `fetchUpcomingBills(30,{force:true})`
directly. **Mobile IA narrowed to spec**: mobile Home dropped the Accounts list and
Recent Activity sections it had been duplicating from desktop — design-system.md's
mobile table specifies hero + next-3-bills + this-month-vs-last only ("mobile
restraint"); "this month vs last" uses `reportsSlice.comparison` (already fetched
data, no new endpoint). **Raw-tag cleanup**: both `Home.tsx` files converted fully to
Radix components (`Box`/`Flex`/`Text` in place of `div`/`span`, `Text onClick` in place
of a raw `button` for "See all" — matches the pattern mobile Home already used); the
`Sidebar.tsx` raw-tag item logged earlier in the parking lot is untouched since this
ticket never needed to edit that file. **Verified:** `tsc --noEmit`/`lint`/`build` clean
throughout (including after each of the three bugs found and fixed above); Playwright —
desktop 1280×900 and mobile 390×844, light + dark: registered a throwaway user, seeded a
real credit account + $500 transaction directly in Postgres (no `balance`/`currency`
column on `accounts` — balance is computed live from transactions, confirmed via
`\d accounts` and `account_service.py`) to verify the cash/credit split against real
data; added a second (India) profile and switched both directions confirming full data
isolation each time; cleared `localStorage` and reloaded to trigger the "Which country?"
prompt from a clean first-login state and confirmed the reload-on-pick fix. Throwaway
account (cascades to its profiles/accounts/transactions) deleted after.

### [x] U4 — Activity rebuild (desktop + mobile) + shared logic extraction — done 2026-07-18
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
**Result:** Backend — wired D3's `services/ingest/dedup.py` into
`POST /api/transactions/import` for real (its docstring explicitly deferred this to U4):
per row, exact `import_hash` match → auto-skip + counted (`exact_skipped`); fuzzy match →
held out of insertion and returned in a new `pending_review` array (row + candidate
matches with similarity) instead of blind-inserting; no match → inserted with its
`import_hash` recorded. Added `skip_dedup` to `TransactionImport` so a reviewed
"keep both" row can be resubmitted bypassing the gate while still recording its hash for
future exact-dup detection. **Found and fixed a pre-existing bug while testing this end
to end**: the frontend sends `date.toISOString()` (tz-aware, UTC) but
`transactions.date` is `timestamp without time zone` — asyncpg can't insert a tz-aware
value into a naive column ("can't subtract offset-naive and offset-aware datetimes").
Every CSV import via the browser was silently failing on every row before this fix (the
UI showed no error because nothing surfaced the per-row failures); this predates U4 —
confirmed via `git show` that the previous commit's import endpoint passed `tx.date` the
same raw way. Fixed by normalizing to a naive datetime once per row.
**Frontend — extraction:** `shared/hooks/useTransactionFilters.ts` (search/filter state +
categories/merchants, now read from `categoriesSlice.flat`/`merchantsSlice.items`
instead of `transactionsSlice`'s own duplicate `fetchTxFilters()`, which cast the
categories endpoint's nested tree straight to a flat list — subcategories never showed
in the filter dropdown; fixed for free by reading the already-correctly-flattened
slice), `useTransactionList.ts` (infinite scroll + optimistic mutations +
staleness-aware `refetch`), `useCsvImport.ts` (parsing, column auto-detect, the review
queue). **transactionsSlice.ts state cleanup**: `updateNotes` now actually reverts on
failure (previously had a `// revert on failure` comment with no code under it — real
bug, real fix); `deleteTransaction` restores at its original index via `findIndex`
instead of appending to the list tail (was breaking the date-sort order on a failed
delete); every catch block now calls `toast.error(...)` (were silent); duplicate
`categories`/`merchants`/`fetchTxFilters` deleted entirely. **Desktop** (372 lines) split
into `TransactionDetailDialog.tsx` (413 lines) and `ImportDialog.tsx` (225 lines) to hit
the <400-line target while keeping every existing feature (view/edit/notes/bill-link) —
added the new bulk-select mode (checkbox per row, floating bulk-edit bar,
category/account reassignment via `Promise.all` over `saveTransaction`) and the
dedup review queue UI (Skip/Merge/Keep-both per fuzzy match — merge and skip produce the
same backend outcome since there's no per-field merge target in this schema, kept as
distinct labels since the choice still means something to the user). Also found and
fixed a duplicated column-type-classification snippet between `useCsvImport.buildRows()`
and the preview table (copy-pasted while extracting) — consolidated into one exported
`classifyImportType()`. **Mobile** (311 lines) narrowed to the ticket's literal spec —
card list, search, simple filters, swipe-to-delete, tap-to-view (notes-edit + delete
only) — dropping CSV import, the full edit form, and bill-linking entirely as
desktop-only power-user features, consistent with U3's "mobile restraint" precedent.
**Verified:** `tsc --noEmit`/`lint`/`build` clean throughout; Playwright (desktop
1280×900) — imported a 3-row CSV (correct amounts/types after the date-tz fix),
re-imported the identical file and confirmed the count stayed at 3 (zero duplicates,
exact-match auto-skip working), imported a 4th row with a near-duplicate description
and confirmed the fuzzy review queue appeared with a 67%-similarity match, used "Keep
both" and confirmed it landed as a genuinely separate 4th transaction; bulk-selected 2
rows and reassigned their category, confirmed via full page reload (bypassing the
30s staleness cache) that it persisted server-side and subcategories now appear in the
filter/bulk-edit dropdowns; forced a real backend outage mid-save on a notes edit and
confirmed the inline error toast fired and the notes field came back empty (not the
failed draft) on reopen — the real revert now works, not just the comment claiming it
did. Mobile 390×844 spot-checked for the narrowed layout. Throwaway accounts (and their
cascaded transactions) deleted after.

### [x] U5 — Recurring page (desktop, new) — done 2026-07-18
**Goal:** bills + budgets in one "what repeats" view (subscriptions section lands in I2).
**Build:** sections: Upcoming (bills with next date, paid ✓), All recurring (bills table:
name, amount, frequency, monthly-equivalent cost, total-per-month headline), Budgets
(progress per §4 — Radix Progress, accent only when on-track-action needed). Bill CRUD
dialogs migrate here; old Bills/BillDetail pages retire when this lands.
**Accept:** every old Bills-page capability reachable here; total-per-month headline is
the Decimal-exact sum of monthly equivalents (weekly ×52/12 etc. — verify against a
seeded fixture of mixed-frequency bills, hand-checked); Playwright both viewports
(mobile: page doesn't exist — verify absence + bills still visible on mobile Home).
**Depends:** U1.
**Result:** `desktop/pages/Recurring/` (new) — `Recurring.tsx` (Upcoming card unchanged
from the old Bills page, an `All Recurring` `Table.Root` with a `Monthly equivalent`
column, and a read-only `Budgets` section rendering `budgetsSlice.items` as Radix
`<Progress>` bars), `BillFormDialog.tsx` (new — one dialog for create+edit, replacing
the ~90-line duplicated field sets from the old Bills.tsx, `bill: Bill | null` decides
mode), `BillDetail/BillDetail.tsx` (moved, `any`-typed props replaced with the exported
`Bill` type, raw `<div>` skeleton placeholders converted to `Box`). Old
`desktop/pages/Bills/` deleted outright. **Monthly-equivalent math**
(`shared/utils/money.ts`, new): every conversion done in integer cents
(`Math.round(amount*100)`), never raw float dollars — each bill's monthly-equivalent is
rounded independently (the number shown on its row), and the "Total per month" headline
sums those already-rounded per-row cents rather than an independent float sum, so the
headline always exactly equals what you get by hand-adding the visible rows (the
literal "Decimal-exact... hand-checked" requirement). Frequency ratios:
weekly ×52/12, biweekly ×26/12, monthly ×1, quarterly ÷3, yearly ÷12 — confirmed the
`yearly` (not `annual`) string value against the backend's `Literal[...]` constraint
before writing the lookup table. **Budget progress color** follows the ticket's "accent
only when on-track-action needed" instruction, translated from design-system.md §1's
accent-scarcity + semantic-money-color rules (no single line in the doc uses that exact
phrase, but the derivation is direct): neutral slate while comfortably under 80% spent
(no action needed), accent orange from 80–100% (a nudge), red past 100% (over budget,
same semantic as negative money elsewhere). **Routing**: `/recurring` replaces `/bills`
in `DesktopApp.tsx`; `/bills` and `/bills/:id` now redirect to `/recurring` (old
bookmarks/links keep working); `Sidebar.tsx`'s nav item swapped (Receipt icon → Repeat,
label → "Recurring") and — since this ticket was already editing that file — its raw
`<div>`/`<span>`/`<button>` tags were converted to `Box`/`Text`/`Button` (this predates
Phase U and was logged in U3's parking-lot note as "fix whichever ticket next touches
Sidebar.tsx"). Desktop Home's "Upcoming Bills → See all" link updated from `/bills` to
`/recurring`. **Logged, not fixed** (found while editing Sidebar.tsx, genuinely
out of scope for this ticket): `.addButton`/`.logoIcon` in `Sidebar.module.css` still
use a raw `linear-gradient(135deg, accent-9, accent-10))` — U1's shadow/hex sweep didn't
catch it since that ticket specifically grepped for `box-shadow`/hex colors, not
gradients; flagged for whichever ticket next revisits Sidebar's visual treatment.
**Verified:** `tsc --noEmit`/`lint`/`build` clean; Playwright desktop 1280×900 — created
5 bills through the actual UI (not seeded directly) covering all five frequencies
($50 weekly, $100 biweekly, $75 monthly, $300 quarterly, $1,200 yearly), hand-computed
expected total $708.34 ($216.67+$75.00+$100.00+$216.67+$100.00) before looking, watched
the running headline match at every intermediate step (after 1 bill: $216.67, after 2:
$433.34, after 3: $508.34, after 4: $608.34, after 5: $708.34) and confirmed the final
per-row and headline numbers exactly — genuinely hand-checked, not just eyeballed after
the fact; opened the moved `BillDetail` dialog and confirmed it still renders; seeded a
budget via direct DB insert (no budget-creation UI exists yet — out of scope, this
ticket only required rendering `budgetsSlice`) plus an over-limit expense transaction
and confirmed the Progress bar renders red with the over-budget amount, capped at 100%
width. Confirmed `/bills` → `/recurring` redirect. Mobile 390×844: navigating to
`/recurring` falls through `MobileApp`'s route tree (which never had that path) to the
existing catch-all → `/login`, same as any other invalid mobile path — confirms the
page genuinely doesn't exist there; logged back in and confirmed mobile Home's
"Upcoming Bills" section (built in U3) shows the identical 3 near-term bills with the
same amounts as desktop. Throwaway account (cascades to its bills/budgets/transactions)
deleted after.

### [x] U6 — Insights page (desktop, new) — done 2026-07-18
**Goal:** absorb Reports + Categories analytics.
**Build:** period selector (month/year); breakdown by category and by merchant (Nivo,
§1 rule 3 colors: sorted slate bars, top item accent — replace rainbow pies); MoM and
YoY comparison cards; annual view (12-month Nivo bar); **an interactive spending
timeline** — scrub across months, each point shows the category breakdown for that
month on hover/tap (data-storytelling pattern, `design-system.md` §0/§3, replaces the
old static "one table per month" reporting feel). Old Reports page + Categories
analytics tab retire.
**Accept:** numbers match `/api/reports` exactly (cross-check one month by hand in test);
charts are Nivo-only, palette-compliant; timeline scrub updates the breakdown without a
page reload; Playwright desktop (+ absence on mobile).
**Depends:** U1. (D4 was retired — profiles are single-currency by construction, so
reports have nothing to convert; do not reintroduce a currency-conversion dependency here.)
**Result:** Backend (`backend/routers/reports.py`): added a `_month_bounds(year, month)`
helper (DRY — replaces month-boundary math that was inlined 3+ times) and used it to
refactor `monthly_report`; extended `GET /categories` with optional `year`/`month` query
params that scope to one calendar month (falls back to the existing rolling `days` window
when omitted — backward compatible with Home's usage); added a new `GET /merchants`
endpoint mirroring `/categories`' shape/logic exactly (`GROUP BY t.merchant_id, m.name`);
extended `GET /comparison` with `mode: Literal["mom", "yoy"]` so the previous period is
either the prior calendar month or the same month last year, reusing the existing
`_period_totals`/`_pct_change` logic for both. Frontend
(`store/slices/reportsSlice.ts`): extended purely additively — `monthly`, `summary`,
`categories`, `comparison`, `loading`, and `fetchReports()` (Home's exact dependency,
both trees) were left untouched; added `periodCategories`, `periodMerchants`,
`periodComparisonMoM`, `periodComparisonYoY`, `periodLoading`, and actions
`fetchMonthly(year)`, `fetchInsightsPeriod(year, month)` (parallel fetch of
categories/merchants/comparison-mom/comparison-yoy), `fetchCategoriesForMonth(year, month)`
(returns directly without mutating state — feeds the timeline's local hover cache).
`desktop/pages/Insights/` (new): `Insights.tsx` (main page — month/year `Select`
dropdowns, 3 stat cards derived from `periodComparisonMoM.current_*` rather than a
separate summary fetch, two `ComparisonCard`s, two `BreakdownChart` cards, one
`AnnualTimeline` card), `BreakdownChart.tsx` (shared sorted horizontal `ResponsiveBar` —
top item `var(--accent-9)`, rest `var(--gray-7)`, per §1 rule 3 — used by category
breakdown, merchant breakdown, and the timeline's hover panel), `ComparisonCard.tsx`
(shared by MoM/YoY; fixed a self-caught bug where naive `pct > 0 → green` coloring was
backwards for the Expenses row — an expense increase is bad news — via a per-field
`goodDirection` multiplier), `AnnualTimeline.tsx` (one 12-month grouped
`ResponsiveBar`, `keys={['income','expense']}`, deliberately serving both the "annual
view" and "interactive timeline" bullets as a single chart rather than two redundant
ones, documented inline; `onMouseEnter` previews a month's category breakdown via a
`useRef` cache + `fetchCategoriesForMonth`, `onClick` pins it as the page's selected
month). `Categories.tsx` (desktop): removed the `Tabs.Root` analytics tab
(`ResponsivePie` fed by `spendingSlice`) entirely, page now always renders what was the
list tab; mobile's own `Categories.tsx` still uses `categoriesSlice`'s
`spending`/`fetchSpendingByCategory` for its own pie chart, so that slice was left
untouched. `desktop/pages/Reports/` deleted outright. Routing: `/reports` → `/insights`
in `DesktopApp.tsx`, old `/reports` links redirect; `Sidebar.tsx`'s nav item relabeled
Reports → Insights (icon unchanged, `BarChart3`). **Verified:** `tsc --noEmit`/lint/build
clean. Seeded a precise SQL fixture (June 2026 current, May 2026 previous month, June
2025 same month last year) with known amounts, hand-computed every expected value
(income/expense/net, MoM and YoY % for all three fields, category breakdown sort order)
before looking at the UI — every displayed number matched exactly, including the
expense-color-direction fix (June's MoM expense change showed "+40%" in red, correctly
read as bad news). Timeline interactivity verified via synthetic `MouseEvent` dispatch
against `svg rect` elements (Nivo bars aren't individually addressable via the
accessibility tree) — hover updated the side-panel breakdown without a page reload,
click jumped the page's selected month and re-fetched its period data. Confirmed
`/reports` → `/insights` redirect. Mobile 390×844: `/insights` falls through
`MobileApp`'s route tree (which never had that path) to the catch-all → `/login`,
confirming the page doesn't exist there; mobile's own Reports page (kept per the design
system, out of scope for this ticket) is unaffected. Throwaway account (cascades to its
transactions) deleted after; scratch screenshots and `.playwright-mcp` cleaned up.

### [x] U7 — Manage page (desktop, new) — done 2026-07-18
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
**Result:** `desktop/pages/Manage/` (new) — `Manage.tsx` (Radix `Tabs.Root`, 7 tabs) plus
new `AccountsTab.tsx`, `ImportTab.tsx`, `AiPrivacyTab.tsx`, `AccountTab.tsx`. The
Categories/Merchants/Goals tabs mount the SAME components the old standalone routes
used, unmodified (each is already a self-contained CRUD page wired to its own store
slice) — not reimplemented, avoiding ~1400 lines of redundant re-derivation. Old
`desktop/pages/Settings/` deleted outright; `/settings`, `/categories`, `/merchants`,
`/goals` now redirect to `/manage` (old bookmarks keep working, same pattern as
U5/U6); `Sidebar.tsx`'s four separate nav items collapsed into one "Manage" entry
(`Settings` icon). **Accounts tab**: migrated from the old Settings page, delete
confirmation converted from a generic `Dialog` to `AlertDialog` per the accept
criterion. **Budgets**: NOT a Manage tab (not in the ticket's tab list) — the old
Settings page's only working Budget CRUD was migrated into `Recurring.tsx` instead,
converting U5's read-only Budgets section (which explicitly logged "no
budget-creation UI exists yet — out of scope" as a parking-lot note) into full
create/edit/delete, AlertDialog for delete. This was necessary to satisfy "every
capability of the four retired pages reachable" without inventing an off-ticket tab,
and closes U5's logged gap. **Import tab**: reuses the same `useCsvImport` hook +
`ImportDialog` component Activity (U4) already mounts — a second legitimate consumer
of a shared hook, not duplicated logic; Activity's own "Import CSV" button was left in
place rather than removed, since deleting a working, convenient entry point wasn't
required by the ticket and would have been a regression. **AI & Privacy tab**: T5
toggle migrated as-is (working). The "Ollama endpoint" half of this tab was
deliberately NOT built — no backend field exists to persist it and no code path
consumes it yet (S1/S2/T6, which introduce the actual local Ollama client, haven't
landed); an input with nowhere for the value to go is exactly the "no half-finished
implementations" pattern to avoid. Flagged for whichever of S1/S2/T6 lands the Ollama
client. **Account tab**: profile display (unchanged), a new `PUT /auth/me/password`
backend endpoint (`backend/routers/auth.py` — verifies current password via
`verify_password`, rehashes with `get_password_hash`) plus `authSlice.changePassword`
frontend action wired to a real form (this is new functionality, not a migration — the
old Settings page never had password change — but was explicitly named in the
ticket's Build line and is small/self-contained, unlike the Ollama field); "Add
country" reuses the existing `useProfileSwitch` hook (the same one `TopBar.tsx`'s
profile popover already used) to list profiles and add a country inline in the
settings page itself, not just the top-bar dropdown — D1's `POST /auth/profiles`
endpoint already existed and needed no changes. **Two real, pre-existing bugs found
and fixed while verifying this ticket's required Playwright flows** (both blocked the
literal accept-criterion flows, not just cosmetic): (1) `Categories.tsx` (desktop AND
mobile — same bug in both trees) treated `categoriesSlice.tree` as a flat list
(`tree.filter(c => c.parent_id === parentId)`), but the backend actually returns a
nested tree where each node carries its own `.children` — every category always
showed "0 subcategories" for every user, unconditionally. Fixed by using
`parent.children` directly in both `desktop/pages/Categories/Categories.tsx` and
`mobile/pages/Categories/Categories.tsx`. (2) `merge_merchants` in
`backend/services/merchant_service.py` wrote the `aliases` jsonb column with a raw
Python list (`asyncpg.exceptions.DataError: invalid input... expected str, got
list` — no jsonb codec is registered on this connection pool) and, once that write
path was fixed with `json.dumps`, the read path in both `_row_to_merchant`
(services/merchant_service.py) and `_to_response` (routers/merchants.py) then failed
Pydantic validation on the raw JSON-text string coming back — fixed with an explicit
`json.loads` guard at both read sites. Every merge attempt before this fix failed
outright. **Verified:** `tsc --noEmit`/lint/build clean. Playwright desktop 1280×900,
throwaway account: created a "Coffee Shops" child under "Food & Dining" through the
Categories tab and confirmed it rendered nested under its parent with the correct
count (the exact flow the tree bug above was blocking); seeded two merchants via SQL
fixture at a hand-computed 67% Jaccard similarity ("Amazon Prime" / "Amazon Prime
Video", intersection 2 / union 3), ran Find Duplicates, confirmed the "67% match" card,
merged them, and confirmed the result — one merchant, 2 transactions, $23.98 total
(exactly $14.99 + $8.99) — the exact flow the aliases bug above was blocking; created
a Goal, added a $250 contribution, confirmed the card updated to "25% complete,
$250.00 / $1,000.00"; created and AlertDialog-deleted a second Account; created,
edited ($300→$350), and AlertDialog-deleted a Budget on the Recurring page; changed
password through the Account tab and confirmed login with the new password succeeded
(logged out, logged back in with it); added an India country profile via the Account
tab's inline "Add" button, confirmed the page reloaded into the new profile (₹
currency) and the Countries list showed US as "Switch"-able and India as "(active)";
opened the Import tab's dialog and confirmed it renders the same upload flow as
Activity's; toggled the AI & Privacy switch on and off, confirmed both toast
directions. Confirmed `/settings`, `/categories`, `/merchants`, `/goals` all redirect
to `/manage`. Mobile 390×844: `/manage` falls through `MobileApp`'s route tree (which
never had that path) to the catch-all → `/login`, same pattern as U3/U5/U6. Throwaway
account (cascades to its accounts/categories/merchants/goals/transactions across both
country profiles) deleted after; scratch screenshots and `.playwright-mcp` cleaned up.

### [x] U8 — Mobile capture flow + mobile page retirement — done 2026-07-18
**Goal:** mobile = Home/Activity/Capture, nothing else.
**Build:** center tab button → bottom sheet: **Type** (NL quick-add with preview,
following the one-question rule in `design-system.md` §4 — amount missing → one inline
"How much?" follow-up; date/category/account never asked, only correctable in preview)
and **Scan** (disabled with "coming with document scanning" note until S6). The Type
sheet is built on the same `AddTransactionModal` logic as desktop — if U3 hasn't
already converted its 6 `useState` calls to a Zustand slice (parking lot, found in D5),
do it here; don't duplicate ad-hoc state in a second place. Delete mobile
Categories/Merchants/Reports/Goals/More pages + routes (redirect to `/`); tab bar
becomes Home · Capture · Activity; settings via avatar on Home.
**Accept:** two taps from any screen to a saved typed transaction (Playwright 390×844);
deleted routes redirect; no dead imports/CSS remain.
**Depends:** U3, U4.
**Result:** Confirmed both mobile `AddTransactionModal.tsx` (Type flow) and desktop's
copy already consume the shared `quickAddModal` Zustand slice, not local `useState` —
that parking-lot item was already resolved before this ticket, nothing to convert.
`mobile/components/CaptureSheet/` (new): a bottom-sheet `Dialog` with two option
cards — **Type** closes the sheet and opens the existing `AddTransactionModal`
(`openAddModal`); **Scan** is rendered disabled with "Coming with document scanning"
(no interaction, per-ticket — the receipt-OCR camera icon already inside the Type
flow is a separate, already-shipped raw-text-scan feature, not the structured
document-extraction S6 will add, so it was left alone). New `ui.captureSheetOpen`
state + `openCaptureSheet`/`closeCaptureSheet` actions added to the existing shared
`uiSlice` (harmless no-op on desktop, same slice desktop's `addModalOpen` already
lives in). `BottomTabBar.tsx`: down to Home / Capture / Activity — Bills and More tabs
removed; the center button now opens the capture sheet instead of jumping straight to
`AddTransactionModal`. **One-question rule, actually implemented** (was previously
just descriptive text with no real follow-up path): backend `/parse` already returned
`missing: ["amount"]` when text had no amount, but `QuickAddRequest` had no field to
carry a corrected value back, so `/quick-add` just 400'd. Added `amount: float | None`
to `QuickAddRequest` and `backend/routers/transactions.py`'s `quick_add_transaction` —
when provided, it overrides whatever amount parsing produced (or bypasses the "could
not parse an amount" error entirely) rather than being silently ignored. Mobile
`AddTransactionModal.tsx`: when `parsed.missing` includes `"amount"`, the amount
display becomes an inline `TextField` ("How much?") instead of read-only text — the
one and only follow-up; category/merchant/type stay exactly as parsed, correctable via
the existing popover, never asked as a second question. `Confirm & save` disabled
until that field is filled. New `quickAddModal.manualAmount` state +
`setQuickAddManualAmount` action (same slice, same convention as the rest of that
modal's state — not a second ad-hoc `useState`). Exported `getCurrencySymbol` from
`shared/utils/format.ts` (previously a private `CURRENCY_SYMBOL` map only
`formatCurrency` could see) so the inline field's `$`/`₹`/`C$` prefix matches the
profile's currency instead of hardcoding `$`. **Desktop's copy of
`AddTransactionModal.tsx` was left untouched** — same latent one-question gap exists
there too, but U8 is scoped to mobile; flagged for whichever ticket next revisits the
desktop quick-add modal. **Page retirement**: deleted
`mobile/pages/{Categories,Merchants,Reports,Goals,More}/` and their CSS outright, plus
`mobile/components/FAB/` (already fully dead — unreferenced anywhere, matching
`plan.md`'s "duplicate FAB" Phase-U cleanup note). **Also retired `mobile/pages/Bills/`
and `/bills`**, though it wasn't named in this ticket's explicit Build-line list: the
Goal line is unambiguous ("Home/Activity/Capture, nothing else") and Bills had its own
BottomTabBar slot being removed with nothing to replace it — mobile Home's "Upcoming
Bills" preview (U3) already covers the only thing Bills' standalone page did, and
leaving an orphaned, unreachable-except-by-URL page behind would violate this same
ticket's "no dead imports/CSS remain" criterion. `MobileApp.tsx`: routes for all six
retired pages (`/bills`, `/bills/:id`, `/goals`, `/categories`, `/merchants`,
`/reports`, `/more`) redirect to `/`; `/settings` kept as a real route (not deleted,
not a tab — reached only via Home's avatar, which already routed there before this
ticket, satisfying "settings via avatar on Home" with no changes needed there).
**Logged, not fixed** (found while rewriting `BottomTabBar.module.css` for the new
2-tab + center-button layout, out of scope for this ticket): `.addButton`'s raw
`linear-gradient(135deg, accent-9, accent-10)` was the exact "duplicate/off-palette
gradient" class of issue U1's hex/shadow sweep didn't catch (same root cause as the
Sidebar gradient U5 logged) — fixed here anyway since the file was already being
rewritten line-by-line, swapped for flat `var(--accent-9)`. **Verified:** `tsc
--noEmit`/lint/build clean (module count dropped 1100→1086, confirming the deleted
pages' code is actually gone, not just unreachable). Playwright 390×844, throwaway
account: tapped Capture → Type → typed "spent 42 on groceries" → Parse → Confirm & save
— transaction appeared in Activity as "Groceries, Food & Dining, -$42.00" (two taps,
Capture then Type, to reach the point of a saved typed transaction). Repeated with
"coffee at starbucks" (no amount) — confirmed the parse response's `missing: ["amount"]`
correctly triggered the inline "How much?" field in place of the amount display, typed
6.50, confirmed `Confirm & save` was disabled beforehand and enabled after, saved, and
confirmed in Activity as "Coffee at starbucks, Starbucks, Food & Dining, -$6.50" —
proving the backend override path actually works end-to-end, not just that the UI
renders. Confirmed all six retired routes (`/bills`, `/goals`, `/categories`,
`/merchants`, `/reports`, `/more`) redirect to `/`. Confirmed Settings is still
reachable via the Home avatar tap. Throwaway account (cascades to its transactions)
deleted after; scratch screenshots and `.playwright-mcp` cleaned up.

### [x] U9 — Folder consolidation + final sweep — done 2026-07-18
**Goal:** target structure from `architecture-and-goals.md`; nothing retired survives.
**Build:** merge `src/auth`, `src/hooks`, `src/utils` into `shared/` (api/hooks/types/
utils); update imports; delete all retired pages/components/CSS; dark-mode audit
(Playwright screenshot every route, both viewports, both themes); alignment audit
against §2.
**Accept:** `desktop/`+`mobile/` contain only `.tsx`+`.module.css`; build green; no
unused files (depcheck + manual); screenshots reviewed.
**Depends:** U2–U8.
**Result:** `src/auth/`, `src/hooks/`, `src/utils/` deleted outright; contents
redistributed to match the target tree exactly. `shared/types/user.ts` (new) — `User`,
`Country`, `Profile` (pure domain types, used well beyond auth — TopBar, Register,
Manage/AccountTab, Home, `registerFormSlice`); `AuthState`/`AuthActions` moved into
`store/slices/authSlice.ts` itself instead, matching how every other slice
(`accountsSlice`, `budgetsSlice`, ...) already defines its own state/action types
inline — `auth/types.ts` was the only outlier. `shared/api/client.ts` (new) — the bare
axios instance, mirroring the old `auth/api.ts` exactly (14 call sites updated).
`shared/api/interceptors.ts` (new) — the request/response interceptor setup
(token/profile-id headers, 401 refresh-and-retry) split OUT of the old
`auth/authContext.tsx` into its own side-effect module, imported once from
`main.tsx` — NOT from `client.ts` or any slice, deliberately, because it depends on
`useBoundStore` and slices import `api` from `client.ts`; merging them would have
created `authSlice → client.ts → useBoundStore → authSlice`, a real import cycle.
`shared/hooks/useAuthBootstrap.ts` (new) — the one-time `verifyToken()` call, also
extracted from `authContext.tsx`. The old `AuthContext`/`useAuth()`/`AuthProvider`
wrapper was dropped entirely rather than relocated: `useAuth()` had zero consumers
anywhere in the codebase (confirmed via search before deleting) — dead code, not a
migration target. `shared/hooks/useMediaQuery.ts` and `shared/utils/ocr.ts` moved
as-is (3 call sites total). `main.tsx` updated to match: side-effect import of
`interceptors.ts`, `useAuthBootstrap()` called from `AppRouter`, no more
`AuthProvider` wrapper. A background Explore-agent pass cross-checked every
`.ts`/`.tsx` file's basename against every import in the tree afterward — zero orphan
files found, confirming the migration didn't leave anything stranded.
**Toast system replaced** (user request, mid-ticket): `react-hot-toast` (an npm
dependency) was swapped for `@radix-ui/react-toast` — not a new package, already
present in `node_modules` as a transitive dependency of `@radix-ui/themes` and now
declared explicitly in `package.json`. New `store/slices/toastSlice.ts` (a plain
queue — Radix's own `Toast.Provider duration` prop owns auto-dismiss timing with
pause-on-hover/focus, not reimplemented), `shared/utils/toast.ts` (a `toast.success()`
/`toast.error()` module-level API matching react-hot-toast's exact call shape, so all
15 existing call sites needed only an import-path swap, not a rewrite — same
outside-React-calling-into-the-store pattern `interceptors.ts` already uses), and
`shared/components/ToastHost/ToastHost.tsx` (new — renders the queue through Radix's
unstyled Toast primitives, styled with the app's own color tokens, no raw hex).
Position iterated live with the user from the initial top-right placement to
bottom-center (both viewports; mobile variant clears the bottom tab bar via a
`64px`-aware `env(safe-area-inset-bottom)` offset). `react-hot-toast` fully removed
from `package.json`/lockfile/both node_modules copies (host + container, resynced via
`npm install` in each).
**Alignment audit against §2**: found one real, sitewide gap — no file anywhere set
`font-variant-numeric: tabular-nums` despite §2's explicit "Numbers" rule, so money
digits could jitter/misalign as they update. Fixed with one global rule on `body` in
`styles/index.css` (safe as a blanket default — the property only affects how numeral
glyphs render, has no effect on non-digit text). Manually swept `.module.css` files
for raw px margins/paddings outside the space-token scale — the few hits found
(`DesktopLayout`'s `240px` sidebar width, `BottomTabBar`'s `-12px` FAB offset,
`MobileLayout`'s `80px` tab-bar clearance) are all pre-existing, deliberate structural
constants matching the spec's own numbers, not spacing violations, so left as-is.
**Verified:** `tsc --noEmit`/lint/build clean throughout (module count settled at 1092
after the toast-system swap); `npx depcheck` — no issues; dead-file agent pass — no
orphans. Dark-mode + alignment audit: Playwright screenshots across every distinct
route on both trees (desktop: Home/Activity/Recurring/Insights/Manage/Login in light,
Home/Insights/Manage in dark; mobile: Home/Activity/Settings/Login/CaptureSheet in
dark, Home in light) — every page held its 4-vertical-line alignment, cards matched
anatomy (flat, `--radius-card`, 1px `gray-4` border, no shadows), numbers stayed
right-aligned, and the theme switch never left a stray light-mode color behind. New
toast visually confirmed end-to-end (triggered via the AI & Privacy toggle, both
success/error variants, both viewports, swipe-to-dismiss and the ✕ button both
verified). Throwaway account (cascades to its transactions) deleted after; scratch
screenshots cleaned up.

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
local AI (if Ollama present) or Gemini (if the user's T5 toggle is on) may rephrase
only, never invent numbers. Top 3–5 cards on desktop Home with dismiss; each card
**shows its evidence inline or one tap away — never a bare claim** (transparent-AI
requirement, `design-system.md` §0/§4); text generated by AI (local or cloud) is
visually marked as such, distinct from a plain rule-based card; dismissing a card
suppresses that insight *type* going forward, not just that instance.
**Accept:** with Ollama absent and toggle off everything still renders (templates); no
card ever shows a number that isn't in its evidence payload (test the generator);
AI-worded cards are visually distinguishable from template cards (Playwright); dismiss
persists and suppresses recurrence (test).
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

- README structure/feature sections still describe the pre-rebuild app (finish in T4).
- `docs/DEVELOPMENT.md` §2 backup script: create `scripts/backup.ps1` when backups
  activate (gate: before first real data — see plan.md Later).
- **Timezone**: backend containers run UTC; "yesterday" typed at 11pm EDT resolves
  against UTC-today. Fix candidate: client sends its local date with parse/quick-add
  requests (fold into U-phase quick-add work), or set container TZ.
- **Port 3000 IPv6 clash**: another dev server bound to `[::1]:3000` shadows the app for
  `localhost` URLs — use `http://127.0.0.1:3000` (documented here so nobody debugs it twice).
- Saving a transaction from the Quick Add dialog doesn't refresh Home's already-mounted
  slices (needs reload) — already covered by U3's staleness/refresh work.
- Desktop Settings renders the Profile card twice (duplicate block) — retires with U7 anyway.
- **`AddTransactionModal.tsx` (both trees) has 6 `useState` calls** (`input`, `loading`,
  `parsed`, `saving`, `scanning`, `selectedCategoryId`) — violates the current Zustand
  rule (2+ pieces of local state → Zustand, `rules/zustand.md`). Found while adding the
  D5 merchant-preview field; out of D5's scope to fix. **Now assigned**: a
  `quickAddModalSlice.ts` mirroring `registerFormSlice.ts` — lands in U3 or U8,
  whichever actually edits the modal first (both tickets now reference this note so
  neither assumes the other handles it).
- **Raw HTML tags where `rules/frontend.md`'s Radix tag-replacement map requires a
  component**: `Home.tsx` (both trees) uses raw `<div>`/`<span>`/`<button>` throughout
  (accounts list, transaction rows, section headers, skeleton placeholders);
  `desktop/components/Sidebar/Sidebar.tsx` uses a raw `<div>` for the logo mark, a raw
  `<span>` for the logo text and nav-item labels, and a raw `<button>` for "Add
  Transaction". Found auditing Radix compliance after U1/U2 (2026-07-17) — Login/Register
  in both trees were checked and are clean, this is pre-existing in pages Phase U hasn't
  reached yet. Out of scope to fix ad hoc: Home's raw markup gets replaced as part of its
  actual rebuild (U3); Sidebar isn't its own ticket yet — whichever ticket next touches
  `Sidebar.tsx` (U3's profile-switcher work is the most likely candidate, since it lands
  in the sidebar) should convert it to `Box`/`Text`/`Button` while it's already being
  edited, rather than as a separate pass. (Not a violation: `AddTransactionModal.tsx`'s
  raw `<input type="file">` — Radix Themes has no file-input primitive, so that one stays.)
