# My Financial Life — Architecture & Goals

> Last updated: 2026-07-16
> Companion to `plan.md` (roadmap) and `design-system.md` (UI).
> This file describes how the system is built and where the design is going.

---

## Goal

A privacy-first personal financial advisor on localhost. Not just tracking — the app should
tell me where I'm spending monthly/annually, which bills recur, what's coming (forecast),
and what to do about it. Multi-currency (USD, INR, CAD) because life spans the USA, India,
and Canada.

---

## System Overview

```
Capture                    Understand                    Advise
───────                    ──────────                    ──────
quick-add (NL text)   →                                  monthly/annual reports
CSV import            →    dedup gate → transactions →   recurring bills list
document scan/upload  →    (extract → review → save)     cash-flow forecast
manual entry          →                                  safe-to-spend
```

- **Backend**: FastAPI (async), SQLAlchemy 2.x, PostgreSQL, Alembic, JWT auth
- **Frontend**: React 19 + TypeScript + Vite, Radix UI Themes, CSS Modules, Zustand, Nivo
- **AI tiers**: (1) rules/statistics — always on; (2) local LLM via Ollama — private
  document understanding; (3) **Gemini free tier** (the single cloud provider — text +
  vision) — per-user **opt-in only**, off by default
- **External calls when idle**: exactly one — Frankfurter (ECB exchange rates), cached daily

---

## Data Model

### Today (v1 — implemented)
`users`, `accounts`, `categories` (hierarchical), `transactions`, `merchants`,
`bills` + `transaction_bill_links`, `goals`, `budgets`.
Integrity is sound: `Numeric(12,2)` money, FKs everywhere, unique constraints,
indexes on `(user_id, date)`, `(user_id, merchant_id)`, `(user_id, category_id)`.

### v2 — planned changes (Phase D)

> **Migration strategy**: no real data exists yet, so v2 goes directly into the models
> and Alembic gets **squashed to one clean initial migration**. Incremental migrations
> resume the day real data goes in.

**Transaction — new columns**
| Column | Type | Why |
|---|---|---|
| `currency` | `String(3)`, default user base | INR/CAD support; every aggregation converts to base currency |
| `source` | enum: `manual, quick_add, csv_import, document_scan` | provenance — trust and debugging |
| `import_hash` | `String`, indexed | exact-dedup key: `sha256(user, account, date, amount, normalized_desc)` |
| `document_id` | FK → `documents`, nullable | tap a transaction, see the bill/receipt it came from |

**New tables**
```
documents         (id, user_id, kind[receipt|bill|statement|other], file_path,
                   mime_type, status[pending|reviewed|rejected], extracted_json,
                   uploaded_at)
exchange_rates    (id, date, base, quote, rate)  UNIQUE(date, base, quote)
                   -- fed by Frankfurter, one fetch/day, works offline afterwards
balance_snapshots (id, account_id, date, balance, currency)   -- "Later" phase, net worth
insights          (id, user_id, kind, payload_json, period, dismissed, created_at)
                   -- optional cache for Phase I results; engines are pure functions first
```

**User**: add `base_currency` (default USD). `is_admin` already exists — admin panel gates on it.

**Per-user isolation**: every user has their own separate dashboard and data. All tables
carry `user_id` and every query filters on the authenticated user — insights, forecasts,
documents, and reports are computed per user, never shared. Admin role manages the system
(users, system categories, AI settings, backups) but has **no access to other users'
financial data**.

### Deduplication design (the "same bill twice" problem)

Every import path (CSV, statement scan, receipt scan) runs through one gate:

1. **Exact**: `import_hash` already exists → skip silently, count as "duplicate skipped".
2. **Fuzzy**: same amount ± 0.00, date within ±3 days, merchant similarity (normalized name)
   → flag as *possible duplicate*, show side-by-side in the review screen:
   **merge** (attach document to existing transaction) / **skip** / **keep both**.
3. Nothing auto-commits from a document. Extract → review screen → dedup → save.

This is what makes "scan the credit-card bill AND import the bank CSV" safe.

