# Design System — Minimalist, Three Colors

> Last updated: 2026-07-17
> The rulebook for the Phase U redesign. `rules/ui-ux.md` enforces this during coding.
> Philosophy: **a finance app should feel like a well-set ledger — quiet paper, clear ink,
> one accent that means "act here", and money coloring only the money.**

---

## 0. What current fintech design research validates (grounding this doc)

Researched 2026 fintech/UI trend sources before finalizing this spec (full list in §6).
The findings didn't change the direction — they confirm it and sharpen a few details:

- **Neutral + single accent + semantic success/error is the current standard color
  structure** for fintech UI, not a constraint we're inventing — this doc's 3-color rule
  already matches it exactly.
- **"Elevated neutrals" over stark pure white**: 2026 palettes favor soft, slightly warm
  greys over harsh `#FFFFFF` backgrounds. Radix `slate-1`/`slate-2` already aren't pure
  white — this doc formalizes *never* dropping to true white or true black (§1).
- **Flat cards, minimal-to-no shadows** is the dominant card treatment — validates §2's
  existing "no shadows" rule.
- **Bottom nav for 3–5 destinations, thumb-reachable** is the confirmed mobile pattern —
  validates the 3-tab + Capture structure in §3 exactly (research even cites bottom-tab
  vs. hamburger A/B results: ~40% faster task completion).
- **70% of users abandon a fintech app over complex navigation** — the strongest
  available argument for the question-shaped 5-page IA over the old 8-tables-as-pages
  structure. This number is now the standing justification for §3.
- **New addition: "calm interfaces."** 2026's dominant UX direction is explicitly
  *reducing* cognitive load and decision count, not just visual minimalism — motion
  becomes functional-only (state changes), never decorative or celebratory. New rule
  added to §4.
- **New addition: "transparent AI."** Users expect to see *why* a suggestion appeared,
  how confident the system is, and a clear way to override or dismiss it — not a black
  box. This became a hard requirement on every insight/recommendation card (§4), and it
  reinforces a rule already implicit in Phase I: no insight number without visible
  evidence.
- **New addition: data storytelling over static reports.** The trend is away from flat
  monthly statements toward interactive timelines the user can scrub through spending
  history on. Folded into the Insights page spec (§3).
- **Cross-platform consistency means consistent *data*, not consistent *UI*** — the
  research explicitly separates these. This validates the existing device-role split
  (shared logic/store, separate layouts) rather than contradicting it.

---

## 1. The Three Colors

Everything on screen comes from exactly three color roles, expressed as Radix scales so
light/dark mode works for free:

| Role | Radix scale | Used for |
|---|---|---|
| **Paper** (neutral background) | `slate` steps 1–5 | page background, cards, wells, borders |
| **Ink** (neutral foreground) | `slate` steps 9–12 | all text, icons, dividers, muted labels |
| **Accent** | `orange` steps 9–11 | primary buttons, active nav item, focus rings, links, selected states — *the things you can act on* |

**Semantic money colors — the only exception, and it is narrow:**
- `green-11` — income/positive **amounts only**
- `red-11` — expense/negative **amounts only**, and destructive-action confirmation buttons

They color *numbers*, never containers, never badges, never charts backgrounds, never icons.

### Hard rules
0. **One theme file controls all color.** `src/theme.tsx` (Radix `<Theme accentColor
   grayColor>`) plus `src/styles/design-tokens.css` are the *only* places color is defined.
   Changing the accent in `theme.tsx` must restyle the entire app — if any element doesn't
   follow, that element is a bug.
1. No hex codes in any `.module.css` — Radix tokens (`var(--slate-3)`, `var(--orange-9)`) only.
2. No third hue anywhere: no blues, purples, yellows, teals. Category colors in the DB are
   **not rendered as colors** — categories are distinguished by name + icon, in ink.
3. Charts are monochrome-first: accent for the current/selected series, slate steps for the
   rest. A pie chart with 8 rainbow slices becomes a sorted slate bar list with the top item
   in accent.
4. Accent is scarce. If a screen has more than ~3 accent elements visible, it's wrong —
   accent means "this is the action", and everything can't be the action.
5. Dark mode = same three roles, Radix flips the scales. Never hand-pick dark variants.
6. **No stark white or black backgrounds.** Page background is `slate-1`/`slate-2`, not
   `#FFFFFF`; deepest dark-mode surface is `slate-1` dark, not `#000000`. "Elevated
   neutral," not paper-white — see §0.

---

## 2. Layout & Alignment (fixing "containers don't line up")

One spacing scale, one grid per layout, zero ad-hoc margins.

- **Spacing**: Radix space tokens only (`var(--space-1..9)`). No raw px margins/paddings.
- **Desktop grid**: sidebar `240px` fixed + content column `max-width: 1200px`, centered,
  `var(--space-6)` gutters. Every page's cards/tables snap to a **12-column grid** inside
  that container. Nothing is ever positioned "roughly".
