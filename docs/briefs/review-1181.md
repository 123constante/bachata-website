# Review PR #1181 (read-only) - ticket review-1181

Repo 123constante/bachata-website, branch claude/p3-prefix-a-banner (builder: Opus). You are the independent reviewer. Do NOT edit src, do NOT push to that branch, never merge or approve.

Output: ONE new file `docs/review/p3-prefix-a-r1.md` on your own branch `claude/review-1181-r1`, then push and stop. End your last commit message with `[worker-done review-1181]`.

## Question
PR #1181: the P3 Home banner and the You tab share ONE onboarding "things left" mapping for the shown page; it never reads "0 things left" and never disagrees between the two screens.

## Check
1. Table: every onboarding shape (nothing done, partial, all done, optional-only left, no page, several pages with different state, status load error) x Home banner x You tab: same count, same words, one shared mapping (no second copy).
2. Banner copy never points at a control that is not on screen; every empty/finished state says what the person CAN do; tap targets are explicit px (html font-size is about 13.5px on phones) and at least 44px.
3. Does "the shown page" follow the page switcher (Switch page) correctly?
4. Tests: do the new tests fail on the unfixed code (origin/main versions of the changed src files)?
5. Run related vitest files and the whole organiser/p3 test tree. perf-budgets.json must be unchanged by this PR.

## Report
Verdict PASS / FIX FIRST / BLOCK, numbered findings with file:line, severity, one-line fix each. State what you could not check. Stopping rule: one round; no fixes by you.
