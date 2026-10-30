# Review PR #1180 (read-only) - ticket review-1180

Repo 123constante/bachata-website, branch claude/p3-prefix-d-door (builder: Opus). You are the independent reviewer. Do NOT edit src, do NOT push to that branch, never merge or approve.

Output: ONE new file `docs/review/p3-prefix-d-r1.md` on your own branch `claude/review-1180-r1`, then push and stop. End your last commit message with `[worker-done review-1180]`.

## Question
PR #1180: on the P3 door screen only an explicit `not_allowed` answer shows the permissions card (a load failure never says "not allowed"); P3 lazy routes get an error boundary so a failed chunk never leaves a blank screen; door, sheet, Prices, page editor and Team tap targets reach 44px (explicit px, the site's html font-size is about 13.5px on phones).

## Check
1. Table: every door answer (allowed, not_allowed, load error, timeout, offline, empty) x what the screen says and offers. Disabled controls say why; empty states say what the person CAN do; no copy points at a missing control.
2. Error boundary: does it catch a failed lazy chunk and offer a working retry? Does it wrap EVERY P3 lazy route? Does it add bytes to /app or home first load (run `npm run check:bundle-budget` on main and on the branch; perf-budgets.json must be unchanged by this PR)?
3. Tap targets: measure at 390x844 (or read the CSS) that each named control is at least 44px in both dimensions, in px not rem.
4. Tests: do the new tests fail on the unfixed code (use origin/main versions of the changed src files)?
5. Run related vitest files and the whole organiser/p3 test tree.

## Report
Verdict PASS / FIX FIRST / BLOCK, numbered findings with file:line, severity, one-line fix each. State what you could not check. Stopping rule: one round; no fixes by you.