- **Mobile grid**: single column, `var(--space-4)` side padding — the same value on *every*
  screen, header, and sheet. Full-bleed only for the bottom tab bar and pull-to-refresh.
- **Card anatomy** (identical everywhere): `var(--space-4)` internal padding, `--radius-3`,
  1px `slate-4` border, **no shadows** (flat, minimalist), title in `slate-11` 13px caps or
  medium weight — pick one and use it on every card.
- **Vertical rhythm**: section gaps are `var(--space-5)` on mobile, `var(--space-6)` on
  desktop. Always. This single rule fixes most "misaligned" feel.
- **Numbers**: all amounts right-aligned, `font-variant-numeric: tabular-nums`. Currency
  symbol and digit grouping come from the **active profile's country** via
  `Intl.NumberFormat` (en-US `$1,234.56` · en-IN `₹1,23,456.00` · en-CA `C$1,234.56`).
  One currency per screen, always — profiles never mix, so no conversion line ever.

**Definition of aligned:** on any page, you can draw 4 vertical lines that every element
snaps to. If an element needs a 5th line, redesign the element.

---

## 3. Information Architecture — question-shaped, not table-shaped

Pages answer questions. Database tables (categories, merchants, goals…) get maintenance
tabs inside **Manage**, never top-level navigation — one page per table is Excel thinking.
Feature parity between devices is a **non-goal**.

### Desktop — 5 destinations
| Page | Question it answers | Contents |
|---|---|---|
| **Home** | Am I okay right now? | safe-to-spend hero, forecast curve, insight cards, next bills, recent activity |
| **Activity** | What happened? | transactions table, search/filters, bulk edit, import + dedup review queue |
| **Recurring** | What repeats, what's due? | bills + auto-detected subscriptions + budgets in one view; total-per-month headline; predicted next dates |
| **Insights** | Where does my money go? | monthly/annual breakdowns, MoM/YoY trends, category & merchant analytics, **an interactive spending timeline** (scrub through months to see when/why spending spiked — data storytelling over a static table, §0) |
| **Manage** | Fix or configure something | accounts, categories, merchants, goals CRUD, CSV import, AI settings; admin panel (`is_admin` only) |

Goals: progress surfaces on Home/Insights; CRUD lives in Manage. No top-level Goals page.
Keyboard: `Cmd/Ctrl+N` quick-add, `/` search, `Esc` closes every dialog. The fixed
240px sidebar is a standard **navigation rail** — the current desktop equivalent of
mobile bottom nav (§0) — icon + label, active item in accent, nothing else colored.

### Mobile — 3 tabs + capture button
| Tab | Contents |
|---|---|
| **Home** | safe-to-spend hero, next 3 bills, this-month-vs-usual bar |
| **Activity** | recent list, search, simple filters — read-mostly |
| **Capture** (center) | *Scan* (camera → document pipeline) / *Type* (NL quick-add) — two taps from anywhere to a saved transaction |

Settings behind the avatar. **Categories, Merchants, Reports, Goals, and More pages do
not exist on mobile** — deleting those cramped duplicates *is* the redesign. Home +
Activity + Capture is exactly 3 primary destinations — inside the 3–5 range research
confirms is the ceiling before mobile navigation quality collapses (§0).

### Patterns borrowed from the best apps in the market
- **Safe-to-spend hero** (Simplifi): the one number users check daily; automated
  awareness, never YNAB-style manual envelope discipline
- **Subscriptions list** (Rocket Money): every recurring charge with monthly cost and
  next date under a total-per-month headline — their $48/year headline feature, ours free
- **Spending-vs-usual bar** (Rocket Money): "spent $1,400 of your usual ~$2,100 this
  month" — computed from history, requires zero budget setup
