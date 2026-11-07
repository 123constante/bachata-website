# Walk fix #1439: "Back to events" label sits at the top of its button

Brief-version: 1
Branch: claude/door-no-access-dead-end (continue the existing branch and PR #1439; do not open a new PR)
Lane: fast/normal, Sonnet. 1-2 files, no migration.

## What main lacks
- On the refused door card the link "Back to events" has its label pinned to the top while the sibling button "Check again" is vertically centred (walked 390x844, both about 56px tall) -- proof: grep: `p3-btn p3-btn-line p3-door-big` at src/modules/organiser/p3/door/DoorScreen.tsx:308 (a Link, not a button, so button flex centring does not apply)

## Build
0. Write a short INVENTORY.md: the two refused-card controls and their classes (file:line); coverage count at the end.
1. Make the Link centre its label the same way the button does: find the shared `.p3-btn` / `.p3-door-big` CSS and add `display:inline-flex; align-items:center; justify-content:center` for anchors (or the same rule the button uses), so both look identical. Explicit px sizes, no rem. Change the shared rule only if no other p3-btn Link regresses; check other `<Link className="p3-btn` uses.
2. Keep min height at least 44px; do not change copy or targets.

## Tests
Table-driven check that both refused-card controls carry the same centring classes/styles (assert the computed class list or the CSS rule that centres both); red against the unfixed code.

## Hard limits
- Website repo only; no supabase/migrations; Supabase read-only; no workflow edits, no .env*; push once to the existing branch; run every CI job step; never --no-verify; end with [worker-done walkfix-1439].
- Update the PR body honestly; the 390x844 re-walk is the lead's.
