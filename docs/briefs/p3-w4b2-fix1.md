# Fix round 1: Website #1130 (W4b2 slice 1), branch claude/p3-w4b2-shell-person

Continue on the existing branch. Review: docs/review/pr-1130-r1.md on origin/claude/review-w4b2-slice1-r1 (git fetch it; verdict FIX FIRST, no blocks). ONE fix round, then stop. Context under 50%.

## Owner decision (click, 2026-10-29)
The PERSONAL EMAIL screen (screen 20) is DROPPED. Remove it from the path, the percentage maths, the screens, the `save_my_signin_email_v1` wiring in the UI (keep the API helper only if still imported elsewhere; otherwise delete it), the tests and the e2e walk; the path ends at About (or at years when there is no page). Red first where a test pins the old path.

## Do
1. Merge current `origin/main` into the branch (it is CONFLICTING: main moved with #1122 and #1129; the known conflict is the package.json test:e2e list: keep BOTH sides' entries). Re-run the matrix, the e2e walk and typecheck after the merge.
2. S2: rewrite the PR body "Verified on real data" section so `PR_BODY=... node scripts/check-pr-real-data-verified.mjs` passes: three one-line items, no bold, exactly `- Shapes surveyed: <text>`, `- Checks run: <text>`, `- NOT verified: <text>`. Run the script to prove it.
3. S3: add a `NAT_FEW` list equal to the prototype's `['GB','ES','DO','IT','PL','BR']` for the six on-screen chips; keep POPULAR as the sheet's first section. Add a test.
4. S4: stop the extra /app first-load request: load `@/constants/countries` with a dynamic import inside `useCountries` (or take POPULAR out of the static graph) so /app stays at its main-with-flags-on numbers. Re-measure with BOTH flags on (VITE_ENABLE_ORGANISER_P3=true and the second flag the review used), on main and on the branch, `npm run check:bundle-budget`; put those two numbers in the PR body instead of the flag-off ones. Do not edit perf-budgets.json or vite.config.ts.
5. S5: add a risk line to docs/plans/onboarding-arc.md (organiser onboarding shares the dancer area gate `dancer_area_open`) and map the `area_closed` error in PersonFlow to a message that says what happened.
6. S1: levels do not prefill because prod `my_dancer_role`/`my_role_details_v1` does not return `levels_taught`. Do NOT touch the database. Remove the invented `levels_taught` key from the two fixtures, add a "prod today" shape without it, and say in the handover and PR body that levels are not prefilled yet (queued admin item: emit `levels_taught` from `_role_details_v1`).
7. Nits N1 (memoise toast onDone) and N5 (geometry walk also measures the EMPTY persona: loop [true,false]). Skip N2/N3/N4/N6 (N2 disappears with the email screen); list them in the handover as left.
8. S6: write into the handover, for slice 3, that the percentage must be rebased onto the full path (contact ... person ... Review) when the other slices land.
Update docs/handovers/p3-w4b2-shell-person.md. Push ONCE at the end (final subject ends with [worker-done <ticket>], no [skip preview]); run every CI job step in your sandbox and put the per-job table in the PR body.
