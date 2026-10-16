# Brief: Website slice 3c - finish (review round 1 fixes)

Repo `123constante/bachata-website`. Work on `claude/account-grid-3c` (expected head dd1fe33c; if it differs STOP and
report). You are its only writer. Do NOT open a PR; do NOT push `claude/account-grid`.

## Read first
- `docs/review-packs/account-grid/REVIEW-3C.md` on branch `claude/account-grid-3c-review` (`git fetch origin
  claude/account-grid-3c-review`, then `git show FETCH_HEAD:docs/review-packs/account-grid/REVIEW-3C.md`). It is your
  work list: B1, S1, S2, S3, S4. The failure scenario in each finding is the requirement; its proposed fix is advice.
- The slice brief `briefs/briefs-web/account-grid-3c-auth-screens.md` on `arc/briefs-dancer-rebuild`, and
  `docs/handover/account-grid-3c.md` on your branch.

## The failures, in plain words
- B1: a slow or hung consent request leaves the person on a dead code box. Sign-in/sign-up must NEVER wait on consent
  or funnel calls without a short timeout; on timeout the person proceeds and the accept card catches them next time.
- S1: ONE constant for the terms version. Use the value Website PR #762 (branch `claude/site-legal-pages`) defines;
  since #762 is not in this branch yet, keep one constant in `termsConsent.ts` with a comment naming #762's constant,
  and add a test that fails if they differ (read #762's file only if present, skip with a printed reason otherwise).
- S2: when the dancer area is closed for that person, do NOT show the accept card (a button that can never work must
  not be offered); show nothing, and record nothing.
- S3: a wrong code must be counted as `wrong`, not `expired`.
- S4: an e-mailed-link sign-up must record consent. If the fix lives in `src/lib/accountRouting.ts` (owned by slice
  3b), do NOT edit it: write the exact change in the handover "left" list for 3b. If it lives in a file no other slice
  owns (e.g. the /auth/callback page), fix it here.
For each: a test that FAILS on dd1fe33c and passes after (quote both).

## Final checks
`npm run build` (production), bundle budget, lint chain, typecheck (no new errors vs base b58f39d), `test:unit`
(`--pool=forks` if the default pool hangs; never `git stash` mid-run), `check:journey-grid`, account/auth e2e specs.
Append "Round 1 fixes" + a command/exit table to `docs/handover/account-grid-3c.md`.

## Rules
Plain git only, never `gh api`. Supabase READ-ONLY. Never merge/approve/`--no-verify`. Shell commands without
variables, loops or `$(...)` where a plain command works. Push once at the end, subject ending `[worker-done <ticket>]`.
At 25% context start nothing new; by 30% push `PARTIAL [worker-done <ticket>]` with a "left" list. Start long test runs
in the background early and keep your own reading small.