### Multi-country = multi-currency (deliberate simplification)

"Supporting USA, India, Canada" concretely means: transactions in USD/INR/CAD, reports in
base currency. It does **not** mean country-specific planning
engines — that's content layered on later, and nothing in this schema blocks it.

---

## Backend Architecture

```
backend/
├── core/          config, security, middleware
├── database/      models, session, alembic
├── routers/       thin HTTP handlers only        ← rule: no business logic here
├── services/      business logic (testable, no HTTP)
│   ├── insights/  recurring.py, trends.py, forecast.py, safe_to_spend.py   [Phase I]
│   ├── ingest/    dedup.py, csv_import.py, document_extract.py             [Phase S]
│   └── fx.py      exchange-rate fetch + conversion                          [Phase D]
└── tests/         pytest — money paths are mandatory                        [Phase T]
```

Known debt: `routers/transactions.py` is ~750 lines of inline logic. Rule going forward:
**any logic an insight engine will also need lives in a service, not a router.** Extract
opportunistically while building Phase I, not as a big-bang refactor.

The intelligence engines are **pure functions** (`list[Transaction] → list[Insight]`):
trivially testable, no DB coupling, cacheable later via the `insights` table if needed.

### Recurring detection (Phase I core)
Group by merchant → check amount consistency (exact = subscription; ±20% = utility) and
interval consistency (gaps ≈ 7/14/30/90/365 days ± tolerance) → 3+ matches = recurring
→ emit predicted next date + amount. Feeds the bills list, the forecast, and reminders.

### Forecast (Phase I core)
Day-by-day simulation, 60–90 days out: start from current balance; add income on expected
paydays; subtract recurring bills on predicted dates; subtract average daily discretionary
spend. Outputs: balance curve, crunch-point warnings, and **safe-to-spend** =
today's balance − obligations before next payday.

---

## Frontend Architecture

Desktop and mobile stay **separate trees with separate roles**, organized by the
question-shaped page map in `design-system.md` §3:

- **Desktop — 5 pages**: Home (am I okay?), Activity (what happened?), Recurring
  (what repeats?), Insights (where does money go?), Manage (fix/configure + admin).
  Database tables get maintenance tabs inside Manage, never top-level pages.
- **Mobile — 3 tabs + capture**: Home, Activity, Capture (scan / NL quick-add).
  Management screens deliberately don't exist on mobile.

Phase U is a **rebuild to that map, not a restyle**: the shell (auth flow, routing,
axios interceptor, store infrastructure, theme) is kept; pages are built fresh; the old
8-section trees are deleted as their contents are absorbed.

### Target folder structure

Today non-visual code is scattered across three homes (`src/auth/`, `src/hooks/`,
`src/utils/` **and** `src/shared/utils/`). Target — one rule: **`desktop/` and `mobile/`
contain only `.tsx` + `.module.css`; anything without JSX lives in `shared/` or `store/`.**

```
frontend/src/
├── desktop/            # UI only: pages/ (Home, Activity, Recurring, Insights, Manage),
│   ├── pages/          #   components/, layouts/ — .tsx + .module.css, nothing else
│   ├── components/
│   └── layouts/
├── mobile/             # UI only: pages/ (Home, Activity, Capture), components/, layouts/
├── shared/             # everything non-visual, used by both trees
│   ├── api/            # axios client + endpoint functions (absorbs src/auth api client)
│   ├── hooks/          # data hooks (absorbs src/hooks)
│   ├── types/          # single source of truth for API types — no local page copies
│   └── utils/          # format, dates (absorbs src/utils)
├── store/              # zustand slices (authSlice absorbs src/auth state logic)
├── styles/             # design-tokens.css, global css
└── theme.tsx           # the one theme file — all color defined here + design-tokens.css
```

Cross-imports between `desktop/` and `mobile/` stay banned; both import freely from
`shared/` and `store/`.

State: Zustand slices (existing pattern). Styling: Radix UI + CSS Modules, tokens defined
once in `styles/design-tokens.css` per `design-system.md`.