- **Mobile restraint** (Monarch's documented mistake, inverted): cramming desktop parity
  into mobile made theirs overwhelming; ours stays capture & glance

### Shared
Logic, hooks, formatting, store slices — shared. Layout CSS — never shared.

---

## 4. Components & States

- Radix UI Themes components only (`rules/frontend.md` has the tag-replacement map);
  CSS Modules position them. No raw divs for things Radix provides.
- **Empty states**: every list/chart has one — one slate icon, one sentence, one accent
  action. Never an empty white rectangle.
- **Loading**: Radix `<Skeleton>` shaped like the real content. No spinners on page bodies,
  no "Loading..." text.
- **Insufficient data** (insights/forecast): say it plainly — "Need ~2 months of data to
  forecast. You have 3 weeks." Honest beats clever.
- **Confirmation**: Radix `<AlertDialog>`, destructive confirm button in red. `window.confirm`
  is banned.
- **Quick-add follow-up (the one-question rule)**: after parsing, show the preview
  (amount, description, category, account, date) with every field tappable to correct.
  If — and only if — the **amount** is missing, ask one inline follow-up ("How much was
  Netflix?") with a focused number field. Never ask about date (defaults to today; the
  parser understands "yesterday", "last friday", "on the 1st" when volunteered), category,
  or account (inferred from history, correctable in the preview). More than one question
  per entry is a design failure.
- **Typography**: system font stack via Radix; sizes from Radix type scale only. Two weights
  (regular, medium). No thin fonts for numbers.
- **Charts**: Nivo only — no other chart library, no hand-rolled SVG charts. Colors follow
  §1 rule 3 (accent for the selected series, slate steps for the rest); axes/labels in ink;
  no chart legends when direct labeling fits.
- **Motion — functional only** (§0 "calm interfaces"): animation communicates a state
  change (loading, saved, expanded/collapsed, page transition) — never decoration.
  Banned: confetti/celebration effects, bouncy/elastic easing, animated number
  count-ups on every render, anything that exists purely to feel "delightful." A saved
  transaction gets a brief, calm confirmation (e.g. a checkmark fade) — not a burst.
- **Transparent AI — every insight/recommendation card must show its evidence** (§0):
  the number(s) the claim is based on, visible inline or one tap away (never a bare
  claim with no receipt) — this is also `docs/backlog.md` I6's existing "no number
  without evidence" rule, now traced to the same research finding. Each card has a
  visible **dismiss**, and dismissing something the app got wrong measurably suppresses
  that insight type going forward (I2's "not a subscription" pattern generalizes here).
  Cloud-AI-generated text (when the user's opt-in is on) is visually marked as such —
  never presented identically to a rule-based, evidence-backed insight.

## 4b. Inspiration (calibrate the eye before building)

Before each rebuild step, spend a few minutes calibrating against modern minimal fintech
work — search Dribbble/Behance for “fintech dashboard minimal”, “finance app light UI”,
and browse real shipped flows on Mobbin (Rocket Money, Copilot). Steal **layout, spacing,
and flow** — never their palettes; ours is fixed at three colors (§1). If a reference
needs five colors to work, it's the wrong reference.

---

## 5. Rebuild Order (Phase U execution)

This is a **rebuild to the §3 page map, not a restyle** of the existing 8 sections.
Keep the shell (auth flow, routing, axios interceptor, store infrastructure, theme);
build new pages fresh; delete retired ones as their contents are absorbed.

1. `styles/design-tokens.css` + `theme.tsx` — encode this document; delete off-palette vars
2. Login + Register (both trees) — first impression, smallest scope, proves the system;
   centered single card, generous whitespace, accent on exactly one button
3. Home (desktop + mobile) — the daily screens; sets the standard
4. Activity (both) — extract shared logic from the old ~1,100-line twins while rebuilding
5. Recurring (desktop) — new page absorbing Bills + budgets (subscriptions section lands
   with Phase I detection)
6. Insights (desktop) — absorbs Reports + the analytics currently on Categories
7. Manage (desktop) — absorbs Settings + Categories + Merchants + Goals CRUD
8. Mobile Capture flow; delete mobile Categories/Merchants/Reports/Goals/More
9. Sweep: delete all retired pages/CSS, dark-mode audit, alignment audit against §2

Each step lands as its own commit, checked against this doc + `rules/code-review.md`.

---

## 6. Sources (§0 research, 2026-07-17)

- [Muzli — 50 Best Dashboard Design Examples for 2026](https://muz.li/blog/best-dashboard-design-examples-inspirations-for-2026/)
- [Onething Design — Top 10 Fintech UX Practices 2026](https://www.onething.design/post/top-10-fintech-ux-design-practices-2026)
- [Yellow Slice — Fintech UX Design Trends 2026](https://www.yellowslice.in/blog/fintech-ux-design-trends-you-must-know)
- [Recursion Agency — The Modern Color Palette: UI/UX Color Trends 2026](https://www.recursion.agency/blog/ui-color-trends-2026)
- [IxDF — UI Color Palette 2026: Best Practices](https://ixdf.org/literature/article/ui-color-palette)
- [Design Studio UIUX — Mobile Navigation UX Best Practices 2026](https://www.designstudiouiux.com/blog/mobile-navigation-ux/)
- [UXPin — Mobile Navigation Design: 8 Types, Examples & Best Practices 2026](https://www.uxpin.com/studio/blog/mobile-navigation-examples/)
- [Envato Elements — UX/UI Design Trends 2026: Calm Interfaces, Transparent AI, End of Visual Theatrics](https://elements.envato.com/learn/ux-ui-design-trends)
- [Index.dev — 12 UI/UX Design Trends That Will Dominate 2026](https://www.index.dev/blog/ui-ux-design-trends)
