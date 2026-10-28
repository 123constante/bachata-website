# Brief: independent review of the W4b stage-2 mockups (Fable, REVIEW ONLY)

Target: branch `claude/p3-w4b-mockups` (PR 1114, builder was Opus, head fc55cf5). Docs/design only. You review; you change NO files on that branch. Output: `docs/review/pr-1114-r1.md` on branch `claude/review-w4b-mockups-r1` (plain git push of that branch only; open no PR on the target).

Read `docs/design/p3-w4b-mockups.md` and the four mockups + gallery in `docs/design/p3-w4b/`. The builder's doc claims one Fable review already ran: there is NO review file on the branch, so treat the claim as unverified and review from scratch.

## Check, with evidence (file:line, query results)
1. **Data claims.** Re-run the counts in section 2 of the doc read-only on prod (project stsdtacfauprzrdebmzg, SELECT only, counts only, never a write): 42 accounts / 30 no page / 10 profile-not-finished (4 no city, 2 no profile) / 28 brand-new / 2 open requests. Also re-read `_require_complete_dancer_profile_v1` and confirm it is the gate for claim, request-access and create, and that admins are exempt. Say which numbers match.
2. **Inventory completeness.** Compare section 1 against `src/modules/organiser/home/onboarding/*` and `home/index.tsx` on main: any control, state, copy line or RPC the doc misses or invents? Does any option silently DROP a capability?
3. **Mockup truth.** For each of the 4 options: does every frame use only controls the RPCs accept (the 2026-10-08 incident class: copy pointing at a missing control, a control that cannot work but is not disabled with a reason, an empty state with no next step)? Does option A/B of no-city promise something stage 3 cannot deliver (e.g. `finishProfileHref(returnTo)` carrying a sheet task)?
4. **Design checks.** Re-run `node docs/design/p3-w4b/selfcheck.cjs` (Chromium at 390x844, light + dark): reproduce the numbers; mutate one file to confirm it can go red; look at the pictures yourself.
5. **Recommendations.** Are 'A' for new account and 'B' for profile-not-finished justified by the data? State what would change them.
6. **Findings table**, ranked: blocker / should-fix / nit, each with failure scenario and fix. Verdict line: PASS / PASS with should-fix / BLOCK. Verified / Not verified block.

Standing header lines: prove the data source first (step 1); no code, no prod write, no push to any branch but your own; context cap 30% (push your review early, subject ends `[worker-done dt_<ticket>]`).