---

## Privacy Architecture

| Tier | What | Where data goes | Default |
|---|---|---|---|
| 1 | Rules + statistics (parsing, insights, forecast) | nowhere | always on |
| 2 | Ollama local LLM (chat, document understanding) | localhost | on if Ollama installed |
| 3 | Gemini free tier (sole cloud provider; NVIDIA/Groq removed in T5) | Google | **off**; per-user opt-in with warning |

### AI task allocation — what runs where (decided)

**The rule: private by default, cloud by informed choice.** Every AI feature works
without any cloud call (rules, or Ollama if installed). Cloud providers (Gemini/Groq/
NVIDIA free tiers — capable, and "free" because free-tier prompts may be used to train
their models) are a **per-user opt-in**: a settings toggle with an explicit "your
financial data will be sent to third-party AI services" warning. Toggle off (default) =
nothing ever leaves the machine. Toggle on = cloud becomes the fallback when local can't
do the job. One user enabling it never affects another user's data.

| Task | Runs on | Why |
|---|---|---|
| NL quick-add parsing (`coffee 4.50`) | **Rules first, local AI fallback** | Rules handle common shapes; typo'd merchants fixed by fuzzy matching (deterministic, not AI); Ollama parses only what rules can't — preview always shown before save; never cloud |
| Recurring/subscription detection | **Rules** | Pure statistics (merchant + amount + interval) |
| Trends, anomalies, MoM/YoY comparisons | **Rules** | Arithmetic over the DB |
| Cash-flow forecast, safe-to-spend | **Rules** | Day-by-day simulation, no AI needed |
| Duplicate detection on import | **Rules** | Hashing + fuzzy matching |
| Category suggestion for known merchants | **Rules** | History lookup (Walmart → groceries last 10 times) |
| Receipt/bill photo understanding | **Local AI; cloud if opted in** | Ollama vision by default; Gemini vision allowed as fallback only when the user's toggle is on |
| Bank/credit-card statement parsing | **Local AI; cloud if opted in** | Most sensitive document type — the opt-in warning names it explicitly |
| Ambiguous transaction categorization | **Local AI; cloud if opted in** | Sees descriptions + history |
| Chat over MY data ("where did my money go?") | **Local AI; cloud if opted in** | Engines compute the numbers (tier 1); the model (local or cloud) only narrates |
| Insight wording/summaries | **Templates first, local AI optional** | A sentence template is often better than a model |
| Savings recommendations & advice ("cut X, save $Y/mo") | **Rules generate, local AI words it** | The advice itself comes from deterministic rules over real numbers (rank recurring charges, flag increases, budget drift) so it's always explainable and never hallucinated; local AI may only rephrase, never invent |
| Generic finance questions ("what is APR?") | **Local AI or cloud** | No personal data in the prompt — safe either way |
| OCR fallback with no Ollama and toggle OFF | **Tesseract (local, no AI)** | Degrade locally — never *silently* route to cloud |

What this means concretely: **with the toggle off (the default), external AI receives
nothing — ever.** With the toggle on, cloud may serve any AI task as a fallback, but
only via the shared AI provider layer that checks the per-user toggle on every call —
no code path may call a cloud API directly. Silent fallback is banned: routing to cloud
because Ollama is missing, without the user having opted in, is a bug.

Everything else is local: Postgres in Docker, files on disk, exchange rates cached after
one daily fetch. Backups are the user's responsibility but scheduled by the app's scripts
(`DEVELOPMENT.md` §Backups).

---

## Quality Bar

- **Tests**: money math is never merged untested (parser, aggregations, dedup, fx
  conversion, recurring detection, forecast). UI polish doesn't need tests; arithmetic does.
- **Migrations**: every schema change ships with an Alembic migration, up and down.
- **Review**: every change is checked against `rules/code-review.md` before commit.
- **Docs**: `plan.md` checkboxes updated with each phase; this file updated when the
  architecture actually changes. Stale analysis reports go to `docs/archive/`, not here.
