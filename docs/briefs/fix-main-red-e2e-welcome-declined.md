# BRIEF: fix-main-red-e2e-welcome-declined (WEBSITE; branch `claude/fix-main-red-e2e-welcome-declined`; normal lane; `E2E Smoke` red on main)

Brief-version: 2
Owner rule 2026-11-05: the lead owns every red on main. You never approve or merge.

## Measured cause
`E2E Smoke` run 42002394483 on main 4fad7f0 (step "Run E2E P3 walk specs (P3 flags on)", spec `tests/e2e/walk-p3-welcome-declined.spec.ts` line 140, "dark > one declined with a note: date and note shown, card inside the phone"): `expect(box.x + box.width).toBeLessThanOrEqual(PHONE.width + 0.5)` at line 105 (`inViewport`) fails: the declined card's right edge is past 390.5 px on the 390x844 phone. The same spec's light variants (lines 140 and 169) failed once on PR #1374 and passed on the rerun and on main a722e24 / ddce88a, so it is INTERMITTENT, not a one-off. Hypotheses to test, not to assume: (a) the card is measured while an entrance animation / transform is still running (box mid-slide), (b) a long note or date makes the card wider than the phone in some data shapes, (c) a scrollbar or font-load reflow in CI.

## What main lacks
- A deterministic cause for the intermittent width failure and a fix at the right layer (layout if the card can really overflow; the measurement if it is read mid-animation) -- docs/handover/fix-main-red-e2e-welcome-declined.md
- A test that fails when the declined card can exceed the 390 px phone for the longest real note and date shapes -- grep: declined card never wider than the phone

## What to do
1. Read the failing run's artifacts (`test-results/walk-p3-welcome-declined-*/test-failed-1.png`, trace) via the run log; measure the real box at failure.
2. Reproduce locally: run the spec 20 times (`--repeat-each 20`) on unfixed main; record the failure rate (state the exact number).
3. Fix at the right layer. If it is layout (card wider than the phone for long notes/dates), fix the CSS with explicit px sizes (the site's rem is about 13.5px on phones) and add a table-driven test over note lengths x date shapes. If it is measurement timing, wait for the animation to settle with a web-first assertion, never a sleep.
4. Red first: show the new test failing on unfixed code, then passing. Run the spec 20 times after the fix: 0 failures.
5. Run every CI job step that applies; per-job table; the PR body needs the exact labels `Verified on real data:`, `- Shapes surveyed:`, `- Checks run:`, `NOT verified:` and a `## Phone QA` section (390x844 walked) if you change a .tsx or .css file.
6. COMMITS: separate plain commands: `git add <files>`, `git commit -F <msgfile>`, `git push origin claude/fix-main-red-e2e-welcome-declined`. No `&&` chains, no `-c` flags. ONE push; final subject ends with your ticket's done marker.

## Files
- tests/e2e/walk-p3-welcome-declined.spec.ts
- the declined card component under src/modules/organiser/ (find by grep for the spec's test ids)
- docs/handover/fix-main-red-e2e-welcome-declined.md
