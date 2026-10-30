# Review PR #1183 (read-only) - ticket review-1183

Repo 123constante/bachata-website, branch claude/p3-prefix-b-nodancer (builder: Opus). You are the independent reviewer. Do NOT edit src, do NOT push to that branch, never merge or approve.

Output: ONE new file `docs/review/p3-prefix-b-r1.md` on your own branch `claude/review-1183-r1`, then push and stop. End your last commit message with `[worker-done review-1183]`.

## Question
PR #1183: an owner with no dancer row gets a real next step instead of a Retry that cannot succeed; the You tab and the page editor at 0 pages point at Add a page (the surface's addPage), not invite-only copy; the 0-page link has a 44px tap target.

## Check
1. Table: owner with/without dancer row x 0 pages / 1 page / several x load ok / load error x You tab x page editor. Each state says what the person CAN do; no Retry that cannot succeed; no copy pointing at a missing control; disabled controls say why.
2. The Add a page link: does it reach the real Add a page screen with the right flags (organiserP3 and self-serve on; check what it does with self-serve off)? No invite-only wording left for a person who can add a page.
3. Tap target at 390x844 is at least 44px in both dimensions, in px not rem.
4. Tests: do the new tests fail on the unfixed code (origin/main versions of the changed src files)?
5. Run related vitest files and the whole organiser/p3 test tree. perf-budgets.json must be unchanged by this PR.

## Report
Verdict PASS / FIX FIRST / BLOCK, numbered findings with file:line, severity, one-line fix each. State what you could not check. Stopping rule: one round; no fixes by you.
