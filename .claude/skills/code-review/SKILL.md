---
name: code-review
description: Review the current diff for correctness bugs, dead/duplicated behavior, and rule violations, using multi-angle finding + independent verification, then report a severity-tiered matrix (🔴/🟡/🟢) with file:line. Use before committing any non-trivial change. For money/finance-specific dimensions (amount math, per-user isolation, migrations), use finance-review instead or in addition.
---

# Code Review

Precision over coverage: every finding reported should be one a maintainer would
actually act on. This project's `finance-review` skill covers the eight
money/security/UI dimensions specific to this app — use this skill for everything
else (general correctness, dead code, duplication, rule violations).

## Phase 0 — Gather the diff

Run `git diff @{upstream}...HEAD` (or `git diff main...HEAD` if no upstream, or
`git diff HEAD~1` if neither applies). If there are uncommitted changes, also run
`git diff HEAD` and include working-tree changes in scope. If a PR number, branch, or
file path was passed as an argument, review that target instead.

## Phase 1 — Find candidates (up to 6 each, via parallel Agent tool calls)

Run these finder angles as independent agents. Give each the diff/range and this
project's `rules/*.md` files to check against (there is no CLAUDE.md here — `rules/`
is the equivalent source of truth: `frontend.md`, `backend.md`, `database.md`,
`dry.md`, `zustand.md`, `ui-ux.md`, `git.md`).

1. **Line-by-line scan** — read every hunk, then the enclosing function in the
   current file (not just the diff). Look for: inverted conditions, off-by-one,
   null/undefined deref, missing `await`, falsy-zero checks, copy-paste
   wrong-variable bugs, swallowed errors, stale import paths after file moves.
2. **Removed-behavior audit** — for every deleted/replaced line, name the invariant
   it enforced and confirm the new code re-establishes it. High-risk whenever pages
   are deleted/consolidated (does every capability of the old page survive
   somewhere? does every deleted route get a redirect?).
3. **Cross-file tracer** — for each changed function/type/moved file, Grep its
   callers and confirm the change doesn't break them (new precondition, changed
   return shape, stale import).
4. **Reuse** — new code that re-implements something `shared/` or an adjacent file
   already has. Name the existing helper.
5. **Simplification** — redundant/derivable state, deep nesting, dead code, more
   `useState` calls than `rules/zustand.md` allows (more than one piece of state →
   Zustand, not useState).
6. **Efficiency** — sequential awaits that could be `Promise.all`, N+1 query
   patterns, redundant fetches, work added to hot paths/mount.
7. **Altitude** — a bug patched at 2-3 call sites instead of fixed once at the
   shared mechanism (e.g. a decode workaround repeated per call site instead of one
   codec registered at the connection-pool level).
8. **Conventions** — quote the exact `rules/*.md` line broken and the exact diff
   line that breaks it. No vague "spirit of the doc" findings.

Pass every candidate with a nameable failure scenario through — do not silently drop
half-believed candidates.

## Phase 2 — Verify (1 vote per candidate, 3-state)

Dedup candidates pointing at the same line/mechanism, keeping the most concrete one.
For each survivor, run one independent verifier agent: give it the diff and the
file(s), and have it return CONFIRMED (names the trigger, quotes the line),
PLAUSIBLE (mechanism real, trigger uncertain), or REFUTED (quote the line/rule that
disproves it). Drop REFUTED candidates. Correctness bugs always outrank
cleanup/altitude/conventions findings if a cap forces a cut.

## Output format

**1. Findings** — ranked by severity, each with `file:line` and a concrete failure
scenario, at most 8:
- 🔴 **Critical** — wrong output, crash, data corruption/loss, broken user flow
- 🟡 **Warning** — real bug or inefficiency that doesn't corrupt data/break a flow
- 🟢 **Suggestion** — duplication, dead code, convention violation, simplification

Report as a markdown table: `File | Line | Issue`, grouped under each severity
heading — do not use the ReportFindings tool for this skill (that tool's format
doesn't render the severity tiers this project wants); print the table directly.

**2. Verdict** — one line: **ready to commit** or **fix criticals first**.
