---
name: finance-review
description: Review the current diff against this project's finance-specific rules — money math, per-user isolation, dedup gate, migrations, theme-token colors — and report a dimension-by-dimension review matrix. Use before committing any change.
---

# Finance-Specific Code Review

Review the working-tree diff (`git diff` + `git diff --cached`; if clean, review the last
commit) against `rules/code-review.md` — read that file first, it is the source of truth.
Then evaluate the diff across the eight dimensions below and report the review matrix.

## Review dimensions

| # | Dimension | What to check |
|---|-----------|---------------|
| 1 | **Money math** | All amount arithmetic in `Decimal`/`Numeric(12,2)` — no `float()` casts, no `sum()` over floats, no JS `number` math on money before it reaches the API; amounts validated `> 0`; `tabular-nums` right-aligned display |
| 2 | **Isolation & security** | Every financial query filters a validated `profile_id` (profile must belong to the JWT user); profiles never merged in any query/report/export; every endpoint has `Depends(get_current_user)` unless explicitly public; no admin path can read anyone's financial data; no secrets in code/logs; no outbound calls except Gemini behind the per-user opt-in toggle |
| 3 | **Data & migrations** | Model change → Alembic revision (with downgrade) in `backend/database/alembic/versions/`; enum-ish strings validated via `Literal`; new query patterns indexed; import paths compute `import_hash` and run the fuzzy-dedup check |
| 4 | **Error handling** | Failure paths return proper HTTP codes, not 500s; frontend surfaces errors (no silently swallowed promises); `await` on every `db.execute()` — the "bills always paid" bug class |
| 5 | **Performance** | No N+1 queries (use `selectinload`); no unbounded fetches (pagination/limits on new list endpoints); no per-render recomputation of derived data in React |
| 6 | **UI / design system** | Colors only from theme tokens (slate/orange; green/red on amount text only); Radix components per `rules/frontend.md`; spacing tokens + grid per `docs/design-system.md`; skeleton/empty/error states present |
| 7 | **Tests** | Changed money math (parsing, aggregation, conversion, detection, forecast) has pytest coverage asserting real numbers; missing test on money math is always at least 🟡 |
| 8 | **Code quality** | Clear naming; functions do one thing; no business logic in routers; no dead code; no desktop/mobile copy-paste (shared logic in `shared/`/`store/`) |

## Output format

**1. Findings** — ranked by severity, each with `file:line` and a concrete failure scenario:
- 🔴 **Critical** — wrong numbers, data loss/corruption, isolation leak, missing migration
- 🟡 **Warning** — rule violation that won't corrupt data (off-palette color, fat router, missing test)
- 🟢 **Suggestion** — simplification, naming, dead code

**2. Review matrix** — one row per dimension, always all eight:

| Dimension | Status | Findings |
|-----------|--------|----------|
| Money math | ✅ / 🟡 / 🔴 / — | count or "not touched" |
| Isolation & security | … | … |
| Data & migrations | … | … |
| Error handling | … | … |
| Performance | … | … |
| UI / design system | … | … |
| Tests | … | … |
| Code quality | … | … |

Status = worst finding in that dimension; ✅ = checked, clean; — = diff doesn't touch it.

**3. Verdict** — one line: **ready to commit** or **fix criticals first**.
