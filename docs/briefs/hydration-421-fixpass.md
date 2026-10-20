# Brief: ONE fix pass on the #421 fix (Website, branch claude/hydration-421-fix, PR #878)

You are a fresh worker continuing the SAME branch `claude/hydration-421-fix` (head a935d822). Push ONCE at the end, subject ending `[worker-done <ticket>]`. Stop after the push and report. Plain git only, never gh api.

Read first: `git fetch origin claude/hydration-421-fix claude/done-hydration-421-review`, then `git show origin/claude/done-hydration-421-review:docs/review-hydration-421-fix.md` (the independent review) and `git show origin/claude/hydration-421-fix:docs/handover-hydration-421-fix.md`.

## Fix exactly these (owner decided: fix the review's should-fix items)
S1. Wrap the RsvpBlock warm-up `import()` in `if (GOING_CHECKIN_ENABLED)` (from `src/lib/goingCheckin.ts`), so no RsvpBlock chunk is fetched while the flag is off. Keep the other two warm-ups. Keep RsvpSlot memoisation as is. Re-measure runtime JS requests on a production build (ongoing + ended event, 390x844, CPU 4x): RsvpBlock must not be fetched; the 4x-CPU/1000 ms e2e spec must still pass 3/3 on the branch.
S2. Re-pin the gating in `derivedBadgeGating.test.ts`: add `/isCancelled=\{Boolean\(occurrence\?\.isCancelled\)\}/` and anchor the first regex as `/\{isCancelled \? badge :/`. Prove each new/changed assertion can fail: mutate BentoPage.tsx throwaway (`!isCancelled ? badge :` and `isCancelled={false}`), show the test goes RED, revert. Better: also add a small render test of `LevelSlot` (cancelled -> bare badge, no prompt; not cancelled -> prompt with badge fallback) if you can do it without exporting more than needed.
N1. Add `.catch(() => {})` to each warm-up `import()` (void importX().catch(() => {})).
N2 (cheap): no change needed beyond S1; skip.
Do NOT touch N3/N4 (note N4, the pre-existing layout shift CLS 0.12 on ended event pages, in your handover as a possible separate ticket).

## Gates
Run every CI step you can in the sandbox (read .github/workflows): tsc, event-page vitest, check:bundle-budget, check:first-load-requests, check:chunk-cycles, lint, build. Update the PR #878 body checkpoint via the MCP update-pull-request tool (not gh api) with a short "Fix pass" section: before/after request counts, mutation proof, per-job table, Not verified. Append the same to `docs/handover-hydration-421-fix.md`. Never edit perf-budgets.json. Stop at 30% context (PARTIAL push + handover).
