# Brief INT2 -- integrate S5 + S6 + S7 (and S9 if pushed) into claude/org-r1-integrate

Repo `123constante/bachata-website`. Zero-context worker, the integrator. Work and push ONLY `claude/org-r1-integrate` (it exists on origin, S1-S4 merged, head fe2de2b1 or later). One worker per branch: you are it. Plain git only (never `gh api`). Commands without shell variables, loops or `$(...)`. Never `--no-verify`. ONE push at the end (Vercel cap). Stay under 30% context; at 25% start nothing new; by 30% push + handover ending `PARTIAL [worker-done <ticket>]`. A continuation worker is normal. CI rule: GitHub Actions may be refused for billing; run EVERY CI job step yourself in the sandbox (read `.github/workflows`) and put command + exit code per job in the handover.

## Task
1. `git fetch origin` then merge, in this order, with plain `git merge` (never a PR merge): `origin/claude/org-r1-events` (S5, head 9818fa0 or later), `origin/claude/org-r1-team` (S6, head 1a1ad84 or later), `origin/claude/org-r1-pagemore` (S7, head d30c14f or later). If `origin/claude/org-r1-door` (S9) exists AND its last commit subject ends `[worker-done` (not PARTIAL), merge it last; otherwise skip it and say so.
2. Known conflicts to resolve by keeping BOTH real behaviours:
   - `flows/doneState.ts` + `Done.tsx`: S6 and S7 both added an optional `nextLabel`. Keep ONE definition; both callers keep working. Add a test row that both a team Done and a cover Done show their label.
   - `shell/OrganiserRoutes.tsx` + `shell/__tests__/routes.test.tsx`: keep EVERY real route, no duplicates; `git grep -n "<<<<<<<"` after.
3. Follow-ups (small, code allowed ONLY for these):
   a. `events/EventList.tsx` (~line 54) still uses `ORG_PATHS.newEvent`: switch to the S4 new-event route; TIGHTEN the newEvent source-scan test to the WHOLE `src/modules/organiser` tree.
   b. `/new/what` (S4) does not honour `?o=<organiserId>`; S5/S7 callers pass it. Make it honour it (red-first test), or if it needs more than ~30 lines, list it with file:line instead.
   c. Apply the S0b review-strip patch (see `briefs/S4-draft.patch` is NOT it; the patch is described in `docs/organiser-rebuild/handovers/S0b.md` -- if you cannot find it, list it as NOT done).
   d. Sign-out: if `useSignOutToHome` exists on origin/main or `origin/claude/dancer-journey-fixes`, switch `home/onboarding/SignOutLine.tsx` and the More sign-out to it; else leave and say so.
   e. Remove S7's z-index `!important` hack for eip-dock only if a one-line proper fix exists; else list it.
4. Run EVERY CI step (typecheck vs base error count, full `test:unit`, `npm run lint`, PRODUCTION `npm run build`, `AUDIT_STRICT=1 npm run check:images`, mojibake, `lint:architecture`, perf budgets, `test:e2e`, phone-qa configs). Failures that are identical on the base are listed as base-identical, not fixed (known: organiser-events.spec.ts:199, organiser-loop.spec.ts:14 -- S8's -- and 4 sandbox-only unit files).
5. Cross-slice checks: every route linked from Home/More/Help/Done resolves; one name for "Add a page" vs "Add an organiser" (list the mismatch at home/index.tsx:116, do not pick); S6 manager add surfaces depend on admin migration A1b (note in handover).

## Handover
Write `docs/organiser-rebuild/handovers/INTEGRATE2.md`: merge results, conflicts resolved, CI table, follow-ups done/not done, Verified / Not verified. Final commit subject ends `[worker-done <ticket>]`.
