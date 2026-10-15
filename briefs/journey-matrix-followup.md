# Brief: close the journey-matrix gaps on PR #764 (one pass)

Repo: 123constante/bachata-website. Branch: `claude/dancer-app-routing` (PR #764). Push to it only.
Read first, in full: `git show origin/claude/journey-matrix:docs/review-packs/public-journeys/MATRIX.md`
(the gap analysis; its "Proposed follow-up" section is your work list) and on your branch
`docs/review-packs/public-journeys/FIX-HANDOVER.md` (the previous worker's report).

## Why (owner's words)
"Have you covered every possible workflow the way the user signs up and accesses the profiles and goes back and
switches and has multiple profiles?" The owner chose: every gap that real accounts can hit is tested and walked
BEFORE #764 is offered for merge.

## Owner decisions (binding, 2026-10-15)
- F2: a finished dancer who came by the organiser link signs in to the organiser CLAIM screen (already built).
- 2+ organisers at sign-in: the "Continue as" list (current code).
- M57 team invite opened by a different signed-in person: the bearer joins; the card says who is joining
  ("You are joining as <name>") with "Not you? Sign out".
- M50/M51 (REVISED by the owner 18:1x, supersedes "no grace"): delete = the account is HIDDEN from everyone at once;
  signing in within 30 days RESTORES it; after 30 days it stays hidden, never erased. That is built in the later
  account-system PR, NOT here: do not build or change deletion in #764. Mark M50/M51 in MATRIX.md as
  "DEFERRED to the account-system plan (owner decision 2026-10-15)", and make sure nothing in #764 says "erased
  immediately" or "permanently deleted" on screen.
- D1: every sign-out path clears ALL person-scoped storage keys (same as M76 below, now an owner decision).
- D7 (only if small, about 1-2 files; else write "deferred to plan PR" in the handover): the e-mail code box survives a
  page reload for 10 minutes (same e-mail, same step), and after 5 wrong codes it stops accepting and shows
  "Send a new code". Red-first test for each.
- M44: an account with no dancer row and no organiser signs in -> the dancer setup (onboarding), not `/`.
- M70 dancer invite e-mail: the dancer link + claim. Pin the Website side; note in the handover that the admin
  repo's URL must match (do not edit admin).
## Orchestrator defaults (log each in the handover as "decided for the owner")
- M76: clear ALL person-scoped storage keys on EVERY sign-out path (privacy). Test: A signs out, B signs in on the
  same browser, B's forms show nothing of A.
- M10/M24: onboarding ends use replace; Back never re-opens "You're in".
- M71: a finished dancer on `/app/welcome` sees the end card, never re-asked. M80: unchanged. M17: as the code says.

## Task
0. FIRST (orchestrator decision): CI `build-smoke` is red on 8e6405b because the build specs need
   `VITE_SUPABASE_URL=https://phoneqafakenotaproject.supabase.co` (the fake session key ref) and
   `VITE_ENABLE_ORGANISER_SELF_SERVE=true`; with both set the previous worker got 31/31. Default BOTH inside
   `playwright.build.config.ts` (the build/webServer env of the test config, so local and CI match). Do NOT edit any
   workflow file. Prove: without the change the build specs fail, with it 31/31 pass; paste both.
1. If CI on the branch head still shows `build-smoke` red (tests/e2e-build/dancer-app-routing.build.spec.ts: signed-in
   people bounced from `/account/continue` to `/auth?mode=signin...`), fix that FIRST: it is a real red.
2. Every MATRIX "Proposed follow-up" row and spec, plus the src changes the decisions above require (M76, M57 card,
   M44). Each new row runs RED on the unfixed code first; paste the red.
3. The e-mail code step: walk it end to end against a Supabase BRANCH or the E2E test project reading the OTP there
   (never prod, never a real inbox). If no branch/E2E credentials exist in your environment, say "needs owner:
   E2E Supabase credentials" and keep the unit rows.
4. Update MATRIX.md (copy it onto this branch) so every kept row says COVERED BY, none MISSING except rows that are
   honestly blocked (say why).

## Gates (CI without paying GitHub)
Billing annotations ("payments have failed / spending limit") are not code failures. Run EVERY pull_request job
step in `.github/workflows/` your sandbox can run, including build-smoke / phone-qa build specs, unit tests with the
3 timezone runs, typecheck, isolation, integrity, `npm run build` PRODUCTION build. Per-job table (command, exit) in
`docs/review-packs/public-journeys/FOLLOWUP-HANDOVER.md`, plus the PR-body sections "## Phone QA" and
"## Verified on real data" written so `scripts/check-pr-phone-qa.mjs` and the real-data check pass on it (the
orchestrator copies it into the PR body).

## Rules
- Plain git for read and push. NEVER `gh api`, never `gh pr edit`.
- Shell commands without variables, loops or `$(...)` where a plain command works.
- Never merge or approve. Never `--no-verify`. Supabase prod READ-ONLY; writes only on a branch/E2E project.
- If the work will not fit, do the ranked rows top-down and hand over the rest (PARTIAL).
- Context: at 25% start nothing new; by 30% push + handover with `PARTIAL [worker-done <ticket>]`.

## Output
Last push carries `[worker-done <ticket>]`; FOLLOWUP-HANDOVER.md has done / red-first output / per-job table /
decisions logged / Verified / Not verified.
