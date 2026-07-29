# Code Review Checklist

> Apply to every diff before committing — whether the code came from a human, opencode,
> Claude Code, or any other tool. In Claude Code, `/code-review` runs an automated pass;
> this checklist is the bar either way.

## Correctness (blockers)

- [ ] Money math uses `Decimal`/`Numeric(12,2)` end to end — never float arithmetic
- [ ] Every financial query filters by a validated `profile_id` (backend confirms the
      profile belongs to the JWT user) — two-level isolation: person from person,
      country profile from country profile; **profiles are never merged in any query,
      report, or export**; admin included
- [ ] Ownership checked before mutating any resource (transaction, bill, goal, document)
- [ ] Async correctness: every `db.execute()` / service call is awaited
- [ ] Enum-ish strings (`transaction_type`, `frequency`, `period`, `source`, `currency`)
      validated via `Literal`/enum — no free-form strings into the DB
- [ ] Amounts validated `> 0`; dates validated sane
- [ ] Import paths run through the dedup gate (`import_hash` + fuzzy match) — nothing
      double-inserts

## Schema & data

- [ ] Schema change → Alembic migration included, with a working downgrade
- [ ] New columns have sensible defaults for existing rows
- [ ] New query patterns covered by an index if they filter/sort large tables

## Error handling

- [ ] Failure paths return proper HTTP codes with useful messages — no bare 500s
- [ ] Frontend surfaces errors to the user; no silently swallowed promises/catches

## Performance

- [ ] No N+1 queries — relationships loaded via `selectinload`
- [ ] New list endpoints are paginated/limited; no unbounded fetches
- [ ] No expensive recomputation per React render (memoize derived data)

## Tests

- [ ] New/changed money math (parsing, aggregation, conversion, detection, forecast) has
      pytest coverage — UI polish doesn't need tests; arithmetic does
- [ ] Tests assert real numbers, not just "no exception"

## Frontend

- [ ] Colors only from theme tokens — no hex/rgb/hsl in `.module.css` (one theme file
      controls all colors; see `rules/ui-ux.md`)
- [ ] Radix components per the replacement map in `rules/frontend.md` — no raw divs for
      things Radix provides
- [ ] Spacing via Radix space tokens; screen follows the grid rules in `docs/design-system.md`
- [ ] Loading (Skeleton), empty, and error states exist for new views
- [ ] No cross-imports between `desktop/` and `mobile/`; shared logic lives in
      `shared/`/`store/`, not copy-pasted between trees

## Security & privacy

- [ ] New endpoints require auth (`Depends(get_current_user)`) unless explicitly public
- [ ] No secrets, keys, or personal financial data in code, logs, or committed files
- [ ] No new outbound network calls except Gemini behind the per-user opt-in toggle —
      **the app has zero other external calls by design**
- [ ] **Cloud AI only through the provider layer, gated by the per-user opt-in toggle**
      (allocation table in `docs/architecture-and-goals.md`): no code path calls a cloud
      API directly; toggle off (default) = zero outbound AI calls; Ollama missing + toggle
      off = degrade to rules/Tesseract, never silently to cloud; **free tiers only** — no
      paid API usage anywhere

## Verification

- [ ] Feature/bug-fix diffs verified in the **running app** by driving the changed flow
      with Playwright (`.claude/skills/feature-verify/SKILL.md`) — not just tests/lint;
      displayed numbers asserted correct, console clean, and **both viewports always**:
      desktop (≥1024px) and mobile (390×844) — the trees are separate, so passing on one
      proves nothing about the other

## Hygiene

- [ ] Lint + format clean (frontend: `npm run lint:fix && npm run format:fix`;
      backend: `ruff check . && ruff format .`)
- [ ] No dead code left behind (unused components, endpoints, imports, CSS) — and no
      retired code left half-removed: if a decision says something is gone, verify it's
      actually gone from every file, not just undocumented (`rules/dry.md` applies to
      deletions too — check config/env files, not only source)
- [ ] No new business logic in routers — it belongs in `services/`
- [ ] **DRY** (`rules/dry.md`): no logic copy-pasted between desktop/mobile trees or
      between routers — shared behavior lives once, in `shared/`/`store/`/`services/`
- [ ] **No over-engineering**: no new file/component/helper carved out for 3-4 lines
      used exactly once (`rules/frontend.md`) — a premature extraction is as much a
      finding as duplication is; call it out the same way
- [ ] `docs/plan.md` checkbox updated if the change completes a roadmap item
