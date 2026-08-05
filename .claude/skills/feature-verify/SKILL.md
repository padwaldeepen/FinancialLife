---
name: feature-verify
description: Verify a feature or bug fix actually works by driving the running app with Playwright MCP — navigate the real UI, perform the flow, capture screenshot evidence, and report pass/fail. Use after implementing any feature or fix, before marking work done.
---

# Feature Verification via Playwright

"Tests pass and lint is clean" is not proof a feature works. This skill proves it by
exercising the change **through the real UI** with the Playwright MCP tools.

## Steps

1. **Ensure the app is running.** Check `http://localhost:3000` responds; if not, start it
   (`docker compose up -d`, or dev mode: `uvicorn main:app --port 8080 --reload` +
   `npm run dev`). Wait until both frontend and backend `/health` respond.
2. **Always verify BOTH viewports.** The app has two separate UI trees, switched at
   1024px, and shared logic/store changes affect both — so every verification runs twice:
   - **Desktop**: default desktop viewport (≥1024px wide)
   - **Mobile**: resize to 390×844 **before** loading the page
   The flow must pass in both. If the changed feature deliberately doesn't exist in one
   tree (per the design-system page map), verify that it is genuinely absent there —
   absence is the expected behavior, confirm it.
3. **Log in** with the local test user (create one via the register flow if none exists —
   never use real personal credentials in verification). Delete any throwaway account
   created for this verification pass once done (e.g. `DELETE FROM users WHERE email = ...`)
   — don't leave test data in the database.
4. **Drive the exact flow that changed.** Not a smoke test of the home page — the actual
   feature: if the fix was "notes save correctly," edit a note, reload, confirm it
   persisted. If the feature was "CSV import dedup," import a file twice and confirm the
   duplicate is flagged, not double-inserted.
5. **Assert visible outcomes, especially numbers.** For anything involving amounts,
   verify the displayed number is *correct*, not merely present (e.g., after adding a
   $25 expense, the month total increased by exactly 25.00).
6. **Check the browser console** for errors/warnings introduced by the change.
7. **Capture screenshot evidence** of the end state in **both viewports**.

## Report format

- **Verdict**: ✅ verified working / ❌ not working / ⚠️ works with caveats
- **Flow exercised**: the steps performed, in one or two sentences
- **Evidence**: screenshot(s) + the concrete assertion that passed or failed
  (expected vs. actual, with numbers)
- **Console**: clean, or list of new errors/warnings
- If ❌ or ⚠️: what's broken, where it diverged, and the likely file to look at

Never report "verified" without having driven the flow — if the app can't be started or
the flow can't be reached, say so explicitly and stop.
