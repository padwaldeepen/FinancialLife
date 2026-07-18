# DRY Rule

**If the same logic would need to be written twice, it goes in one shared place —
never copy-pasted, never "close enough" reimplemented.** This applies across the whole
stack, not just within a file.

## Where duplication tends to sneak in on this project

- **Desktop/mobile pairs.** The two trees stay visually and structurally separate
  (`rules/frontend.md`, `rules/ui-ux.md`) — that rule is about layout and CSS, **not**
  business logic. Validation, data transforms, formatting, API calls: one
  implementation in `shared/` or a `store/` slice, imported by both trees. Real example
  fixed 2026-07-17: `Register.tsx` (desktop + mobile) each had a byte-identical
  15-line `validate()` function — moved into `registerFormSlice.ts` as
  `validateRegisterForm()`, called by both, deleted from both components.
- **Backend routers.** If two endpoints build the same SQL fragment, response shape, or
  business rule inline, extract it into `services/` (already the project's separation
  of concerns — `rules/backend.md`). Don't let a second router hand-roll what the first
  one already solved.
- **Frontend components with parallel forms/dialogs.** A create dialog and an edit
  dialog for the same entity should share validation and field logic, differing only in
  which action they call on submit.

## What DRY does *not* mean here

- Two components rendering *similar-looking* JSX is not duplication if the underlying
  data/behavior differs — don't force an abstraction over coincidental similarity.
  Three similar lines of JSX beats a premature shared component.
- Desktop and mobile CSS/layout are **never** shared, even when they'd look almost
  identical today — that's an explicit, permanent exception (device roles differ,
  `docs/design-system.md` §3), not a DRY violation.
- Don't invent a shared abstraction for logic used exactly once "in case it's needed
  again." DRY triggers on actual duplication, not anticipated duplication.

## Gotcha: `@keyframes` in CSS Modules can't be deduplicated into a shared global file

Tempting-looking duplication that **isn't safe to fix the obvious way**: ~20 `.module.css`
files each define an identical `@keyframes fadeIn { ... }` even though the exact same
keyframe already exists once, globally, in `styles/design-tokens.css`. Deleting the local
`@keyframes` block and relying on the global one *looks* like a clean DRY fix, but this
project's CSS Modules pipeline (Vite) locally-scopes any identifier used in an `animation`/
`animation-name` property inside a `.module.css` file **unconditionally** — it doesn't check
whether a matching local `@keyframes` actually exists in that file first. The `animation:
fadeIn ...` declaration gets rewritten to a hashed name (e.g. `_fadeIn_10buw_1`) regardless,
and once the local keyframe is deleted, that hashed name points at nothing — the animation
silently becomes a no-op (found and reverted 2026-07-17; confirmed via
`getComputedStyle(...).animationName` plus a `document.styleSheets` scan showing the hashed
keyframe didn't exist). **The per-file `@keyframes fadeIn` blocks are intentional, not
duplication to fix** — leave them. If a shared entrance animation is ever wanted, the only
safe route is a literal, unscoped global class (not a CSS Modules file) applied via
`className` alongside the module class, not a shared `@keyframes` referenced from inside
a module.

## Enforcement

- Before writing logic in a component/router, check whether it already exists
  elsewhere (grep for the field names / behavior first).
- When D5-style discoveries happen — you find duplication while doing something
  else — log it in `docs/backlog.md`'s parking lot and tie it to a specific ticket, the
  same way the `AddTransactionModal` 6-`useState` issue was handled. Don't fix
  out-of-scope duplication mid-ticket; don't let it go unrecorded either.
- Part of `rules/code-review.md`'s checklist — a diff introducing the same logic in two
  places is a 🟡 at minimum.
