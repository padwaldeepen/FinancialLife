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

### [x] I1 — Recurring detection engine — done 2026-07-22
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
**Result:** `backend/services/insights/recurring.py` (new, pure functions, no DB access
— `detect(transactions: list[TransactionInput]) -> list[RecurringCharge]`) +
`backend/routers/insights.py` (new, `GET /api/insights/recurring`, registered in
`main.py`). **Test approach**: per T1's established project decision ("no pytest
files — all verification via Playwright MCP / hand-computed fixtures against the
running app"), verified via a throwaway fixture script (deleted after) asserting
exact values, then re-verified against the live endpoint with data seeded directly
into the DB — not a committed pytest suite. **Grouping**: `merchant_id` when present,
else normalized description (reusing the same normalization regex as
`merchant_service.normalize_name`) — keeps income (salary, no merchant) and expense
groups fully separate by also keying on `transaction_type`, so a coincidental
description collision between an expense and income group can never merge them.
**Amount consistency, three tiers**: (1) all occurrences within 2% of the mean →
exact subscription; (2) a stable "leading" cluster followed by a stable "trailing"
cluster more than 2% away → still a subscription, `price_hike=True`, `avg_amount` is
the latest (trailing) amount, not a blended mean — a hiked subscription's forecast
should use what it costs *now*; (3) neither of those but within 20% of the mean →
variable/utility bill, `is_subscription=False`. Anything wider than 20% is rejected
outright, not guessed at. **Interval consistency**: gap between every consecutive
pair of occurrences (not just the median) must fall within tolerance of one
candidate cadence (weekly/biweekly/monthly/quarterly/yearly) for that cadence to
qualify — picks whichever qualifying cadence's target is closest to the median gap.
**`monthly_equivalent`** uses the same day-count ratios as the frontend's
`shared/utils/money.ts` bill math (weekly ×52/12, biweekly ×26/12, quarterly ÷3,
yearly ÷12), kept in sync deliberately so a bill's monthly cost reads identically
wherever it appears. **Verified**: fixture script asserted 6 named scenarios matching
every accept-criterion case (Netflix 12mo exact monthly → subscription, no hike; a
±15% utility → variable bill, not flagged as subscription; 8-occurrence biweekly
payroll with no merchant → detected via description fallback, `transaction_type:
income`; a 2-occurrence merchant → absent from results entirely; an 8-months-then-4-
months price-hike pattern → subscription, `price_hike=True`, `avg_amount` = the
post-hike amount; a 5-transaction irregular-amount/irregular-interval merchant →
absent). All assertions passed exactly (e.g. biweekly $2,500 payroll →
`monthly_equivalent` hand-computed as 2500×26/12 = $5,416.67, matched). Re-verified
live: registered a throwaway account, seeded Netflix (8mo exact $15.49), Spotify
(6mo $9.99 → 3mo $11.99 price hike), 9-occurrence biweekly payroll with no merchant,
and a 2-occurrence merchant via direct SQL, hit `GET /api/insights/recurring` with
curl — response matched the hand-computed fixture exactly on every field including
`monthly_equivalent` (payroll: 2200×26/12 = $4,766.67) and the rejected 2-occurrence
merchant was correctly absent. `ruff check` clean. Throwaway account deleted after.
**Not built here** (I2's scope): no UI surfaces this endpoint yet — Recurring
(U5)'s page still only shows manually-created bills/budgets.

### [x] I2 — Subscriptions section on Recurring page — done 2026-07-22
**Build:** "Detected subscriptions" on U5's page: rows (name, monthly cost, next date,
price-increase flag) under total headline; "not a subscription" dismiss (persisted,
excluded from re-detection); undetected bills remain manually addable.
**Accept:** seeded fixture data shows correct list + total (Playwright); dismiss persists
across reload.
**Depends:** I1, U5.
**Result:** New migration `0002_dismissed_recurring_groups.py` (raw SQL, hand-written
per `rules/database.md` — no autogenerate; this is the first incremental migration
since D1's squash, applied via `alembic upgrade head`) — one table keyed on
`(profile_id, group_key)` with a unique constraint, storing which of I1's detected
groups the user has dismissed. `backend/routers/insights.py`: `GET /recurring` now
loads the dismissed set for the profile and filters `detect()`'s output before
returning (never re-suggests a dismissed group, not just hidden client-side);
`POST /recurring/dismiss` inserts with `ON CONFLICT ... DO NOTHING` — idempotent, so
double-dismissing isn't an error. `RecurringChargeResponse` gained a `group_key`
field so the frontend has something stable to dismiss by (merchant-based groups use
`merchant:<id>`, merchant-less groups like income use the normalized-description
fallback from I1 — both need to round-trip through the API).
`frontend/src/store/slices/recurringInsightsSlice.ts` (new): `fetchRecurringInsights`
+ optimistic `dismissRecurringGroup` (removes the row immediately, reverts with a
toast if the POST fails — same optimistic-with-rollback pattern every other slice
uses). `desktop/pages/Recurring/DetectedSubscriptions.tsx` (new): renders only
`transaction_type: 'expense'` groups (income groups like a detected payroll aren't
"subscriptions" — I1 detects them for I4's forecast, not for display here); each row
shows name, cadence, next expected date, monthly cost, and a price-increase badge
when `price_hike` is set; a quiet no-op empty state (component returns `null`) when
loading or nothing's detected — not an error/empty-state callout, since "nothing
found yet" is the normal state until enough transaction history exists. Mounted in
`Recurring.tsx` between the manually-tracked bills table and Budgets — manually
added bills are entirely unaffected (I1 never reads or writes the `bills` table, only
`transactions`), so "undetected bills remain manually addable" required no changes
at all, just not breaking anything. Reused `frequencyLabel` from
`shared/utils/money.ts` for cadence display rather than duplicating the label map
(same string keys — weekly/biweekly/monthly/quarterly/yearly — I1 deliberately
matched the frontend's existing convention for exactly this reason).
**Verified:** `tsc`/lint/build/depcheck clean; `ruff check` clean. Playwright desktop
1280×900, throwaway account: seeded Netflix (8mo exact $15.49) and Spotify (6mo
$9.99 → 3mo $11.99 price hike) via direct SQL, loaded `/recurring` — Detected
Subscriptions section showed both rows with the correct total ($27.48 =
15.49+11.99), Spotify carrying the "Price increased" badge and Netflix not. Clicked
"Not a subscription" on Netflix — row disappeared immediately, total updated to
$11.99. Reloaded the page — Netflix stayed gone (only Spotify remained), and a
direct DB query confirmed a row in `dismissed_recurring_groups` for
`merchant:<netflix_id>` — proving the dismiss is a real server-side exclusion, not
just client-side state that would reappear on next fetch. Throwaway account deleted
after.

### [x] I3 — Trends & anomaly engine — done 2026-07-22
**Build:** `services/insights/trends.py`: MoM/YoY per category and total; anomaly =
current month category spend > 2× trailing-3-month avg (min $50 and ≥3 months history —
honesty rule: insufficient data → no claim); 3-month rising streak detection. Structured
`Insight` objects with evidence (the numbers behind the claim). `GET /api/insights/`.
**Accept:** unit tests incl. honesty cases (2 months history → no anomaly emitted).
**Depends:** D1.
**Result:** `backend/services/insights/trends.py` (new, pure functions — same
no-DB-access split as I1's `recurring.py`, reused by the router): `category_trends()`
returns MoM/YoY per category **plus** a synthesized "Total" row (grand totals across
all categories), always emitted regardless of history depth — trends are factual
reporting, not a claim, so there's no honesty gate on them, only on `detect_insights()`'s
anomaly/streak output. Wired into the existing `insights` router as `GET /api/insights/`
(returns `{trends: [...], insights: [...]}`), fetching categorized expense
transactions over a 400-day window (covers current + 3 trailing months + same month
last year with margin) and passing `today` in explicitly rather than calling
`datetime.now()` inside the pure function, keeping it testable with an arbitrary
reference date. **Anomaly honesty rule, implemented precisely as specified**: trailing
average is computed from the 3 most recent months with *actual nonzero spend* before
the current month, not just "the 3 preceding calendar months" — a category with a
history gap doesn't get a falsely-deflated average that makes any real spending look
anomalous. Requires all three of: ≥3 such prior months, current-month total ≥ $50,
and current > 2× that trailing average — all three gates verified independently in
the fixture script (a category with only 2 prior months and a 5x spike correctly
produced **no** anomaly; a category with 3x ratio but under the $50 floor also
produced none). **Rising streak**: requires 4 consecutive months of nonzero data
(current + 3 prior) strictly increasing at every step — a gap anywhere in that window
means no streak is claimed, same honesty principle. Every `Insight` carries a
JSON-serializable `evidence` dict with the exact numbers behind its `message` (current
total, trailing average, multiplier, or the month-by-month series for a streak) —
the `design-system.md` "transparent AI" requirement I6 will render inline, satisfied
at the data layer here so I6 has nothing to fabricate. **Verified**: hand-computed
fixture script (deleted after, per the T1-established "no pytest files" project
decision) covering 5 categories in one pass — an anomaly case (3 months ~$100 avg,
spike to $250, 2.5×) correctly flagged with exact evidence numbers; the explicit
accept-criterion honesty case (2 months history, huge spike) correctly produced zero
anomalies for that category while its MoM/YoY trend numbers still appeared normally;
a below-$50-floor case (3x ratio, ~$10→$30) correctly suppressed; a 4-month strictly-
increasing Shopping series correctly flagged `rising_streak`; a Total row and a
Rent category's exact MoM (0%) and YoY (+9.09%) percentages both hand-verified exact.
Re-verified live: seeded a Food & Dining anomaly (3 months at $95/$105/$100, then
$260) via direct SQL on a throwaway account, hit `GET /api/insights/` — response
matched the hand-computed values exactly (`mom_change_pct: 160.0`, anomaly
`multiplier: 2.6`, `trailing_avg: 100.0`). `ruff check` clean. Throwaway account
deleted after. **Not built here**: no UI renders this endpoint yet — I6 wires it into
Home's insight cards.

### [x] I4 — Cash-flow forecast engine — done 2026-07-22
**Build:** `services/insights/forecast.py`: 60–90 day daily simulation — start = cash
accounts balance; + income on expected paydays (from I1 income detection); − recurring
bills on expected dates (I1); − avg daily discretionary (trailing 3 months, excluding
recurring); output daily balance series + crunch points (days < buffer).
**Accept:** hand-computed 30-day fixture matches exactly (test); insufficient data →
explicit "needs ~2 months" response, not a guess.
**Depends:** I1.
**Result:** `backend/services/insights/forecast.py` (new, pure function —
`simulate(start_balance, start_date, horizon_days, recurring_charges,
avg_daily_discretionary, history_span_days, buffer=0) -> ForecastResult`) wired to
`GET /api/insights/forecast` (90-day horizon). **Reuses I1's `RecurringCharge`
objects directly** (not a re-derived shape) — `_occurrences_in_window()` walks each
charge's `next_expected_date` forward or backward by its `cadence`'s day-count (I1's
own `CADENCES` table, imported not re-declared) to enumerate every predicted
occurrence inside the simulation window, so a subscription whose `next_expected_date`
happens to predate `start_date` (common — I1 computes it from the last historical
transaction, not from "today") still contributes its future occurrences correctly.
**Discretionary spend**: router sums expense transactions from the trailing 90 days
that are *not* among any detected recurring charge's `transaction_ids` — genuinely
"the spending recurring detection didn't already account for", not a naive average of
everything. **Honesty rule**: `simulate()` itself gates on `history_span_days < 60`
and short-circuits to `insufficient_data=True` with a fixed message, before doing any
simulation work — single source of truth the router doesn't duplicate (confirmed live:
a fresh throwaway account with zero history got exactly `{"insufficient_data": true,
"message": "Needs about 2 months of transaction history for an accurate forecast",
"days": [], "crunch_points": []}`). **Scope decision**: dismissed recurring groups
(I2's "not a subscription") are excluded from the forecast's recurring charges too,
for consistency — a group the user has explicitly told the app isn't a recurring
subscription shouldn't still drive predicted future cash-flow events. Extracted a
`_fetch_recurring_input()` helper shared between `/recurring` and `/forecast` (both
need the same transaction shape) rather than duplicating the query.
**Verified**: hand-computed fixture script (deleted after) with 3 cases — a
30-day scenario (biweekly $1500 payroll, monthly $1200 rent, monthly $15 Netflix,
$20/day discretionary, $2000 start) whose end balance ($4,665 = 2000 + 3×1500 −
1200 − 15 − 31×20) matched exactly, including the exact 3 predicted payday dates and
2 predicted bill dates; a low-balance scenario that correctly produced a crunch point
on the exact day the simulated balance first went negative; and the insufficient-data
short-circuit. Re-verified live: seeded 6 months of biweekly payroll + monthly rent +
$900 of one-off discretionary spend on a throwaway account (171 days of history,
$15,900 net balance from the seeded transactions), hit `GET /api/insights/forecast` —
response matched a full hand recomputation exactly: 7 predicted paydays and 3 rent
charges landing on the exact predicted dates within the 90-day window, and a final
balance of $25,390 (verified via the same arithmetic the engine uses, catching my
own initial off-by-one in the manual check — the window is 91 days inclusive of both
endpoints, not 90, which the fixture script's assertions had already gotten right).
`ruff check` clean. Throwaway account deleted after. **Not built here**: I5 wires
this into the actual "safe to spend" number and Home's hero card.

### [x] I5 — Safe-to-spend + Home hero wiring — done 2026-07-22
**Build:** `safe_to_spend = cash balance − (bills due before next payday) − (goal
contributions due)`; endpoint + wire U3's hero (both viewports); sub-line: "next paycheck
in N days, $X in bills before then".
**Accept:** fixture math exact (test); hero live on both Homes (Playwright); insufficient
data shows honest empty state.
**Depends:** I4.

**Result:** `backend/services/insights/safe_to_spend.py` (new, pure function):
`compute(cash_balance, recurring_charges, goal_monthly_contributions, reference_date,
history_span_days) -> SafeToSpendResult`. Reuses I4's `MIN_HISTORY_DAYS`/
`INSUFFICIENT_DATA_MESSAGE` honesty gate. `next_payday` = earliest `next_expected_date`
among income-type recurring charges, `None` (not fabricated) when no income is detected —
a distinct, real degenerate case from the insufficient-data gate. `bills_before_payday` =
sum of expense-charge `avg_amount` where `next_expected_date < next_payday`.
`goal_contributions_due` = sum of `monthly_contribution` across active, not-yet-complete
goals (the `Goal` model has no due-date field, so "due" is read as "any active goal's
full monthly amount" — a defensible reading of the actual schema, not a hidden
assumption). `backend/routers/insights.py`: extracted `_history_span_days`,
`_dismissed_filtered_charges`, `_cash_balance` as shared async helpers now used by both
`/forecast` and `/safe-to-spend` (dismissed I2 subscriptions excluded from both, for
consistency — a group the user said "isn't a subscription" shouldn't still drive
predicted cash flow); added `GET /safe-to-spend` → `SafeToSpendResponse`.

Frontend: `store/slices/safeToSpendSlice.ts` (new) — `safeToSpend: {data, loading}` +
`fetchSafeToSpend()`, registered in `store/types.ts`/`useBoundStore.ts`.
`shared/hooks/useSafeToSpend.ts` (new) — shared desktop/mobile view hook (`rules/dry.md`):
fetches on mount, returns `{loading, insufficientData, amount, subLine}`; sub-line built
via the existing `formatCurrency` helper, `null` when no payday is detected. Wired into
both `desktop/pages/Home/Home.tsx` and `mobile/pages/Home/Home.tsx` hero cards (mobile's
pull-to-refresh also now calls `fetchSafeToSpend()` alongside the existing refreshes).

Verified live: registered a throwaway account, seeded 6 months of biweekly $2000 payroll +
monthly $1200 rent + one active goal (`monthly_contribution=150`) via the real API,
`GET /api/insights/safe-to-spend` returned `{"safe_to_spend":16650.0,"cash_balance":16800.0,
"next_payday":"2026-07-24","days_until_payday":2,"bills_before_payday":0.0,
"goal_contributions_due":150.0}`, matching hand-calculation exactly. Confirmed via
Playwright on both viewports (1280×900 desktop, 390×844 mobile): hero shows "$16,650.00" /
"Next paycheck in 2 days, $0.00 in bills before then" on the seeded account, and the honest
"—" / "Needs about 2 months of transaction history for an accurate forecast" empty state on
a second fresh throwaway account with no history, on both viewports. `tsc --noEmit` and
`eslint` clean. Both throwaway accounts deleted after (`DELETE FROM users WHERE email IN
(...)`, cascades).

### [x] I6 — Insight cards + advice — done 2026-07-22
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

**Result:** `backend/services/insights/advice.py` (new, pure function, no DB/AI access —
same split as the rest of `services/insights/`): `generate(charges, trend_insights,
budgets, goals, today) -> list[AdviceCard]` covering all 5 rule types from the Build
line plus I3's already-built-but-unwired `anomaly`/`rising_streak` insights:
`price_hike` (I1's `price_hike` flag), `budget_drift` (≥90% of a budget period used,
priority split over-budget vs near-limit), `goal_pacing` (deadline-based or
monthly-contribution-based expected-vs-actual %, **only when a real timeline exists** —
a goal with neither a deadline nor a monthly contribution gets no verdict, honesty rule
extended to pacing, verified in the fixture script's "New Car" case), and
`top_subscriptions` (I1's subscriptions ranked by `monthly_equivalent`). Cards sorted by
priority (anomaly/price_hike/over-budget first) and capped at 5. **Ollama note**: this
project has no Ollama client anywhere yet (tracked separately under Phase S, `S1`–`S3`
haven't landed) — implementing a fake local-AI path here would be exactly the
"unfinished implementation" pattern the project avoids, so the AI layer is Gemini-only,
gated by the same `ai_cloud_enabled` toggle every other AI call already checks; with the
toggle off (or absent, the default) every card is 100% deterministic template text,
satisfying the accept criterion's "Ollama absent" case by construction.

`backend/services/ai/rephrase.py` (new): `rephrase(template, cloud_enabled) -> str |
None` — Gemini call gated by `cloud_enabled` + API key presence (same pattern as
`ai_service.py`/`chat.py`), with an explicit **numeric-safety check**: every number
substring in the template must still appear in the reworded text, or the rephrase is
discarded and the template is used instead — enforces "never invent numbers"
programmatically, not just via prompt wording. `backend/database/alembic/versions/
0003_dismissed_insight_types.py` (new migration, applied): `dismissed_insight_types`
table, unique on `(profile_id, insight_type)` — dismiss-by-type per I2's precedent.
`backend/routers/insights.py`: extracted `_fetch_categorized_transactions` (was inline
in `GET /`, now shared with `/advice`), added `_budget_statuses`/`_goal_statuses`
helpers, `GET /advice` (assembles charges/trend-insights/budgets/goals, filters
dismissed types, calls `rephrase()` per card, returns `ai_generated: bool` per card) and
`POST /advice/dismiss`.

Frontend: `store/slices/adviceSlice.ts` (new, same optimistic-dismiss-with-rollback
pattern as `recurringInsightsSlice`), registered in `store/types.ts`/`useBoundStore.ts`.
`desktop/pages/Home/InsightCards.tsx` (new): renders each card's message, an
evidence line built per-type from the `evidence` payload (e.g. "$260.00 this month vs a
$100.00 average"), a purple "AI" badge with a `Bot` icon when `ai_generated` is true
(distinct from template cards, no badge otherwise), and a dismiss `IconButton` calling
`dismissAdviceType`; falls back to the pre-existing "Insights need a bit more data"
empty state when the card list is empty. Wired into `desktop/pages/Home/Home.tsx`,
replacing the static placeholder card (not built on mobile — the ticket's Build line
scopes this to desktop Home only).

Verified live: fixture script (`services/insights/advice.py` pure functions, deleted
after) covering all 5 card types plus two negative goal-pacing cases (on-pace goal via
`monthly_contribution`, and a goal with neither a deadline nor a contribution — correctly
produced zero cards for both) — all assertions passed, including priority-ordering and
the 5-card cap. Live: registered a throwaway account, seeded a Netflix price hike
(4mo @ $12.99 → 2mo @ $18.99), a Spotify subscription, a Food & Dining spend spike
(3 months ~$100 avg → $260, seeded via the real API), a $200 Food & Dining budget
already at $288.98 spent, and a goal backdated via direct SQL to simulate 90 days
elapsed against a 180-day deadline with only 5% saved. `GET /api/insights/advice`
returned all 5 expected cards with exact evidence numbers; confirmed the em-dash
"garbling" seen in one terminal echo was a Windows console codepage artifact, not a
real bug — raw response bytes and the rendered page both showed the correct "—"
character. Verified via Playwright on desktop (1280×1000): all 5 cards rendered with
message + evidence line + dismiss button; dismissing "top_subscriptions" removed it
immediately and it stayed gone after a full page reload (server-side persistence
confirmed); a second fresh throwaway account with zero transactions correctly showed
the honest empty state. `tsc --noEmit`, `eslint`, and `ruff check` all clean. Both
throwaway accounts deleted after.

---

## Phase S — Document Understanding

### [x] S1 — Documents storage + upload — done 2026-07-23
**Build:** `documents` table lives since D1; add file storage `backend/uploads/{user_id}/`
(uuid names, path never client-controlled); `POST /api/documents` (multipart, jpg/png/pdf,
≤15MB, auth, sets status=pending), `GET /api/documents/{id}` (ownership-checked, serves
file); desktop upload dropzone on Activity import area.
**Accept:** upload→fetch roundtrip; other user's document → 404 (test); oversize/wrong
type rejected cleanly.
**Depends:** D1.

**Result:** `backend/routers/documents.py` (new): `POST /api/documents/` validates
content-type against an explicit allowlist (`image/jpeg`, `image/png`,
`application/pdf`) and size (reads at most `MAX_UPLOAD_SIZE_BYTES + 1` bytes so an
oversize upload is never fully buffered), generates the on-disk filename as
`uuid4().hex` + an extension derived from the validated content-type — **never** from
the client-supplied filename — and saves under `backend/uploads/{user_id}/`, then
inserts a `documents` row (`status='pending'`). `GET /api/documents/{id}` scopes the
lookup by `profile_id`, 404s if the row doesn't belong to the caller's profile or the
file is missing on disk, and serves it via `FileResponse` with the stored mime type.
`core/config.py`: `UPLOAD_DIR`/`MAX_UPLOAD_SIZE_BYTES` settings. `.gitignore`:
`backend/uploads/` (user data, never committed) — persists fine across restarts because
`docker-compose.yml`'s existing `./backend:/app` bind mount covers it, no new volume
needed.

Frontend: `shared/hooks/useDocumentUpload.ts` (new) — client-side type/size pre-check
(fast-fail UX only, server re-validates independently) then a multipart `POST`.
`desktop/pages/Activity/DocumentUploadDialog.tsx` (new) — a real drag-and-drop zone
(`onDragOver`/`onDrop`) with a click-to-browse fallback, wired via a new "Upload
Receipt" button next to "Import CSV" on Activity. No review queue/approve flow yet —
out of scope for S1, tracked under S2 (extraction) and later tickets; a successful
upload just confirms the file landed and is queued.

**Two real bugs found and fixed during live verification** (not just curl — the curl
round trip passed on the first try, masking both): (1) the shared axios client
(`shared/api/client.ts`) sets a fixed `Content-Type: application/json` default header,
which silently overrode `FormData`'s auto-detected multipart boundary — every browser
upload was sent as broken "JSON" and 422'd. Fixed by explicitly passing `headers: {
'Content-Type': undefined }` on the upload call so the browser sets the real boundary.
(2) The catch handler rendered `error.response.data.detail` directly in a toast, which
crashed with "Objects are not valid as a React child" — FastAPI's own 422 validation
errors put an **array** of `{type, loc, msg, input}` objects in `detail`, unlike this
router's hand-raised `HTTPException`s which always use a plain string. Fixed with a
`typeof detail === 'string'` guard, falling back to a generic message otherwise. Both
were only reachable from an actual browser upload, not curl — confirms why this
project's verification standard requires driving the real UI (Playwright), not just
hitting the API directly.

Verified live: two throwaway accounts (curl) — user A uploaded a real JPEG,
`GET /api/documents/{id}` returned it byte-for-byte identical to the source file
(`diff` via Python); user B fetching user A's document ID got a clean 404; a `.txt`
upload got a clean 415; a ~16MB JPEG got a clean 413; the on-disk filename was
confirmed to be a bare UUID (`a629ce2af1624b3e89c84ae004e3d09c.jpg`), not the original
`test_receipt.jpg`. Then via Playwright on desktop (1280×1000): clicked "Upload
Receipt," used the dropzone's click-to-browse to select a real file, confirmed a `201`
in the network log and the dialog auto-closing on success (post-fix; pre-fix this is
where the 422 + React crash were caught). `tsc --noEmit`, `eslint`, `ruff check` clean.
Both throwaway accounts and all uploaded test files deleted after. **Also**: mid-ticket,
added an explicit "don't over-engineer" rule (`rules/frontend.md`, `rules/code-review.md`,
and the `code-review` skill's Simplification finder) at the user's request — no new
file/component for 3-4 lines used exactly once; call it out as a finding the same way
duplication is.

### [x] S2 — Extraction service (local AI, tiered) — done 2026-07-23
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

**Result:** **Tier A (Ollama) not built** — this project has no Ollama client
anywhere (same gap I6 and S1 already flagged; tracked, not this ticket's job to
invent). Tier order is therefore B (Gemini vision, toggle-gated) → C (Tesseract +
regex, always available) — "Ollama stopped" is simply the permanent state here, so
that half of the accept criterion is satisfied by construction rather than by a stub.

`backend/services/ingest/document_extract.py` (new): `parse_receipt_text(raw_text) ->
ExtractedDocument` is a pure function (no DB, no I/O — same split as
`services/insights/`) over already-OCR'd text: `_extract_total` prefers a line
containing "total" that isn't "subtotal"/"tax"/"change"/"cash"/"tender", else falls
back to the largest dollar amount on the page; `_extract_date` tries ISO
(`YYYY-MM-DD`) first, then `MM/DD/YYYY`/`MM-DD-YYYY` (2-digit years assumed 20xx);
`_extract_merchant` takes the first line with ≥3 alphabetic characters in the first 5
lines (receipts put the merchant name at the top). Honesty rule: Tesseract-only output
never claims "high" confidence — "medium" only when both total and date were found,
"low" otherwise, matching the same pattern established in I3/I4/I5. `extract_tesseract`
wraps this with `pytesseract.image_to_string` for jpg/png; PDF returns an honest
all-null "low" result — no PDF OCR pipeline exists yet, so "found nothing" is correct,
not a guess. `_from_gemini_result` defensively coerces a Gemini JSON response (never
trusts an LLM's output blindly — invalid `total`/`date` triggers a fallback to tier C
rather than storing garbage). Top-level `extract(file_path, mime_type, cloud_enabled,
ai_service)` tries Gemini first when `cloud_enabled`, falls through to Tesseract on any
failure or when the toggle is off.

`backend/services/ai/gemini.py`: added `extract_receipt(image_bytes, mime_type) ->
dict | None` — sends the image as base64 `inline_data` alongside a JSON-extraction
prompt (merchant/date/total/line_items/category_hint/confidence) to the same
`gemini-flash-latest` endpoint `parse()` already uses; extracted a `_strip_json_fences`
helper shared by both methods (was about to be duplicated a second time — caught before
it happened, `rules/dry.md`). `backend/services/ai/ai_service.py`: added
`extract_receipt(image_bytes, mime_type, cloud_enabled)` following the exact same
gating pattern as `parse()` — toggle off or no API key means the Gemini call is never
attempted, not attempted-and-ignored.

`backend/routers/documents.py`: extraction now runs synchronously inside `POST
/api/documents/` right after the file lands on disk (no job queue exists in this
project; a Tesseract pass or a single Gemini call both complete well within the
request lifetime, so this is the simplest correct design, not a shortcut) —
best-effort, wrapped in try/except so any extraction failure leaves `extracted_json`
null and the document still `pending` rather than failing the upload itself.
`_extract_and_store`: calls `extract()`, then D5's existing `find_matching_merchant`
(read-only, never creates) against the extracted merchant string, then
`_category_from_merchant_history` (most-frequent `category_id` among that merchant's
past transactions) with `_category_from_hint` (name lookup against the profile's
categories, case-insensitive) as the fallback — **exactly the priority order the
ticket specifies**, verified live (see below). Stores everything into
`documents.extracted_json` via the connection-pool's existing jsonb codec.
`requirements.txt`/`Dockerfile`: added `pytesseract`, `Pillow`, and the system
`tesseract-ocr` package.

**Fixture-verified** (deleted after): `parse_receipt_text` against 5 hand-built OCR-text
cases — a clean receipt (exact merchant/date/total, confidence medium), an ISO-date
receipt, a blurry/garbled receipt (no clean total line → correctly falls back to the
max amount, confidence low), pure non-receipt text (all fields null, low), and a
"subtotal trap" (a real total line exists after a subtotal line — confirms subtotal is
correctly skipped in favor of the actual total). All 5 passed exactly.

**Verified live**, two synthetic receipt images (generated with PIL inside the backend
container — the first attempt used PIL's crude default bitmap font and produced
genuinely bad OCR text, e.g. "Total 13.82" read as "Tol 1382" with the decimal point
dropped; confirmed via a raw `pytesseract.image_to_string` dump that this was a test-
fixture quality issue, not a regex bug — the amount-decimal-required regex correctly
declined to match "1382"; re-generated at a larger font size and got clean OCR text
matching the fixture-tested cases exactly). With the throwaway account's
`ai_cloud_enabled` at its default (false): uploaded the clean receipt,
`extracted_json` showed `tier: "tesseract"`, `merchant: "COSTCO WHOLESALE"`, `date:
"2026-07-15"`, `total: 13.82`, `confidence: "medium"` — exact match to the OCR text;
`docker compose logs` over the request window contained zero Gemini-related log lines,
confirming no outbound call was attempted. Merchant/category enrichment: seeded a
merchant named exactly "COSTCO WHOLESALE" with a past transaction categorized
"Shopping," re-uploaded — `merchant_id` and `category_id` both populated correctly (a
looser "Costco" merchant with only a Levenshtein-fuzzy match correctly did **not**
match — D5's existing distance threshold is tuned for typos, not substring/extra-word
differences, confirmed this is D5's existing, correct, unmodified behavior, not a new
bug). Toggled `ai_cloud_enabled` on via `PUT /api/auth/me/ai-settings`, re-uploaded the
same receipt: `extracted_json` showed `tier: "gemini"`, `confidence: "high"`, populated
`line_items` (something Tesseract structurally cannot produce), `category_hint: "Food &
Dining"` — but `category_id` still resolved to the merchant-history value (15,
"Shopping"), confirming the merchant-history-before-hint priority the ticket requires;
backend logs showed `Gemini extracted a receipt (25368 bytes)`, confirming the real
outbound call fired and was logged as such. Toggled back off after. `ruff check .`
clean project-wide. Throwaway account and all uploaded test documents deleted after
(cascades via `profile_id`/`user_id` FKs). **Not built here**: S3's review screen is
the next ticket — nothing here surfaces `extracted_json` to any UI yet.

**Follow-up (2026-07-23) — PDF text-layer extraction + bill support.** Original S2 left
PDFs returning an honest all-null "low" result (no PDF pipeline). A real utility bill
(TECO/Tampa Electric, a digitally-generated PDF) surfaced the gap in practice, so tier C
now reads a PDF's **text layer directly** via `pdfplumber` — for digitally-generated
documents this is *more* accurate than any OCR/LLM, since the numbers are exact rather
than recognized, so this tier alone earns a "high" confidence (the OCR path stays capped
at "medium" — a recognition step can misread). Added a new `pdf_text` tier value;
`extract_local` (renamed from `extract_tesseract`) branches on mime type: PDF → pdfplumber
text → same `parse_receipt_text` heuristics; empty text layer (a scanned/image-only PDF)
→ honest "low" null result (page-rasterization+OCR for that case is a further improvement,
not built). Generalized the heuristics from receipts to **bills** at the user's request
(power/water/rent, not just store receipts): total regex now also matches "amount due"
(utility bills never say "total" near the charge), skips "previous" lines (so a
"Previous Amount Due $104.77" balance doesn't beat the real "$96.84" current charge), and
date parsing now handles month-name dates ("August 05, 2026") which bills use far more
than receipts. **On Ollama** (the "tier A" the original plan named): discussed with the
user and deliberately **not** added — digital PDFs are covered deterministically by this
tier, photos/scans by tier B (Gemini, toggle-gated); a local-LLM tier's only unique value
is fully-local photo/scan understanding, a large lift (client + multi-GB model + seconds/
doc) for a gap Gemini already fills. Left as a documented future option; the tier
structure is ready for it. Fixture-verified against the TECO bill's exact text (correctly
picks $96.84 over the $104.77 previous balance, the July 15 statement date, "TECO TAMPA
ELECTRIC"); the original 5 receipt fixtures still pass unchanged. Verified live end-to-end:
generated a faithful text-layer PDF (reportlab, ad-hoc in-container, not added to
requirements), uploaded via the real UI → extracted "$96.84 · high confidence" in the
pending queue → review dialog rendered the actual PDF (see preview fix in S3 below) with
every field pre-filled → saved as a transaction with paperclip link. `requirements.txt`
gained `pdfplumber` (pure Python, no new system binary). `ruff`/`tsc`/`eslint` clean.

**Follow-up (2026-07-23) — auto category + base accounts** (user feedback: the review
form left Category on "None" and the Account picker only listed "Checking", both
confusing). (1) `infer_category_hint(text)` in `document_extract.py`: an ordered
keyword→system-category map (electric/kwh/teco → "Electric", water/sewer → "Water",
grocery/costco → "Groceries", rent/landlord → "Rent", netflix/streaming → "Streaming",
etc.), most-specific first, populated into `category_hint` for tier C (the no-LLM
counterpart to Gemini's own hint) — flows through the router's existing
`_category_from_hint` to a real `category_id`. Deterministic: a category is only
suggested when a keyword actually appears on the page, never guessed. (2)
`account_service.create_default_account` now seeds a base set — **Checking, Savings,
Credit Card** — on every new profile instead of just Checking, so the account picker is
useful out of the box ("debit" isn't a distinct type — a debit card draws from Checking).
Fixture-verified: 10 category cases (9 matches + 1 correct no-match) all pass. Verified
live: a freshly registered profile came back with exactly those three accounts, and the
TECO bill's review dialog auto-selected **"Electric"** as the category with all three
accounts in the picker. `ruff` clean.

### [x] S3 — Review screen (nothing auto-commits) — done 2026-07-23
**Build:** desktop: pending documents queue → editable extracted fields side-by-side with
the image → dedup check (D3) runs before save → exact dup auto-flagged, fuzzy shows
merge/skip/keep-both → save creates transaction(s) with source=document_scan,
document_id set, document status=reviewed.
**Accept:** Playwright: upload fixture receipt → review → save → transaction in Activity
with paperclip link back to image; saving same receipt twice → duplicate flagged, no
double insert.
**Depends:** S2, U4.

**Result:** `backend/routers/documents.py`: `GET /api/documents/` — the review queue,
every `status='pending'` document for the profile with its `extracted_json` (extraction
failing in S2 isn't fatal — a null `extracted_json` just means the review form starts
blank, still fully reviewable by hand). `POST /{id}/review` runs the exact same D3
dedup gate (`services/ingest/dedup.py`'s `find_duplicates`) the CSV import path (U4)
already uses: `exact` → auto-marks the document `reviewed` and returns the existing
`transaction_id` without inserting (nothing left to review, so it shouldn't linger in
the queue forever); `fuzzy` → returns the candidate matches and leaves the document
`pending` for the user to decide; `none`, or resubmitted with `skip_dedup=true` (the
"keep both" case) → inserts with `source='document_scan'`, `document_id` set, marks the
document `reviewed`. `DELETE /{id}` — reject/remove, deletes the row and unlinks the
file; a transaction already created from a later-deleted document keeps existing (the
`document_id` FK is `ON DELETE SET NULL`, never cascades). `routers/transactions.py`:
exposed `document_id` on `TransactionResponse` — the paperclip's data source.

Frontend: `store/slices/documentsSlice.ts` (new, same `isFresh` staleness pattern as
every other list-fetching slice) — `fetchPendingDocuments`, `reviewDocument` (drops the
document from the local `pending` list on any outcome except `fuzzy_duplicate`, which
needs a decision first), `rejectDocument` (optimistic remove + rollback on failure).
`desktop/pages/Activity/PendingReceipts.tsx` (new) — the queue, quiet when empty (I2's
pattern), each row showing the extracted merchant/total/confidence badge. `desktop/
pages/Activity/DocumentReviewDialog.tsx` (new) — image on the left (fetched as an
authenticated blob + object URL, since a plain `<img src>` can't carry the
Authorization/X-Profile-Id headers `GET /api/documents/{id}` requires), a fully
editable form pre-filled from `extracted_json` on the right (description, amount,
type, account, category, date — every field name-checked against
`DocumentReviewRequest`), "Discard" (reject) and "Save Transaction" actions. On a
`fuzzy_duplicate` result, renders the matches inline with "Skip" and "Keep both" —
**mirrors `useCsvImport.resolveReviewRow`'s existing collapse of "merge" and "skip"
into the same discard action**, documented there as "no per-field merge target exists
in this schema," the same real constraint applies here, so this reuses that exact
established UX pattern rather than inventing a new one. `desktop/pages/Activity/
DocumentViewerDialog.tsx` (new, ~40 lines, deliberately its own file per the
just-added over-engineering rule's own carve-out — genuine reuse potential and enough
self-contained state/effect to earn it) — the paperclip's read-only image view, same
authenticated-blob approach as the review dialog. Activity's transaction rows now show
a `Paperclip` icon next to the date whenever `document_id` is set, opening the viewer.
`DocumentUploadDialog.tsx` (S1) updated to force-refresh the pending list on a
successful upload so the new document appears without a page reload.

Verified live end-to-end via Playwright (1280×1000, one throwaway account): uploaded a
synthetic receipt, confirmed it appeared in "Pending Receipts (1)" with the correct
extracted merchant/total/confidence; opened Review, confirmed the image rendered and
every field was pre-filled exactly from `extracted_json`; saved — transaction count
went from 0 to 1, the pending queue emptied, and the new Activity row showed a
paperclip icon; clicked it and confirmed the viewer dialog displayed the correct
source image. Uploaded the **identical** receipt a second time, reviewed with the same
pre-filled values, saved: transaction count stayed at 1 (confirmed via direct SQL
count, not just the UI) — the exact-duplicate path fired, no double insert, and the
second document silently left the pending queue since there was nothing left to
review. Backend smoke-tested independently first via curl covering all four dedup
outcomes (`created`, `exact_duplicate`, `fuzzy_duplicate`, and the `skip_dedup=true`
"keep both" resubmit) before any frontend work started, catching the review flow's
logic correctness before UI verification layered on top. `ruff check .` and
`tsc --noEmit` both clean project-wide. Throwaway account and uploaded test files
deleted after.

**Follow-up (2026-07-23) — PDF preview fix.** Both the review dialog and the paperclip
viewer rendered the fetched document blob in an `<img>`, which browsers can't display
for a PDF (image formats only) — so any PDF upload showed a broken-image box in review.
Fixed both `DocumentReviewDialog` and `DocumentViewerDialog` to detect the blob's
content type (`res.data.type === 'application/pdf'`) and render PDFs in an `<object>`
embed (with an "Open PDF" link fallback), keeping `<img>` for photos. Verified live: the
TECO bill PDF (see S2 follow-up) now renders its full embedded page in the review dialog
alongside the correctly pre-filled fields, saves cleanly, and the paperclip on the
resulting transaction row opens the same PDF viewer.

### [x] S4 — Statement mode (credit-card / bank PDF) — done 2026-07-29
**Build:** extraction returns transaction *list* for statements; review screen renders
rows (include-checkbox, editable category, dedup status per row — critical: statement
rows usually duplicate already-imported transactions → default-exclude exact matches,
flag fuzzy).
**Accept:** fixture statement with 3 known + 2 new transactions → exactly 2 inserted
(Playwright + DB assert).
**Depends:** S3.

**Result:** Design informed by web research (logged in `docs/plan.md` Phase S) — the
mature approach to statement parsing is a hybrid of deterministic table extraction +
LLM for layout variety, which maps exactly onto S2's existing two tiers.

Backend — `services/ingest/document_extract.py`: `StatementRow`/`ExtractedStatement`
dataclasses + `parse_statement_text(raw_text, tier)` (pure, fixture-tested). Row
heuristic: a leading `MM/DD[/YY[YY]]` date, then description, then the **first** currency
amount after it (deliberately not the last — bank statements append a running-balance
column; the first number is the transaction, the trailing one the balance; credit-card
statements have a single amount so first==only). Skips header/subtotal/balance/
payment-due lines via a keyword filter; a trailing `-`/`CR` (or leading `-`) marks a
credit → income, else expense; each row gets a `category_hint` from the S2-follow-up
keyword rules. Missing-year rows inherit the statement's own year (first `20xx` seen).
`extract_statement_local` = pdfplumber text per page → `parse_statement_text` (tier
`pdf_text`); `extract_statement` orchestrates Gemini-first (new
`GeminiService.extract_statement` + `STATEMENT_PROMPT`, `maxOutputTokens` raised to 8192
so long lists aren't truncated) when the T5 toggle is on, else local — same tier order
and gating as `extract`. `_statement_from_gemini` defensively coerces the LLM's row
list.

`routers/documents.py`: upload now branches on `kind` — a `statement` runs
`_extract_statement_json` (resolves each row's category_hint→id once, cached by hint)
storing `{kind:"statement", tier, transactions:[...]}`; everything else the existing
single-receipt path (refactored into `_extract_receipt_json`, shared `_user_cloud_enabled`
helper). `GET /{id}/statement?account_id=` returns every row tagged with its **D3 dedup
verdict** against the chosen account's existing transactions (account-scoped, recomputed
when the account changes). `POST /{id}/statement/import` bulk-creates the kept rows, each
re-run through `find_duplicates` server-side (the UI's unchecking is convenience, not the
safety boundary — an exact dupe that slips through is still skipped), all with
`source='document_scan'` + the `document_id` paperclip, then marks the doc reviewed.
**Consistency bug caught during curl testing and fixed**: the GET dedup check first passed
`merchant_name=None` while the import derives the merchant for its hash — so exact-match
hashes wouldn't line up and dedup silently failed; fixed by having the GET mirror the
import exactly (`extract_merchant_from_description`, a pure no-DB parse).

Frontend — `documentsSlice`: statement types + `fetchStatementRows`/`importStatement`.
`useDocumentUpload` takes a `kind`; `DocumentUploadDialog` gained a Receipt-vs-Statement
`SegmentedControl` (the two extract completely differently and can't be reliably
auto-distinguished, so the user picks). `StatementReviewDialog` (new): a multi-row table
— per-row include checkbox, date, description, auto-category, amount (income shown +/
green), and a dedup badge (New / Possible dup / **Already have it**); exact dupes start
**unchecked**, new rows checked; account chosen once, changing it re-runs dedup (effect
has a cancellation guard against out-of-order account switches). Fuzzy rows kept checked
import with `skip_dedup` ("keep both"). `PendingReceipts` branches: a statement shows
"Bank / card statement · N transactions found" and opens the statement table;
receipts keep the single-review dialog.

**Verified.** Fixture: `parse_statement_text` over a credit-card statement (5 rows +
header/balance noise) and a bank statement with a balance column — all amounts, dates,
credit/expense types, categories, and the noise-line skipping asserted exactly,
including the balance-column-not-picked case. Curl: the exact acceptance scenario — 3
rows imported from a first statement, same statement re-uploaded showed those 3 as
`exact` + 2 as `none`, importing all 5 returned `imported:2, skipped:3`, DB total = 5
(no double-count), all rows `source='document_scan'` with `document_id` set. Playwright
(desktop): uploaded the statement PDF as kind=statement → "5 transactions found" in the
queue → review table rendered all 5 auto-categorized rows all checked → Import 5 →
"Imported 5 transactions", Activity showed 5; **re-uploaded the identical statement →
all 5 rows flagged "Already have it", all checkboxes unchecked, "0 of 5 selected",
Import button disabled** → DB still exactly 5 ($203.64). `ruff`/`tsc`/`eslint` clean.
Throwaway accounts and test files deleted after. **Not built**: image (photo) statements
still fall to OCR with no table structure — digital PDFs (the overwhelming majority) are
covered; scanned-statement OCR is a later refinement.

### [x] S6 — Mobile scan capture — done 2026-07-29
**Build:** enable U8's Scan button: camera via `<input type="file" accept="image/*"
capture="environment">` (native camera on HTTPS/localhost; degrades to gallery picker
over LAN HTTP per `DEVELOPMENT.md` §5). **One-line explainer before first camera use**
("Snap the whole receipt — the app reads it on this device") — researched UX finding:
a brief purpose note before the permission prompt dramatically raises camera acceptance.
Then upload → extraction → mobile-simplified review (fields + dedup verdict) → save.
**Accept:** Playwright 390×844 with fixture image upload → transaction saved; camera
limitation documented in-UI when unavailable.
**Depends:** S3, U8.

**Result:** Mobile-UI-only ticket — reuses the whole S1–S3 backend (upload, extraction,
review/dedup endpoints) and the shared `documentsSlice`/`useDocumentUpload`. `CaptureSheet`
(`mobile/components/CaptureSheet`): the previously-disabled Scan card is now live — it
triggers a hidden `<input capture="environment">` (rear camera on HTTPS/localhost, gallery
picker over LAN HTTP), and the explainer ("Snap the whole receipt — read on this device")
sits on the card, visible *before* the tap that fires the permission prompt. On a picked
file: `upload(file, 'receipt')` → `await fetchPendingDocuments({force:true})` → `openScanReview(id)`.
`useDocumentUpload.upload` now returns the created document id (`number | null`) so the scan
flow can open review for exactly that document (desktop's `if (id)` checks still work).
`uiSlice`: added `scanReviewDocId` + `openScanReview`/`closeScanReview` (global so both the
scan flow and the Activity entry point open the same sheet).

`mobile/components/DocumentReview` (new): the mobile review sheet — an outer component
resolves the doc from `documents.pending` and renders a **keyed inner sheet**
(`key={doc.id}`) so the form's `useState` initializers re-seed per document with no
state-seeding effects (the desktop-parity pattern). Shows the scanned image (authenticated
blob → object URL, PDF via `<object>`), the extracted "Read via {tier} · {confidence}"
line, and editable Description/Amount/Type/Account/Category/Date; Save → `reviewDocument`
(handles created / exact-duplicate / fuzzy-with-keep-both), Discard → `rejectDocument`.
Mounted once in `MobileLayout`. `mobile/pages/Activity`: a **pending-receipts banner** (amber
cards) so an interrupted scan isn't orphaned — tap reopens the review sheet; statements are
excluded (they need the desktop multi-row table).

**Two real bugs found and fixed during live Playwright verification** (both caught only by
driving the actual UI): (1) **infinite render loop** — the Activity selector did
`pending.filter(...)` *inside* `useShallow`, returning a new array reference every render →
"getSnapshot should be cached" → max-update-depth crash (blank page). Fixed by selecting the
stable `pending` array and filtering in the render body. (2) **discard refetch race** — on
Discard, `rejectDocument` optimistically removes the doc from `pending` while
`scanReviewDocId` was still set, tripping the review component's "doc missing → refetch
pending" safety net, whose `GET /documents/` raced the `DELETE` and sometimes read the
not-yet-deleted doc back into the list (stale "Pending" card even though `DELETE` returned
204 and the DB row was gone). Fixed by clearing `scanReviewDocId` (onClose) *before*
rejecting, so the effect returns early instead of refetching mid-delete.

**Verified** live via Playwright at 390×844: Capture → Scan card (explainer visible) →
fixture receipt upload → mobile review sheet rendered the image + "Read via tesseract ·
medium confidence" + all fields pre-filled incl. auto-detected **Groceries** category → Save
→ transaction "COSTCO WHOLESALE · Groceries · Jul 15 · −$13.82" appeared in mobile Activity.
Pending-receipts banner: scanned, closed the sheet without saving → an amber "tap to review"
card appeared → tapping reopened the sheet. Discard (post-fix): `DELETE → 204`, "Receipt
discarded" toast, **no stale card**, DB confirmed the row deleted. `tsc`/`eslint` clean.
Throwaway account + test files deleted after. **Camera note:** Playwright can't drive a real
camera, so verification used the file-picker fallback path (exactly what LAN-HTTP users get);
the `capture="environment"` attribute enables the native camera on HTTPS/localhost.

### [x] S7 — Messy quick-add fallback (typed input) — Gemini-only — done 2026-07-29
**Goal:** weird phrasing and messy typing still parse.
**Build (revised 2026-07-29 — AI decision: Gemini-only, no Ollama):** the parse pipeline
already does rules (T1 contract) → optional Gemini (`services/ai/ai_service.py` `parse`,
gated by the T5 toggle). This ticket is a **verify/polish** pass, not new AI: confirm the
rules→Gemini fallback actually triggers on low-confidence input, the result flows through D5
merchant matching + the normal preview (one-question rule unchanged), and it degrades to the
rules result with **zero outbound calls** when the toggle is off. No local-LLM tier.
**Accept:** toggle on: "pais 30 dolar grocery wallmart yesteday" → correct preview (amount 30,
Walmart matched, date = yesterday); toggle off: degrades to rules result, zero outbound calls
(assert).
**Depends:** T1, D5, T5.

**Result:** the audit found the pipeline was actually **Gemini-first when the toggle was on**
— both `/parse` and `/quick-add` called `ai_service.parse` *before* the rules parser, so
every input (even "coffee 4.50" that rules nail) was sent to Google. That contradicts the
project's own principle ("rules first… AI parses only what rules can't", `plan.md` Principle
3 + `architecture-and-goals.md` allocation table) and is a privacy/efficiency regression. So
S7 became a real fix, not just verification: reordered both endpoints to **rules-first**, via
a shared `_rules_first_parse(text, cloud_enabled)` helper (+ `_cloud_enabled`) in
`routers/transactions.py`. **Fallback trigger:** Gemini is called **only when rules can't
find the amount** *and* the toggle is on — the amount is the one field the preview/
one-question flow can't infer for the user, so it's the honest "rules genuinely couldn't"
signal. Everything else (description, category, merchant, date) rules + D5 fuzzy matching
resolve locally with the preview for correction. Net effect: **common inputs never leave the
machine even with the toggle on**, and the cloud is touched only for input rules truly can't
handle (and never when the toggle is off). `parse_transaction` and D5's
`extract_merchant_from_description`/`find_matching_merchant` reused unchanged; the
one-question follow-up (`request.amount` fills a missing amount) preserved.

**Verified live** (curl + backend-log inspection — the substantive, privacy-critical
verification for a backend-internal reordering; the quick-add UI is byte-for-byte unchanged
and already Playwright-verified in T-phase). Toggle **off**: "coffee 4.50" → rules (amount
4.5, `ai_provider: null`); "lunch at the cafe" (no amount) → rules result with
`missing:["amount"]` for the one-question flow; **zero Gemini log lines**. Toggle **on**:
"coffee 4.50" → still rules, **no Gemini call** (the key privacy win — logs confirm nothing
outbound); "grabbed lunch, about twenty bucks" (rules can't parse a spelled-out amount) →
Gemini fired (logged "Gemini parsed…"), returned amount 20.0 / "Grabbed lunch" / Food &
Dining / `ai_provider: "gemini"`. `/quick-add` save path re-verified: "spent 15 on groceries"
→ transaction created ($15, Food & Dining, source quick_add); "netflix subscription" +
one-question `amount:15.99` → created ($15.99, Entertainment). `ruff check .` clean. Throwaway
account deleted after. **Note on the original accept example:** "pais 30 dolar grocery
wallmart yesteday" — rules actually *do* extract amount 30 from it, so under the
privacy-first trigger it stays local (rules + D5 fuzzy-match "wallmart"→Walmart at preview,
user edits the rest) rather than going to cloud — the deliberate, more private outcome than
the original ticket wording implied.

---

## Next direction — decided 2026-07-29 (after Phase S)

Two rule-based initiatives serving the multi-country / advisor goal. **No new AI** — Gemini
stays the single optional cloud tier (per `plan.md` Principle 3).

### [ ] N1 — Multi-country documents (locale-aware local parsing)
**Goal:** Indian/Canadian receipts & statements parse **locally** (no cloud needed), not just
US formats.
**Build:** the extraction path (`routers/documents.py` `_extract_*_json`) already has the
`profile` → its country. Thread the country into
`services/ingest/document_extract.py` `parse_receipt_text`/`parse_statement_text`:
(a) date interpretation by locale — India/UK **DD/MM**, US/CA **MM/DD** (resolves the
ambiguity honestly instead of always assuming US); (b) recognize **₹** and lakh grouping in
`_AMOUNT_RE`; (c) add India transaction vocabulary (UPI, IMPS, NEFT, ACH) to the statement
row/skip regexes and `_CATEGORY_KEYWORDS`. Gemini (tier B) already handles these when opted
in — this makes the **local** tier competent so cloud isn't required.
**Accept:** fixture Indian + Canadian statement/receipt text → correct dates/amounts/
categories (hand-computed); live per-profile verify (an IN profile parses a ₹ DD/MM statement,
a US profile still parses `$` MM/DD). No regression on the existing US fixtures.
**Depends:** S2, S4, D1 (country profiles).

### [ ] N2 — Deeper advisor + remittance-as-a-category
**Goal:** turn advice from reactive flags into real guidance ("what's useless, how to save"),
and track money sent home.
**Build:** grow `services/insights/advice.py` with new rule types — **savings-rate coaching**
(income vs spend vs saved, trend, target nudge), **useless-spend detection** (forgotten/
low-value subscriptions, fee/interest leakage, impulse categories), **budget guidance**
(over-budget + realistic re-allocation), **goal-based planning** (on-track? what to change).
All deterministic numbers with evidence; optional Gemini *phrasing* only (existing `rephrase`),
never AI-invented figures. **Remittance-as-a-category:** add a "Money Sent Home / Remittance"
system category (`services/category_service.py`) + transfer providers (Wise, Remitly, Xoom,
Western Union, MoneyGram, wire/ACH) to `_CATEGORY_KEYWORDS` so they auto-tag from statements
(still manually editable); advisor treats it as a first-class recurring category. It's a
US-profile expense — respects sealed profiles / no conversion, **zero new architecture**.
**Accept:** fixture ledgers → correct savings-rate, a flagged useless subscription, an
over-budget nudge, a behind-pace goal, each with evidence (hand-computed); a Wise/Remitly
statement row auto-categorizes to Remittance; advisor surfaces "you send ~$X/month home".
Live-verify the advisor cards on desktop Home. **Heavy linked-legs+FX remittance stays
deferred** (see `plan.md`).
**Depends:** I3, I6 (advice engine), N1 (keyword map).

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
