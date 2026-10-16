# Brief: Website slice 3a+3d - finish (review round 1 fixes + final checks)

Repo `123constante/bachata-website`. Work on `claude/account-grid-3ad` (expected head 1e2dfb03; if it differs STOP and
report). You are its only writer. Do NOT open a PR; do NOT push `claude/account-grid`.

## Read first
- `docs/review-packs/account-grid/REVIEW-3AD.md` on branch `claude/account-grid-3ad-review` (`git fetch origin
  claude/account-grid-3ad-review`, `git show FETCH_HEAD:docs/review-packs/account-grid/REVIEW-3AD.md`). It is your
  work list: fix B1, B2, S1, S2, S3, S4 exactly as each finding's failure scenario describes (its proposed fix is a
  suggestion; the failure is the requirement).
- The original slice brief `briefs/account-grid-3ad-delete-settings.md` on `arc/briefs-dancer-rebuild` and
  `docs/handover/account-grid-3ad.md` on your branch.

## The failures, in plain words (the reviewer's, these are what must not happen)
- B1: a person who deleted their account and signs in via a link carrying returnTo is never restored.
- B2: "Sign out of all devices" tells the person they are signed out everywhere when the global revoke failed.
- S1: the contact address must be `support@bachatacalendar.co.uk` (the address Website PR #762's /privacy page names;
  orchestrator decision), in ONE constant.
- S2: only ONE edit in `src/lib/accountRouting.ts` (the signInLanding call) and none in another slice's files;
  anything else you need there goes in the handover "left" list for slice 3b (which owns that file).
- S3: the contract test must fail on an SQL-side rename (read the key names from the #820 SQL file, not a copy).
- S4: rate-limit copy names the right window.
For each: a test that FAILS on 1e2dfb03 and passes after (quote both outputs).

## Final checks (the previous worker's "next steps")
`npm run build` (production), `check:bundle-budget`, `check:first-load-requests`, lint chain, typecheck (note the
pre-existing error count vs base b58f39d; no new errors), `test:unit` (run WITHOUT git stash mid-run; if the default
vitest pool hangs use `--pool=forks`), `check:journey-grid`, e2e for the account specs. Known: 3 dancer-home e2e
failures exist on base b58f39d too (inherited, not yours) - prove it again by running them on the base.
Append a "Round 1 fixes" section + command/exit table to `docs/handover/account-grid-3ad.md`.

## Rules
Plain git only, never `gh api`. Supabase READ-ONLY. Never merge/approve/`--no-verify`. Shell commands without
variables, loops or `$(...)` where a plain command works. Push once at the end, subject ending `[worker-done <ticket>]`.
At 25% context start nothing new; by 30% push `PARTIAL [worker-done <ticket>]` with a "left" list. Your predecessor
blew past 30% waiting on long test runs: start the slow e2e/build runs in the background early and keep your own
reading small.
