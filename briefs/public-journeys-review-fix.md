# Brief: PR #764 review fix (F1 + F2), ONE pass

Repo: 123constante/bachata-website. Branch: `claude/dancer-app-routing` (PR #764). Push to THIS branch only.
Model: Opus. You are the only worker on this branch.

## Why (owner's words)
The owner tapped the organiser link and "ended up in the dancer app" instead of the organiser claim screen.
PR #764 fixes that. An independent review (read it first, in full) found two gaps:
`git show origin/claude/review-764:docs/review-packs/public-journeys/REVIEW.md`

## Step 0: bring the branch up to date
`git fetch origin main` then `git merge origin/main` into `claude/dancer-app-routing` (main has #763 since the
PR head 4f0c8e2; it merges cleanly). Plain git only.

## Step 1: F1 (required): gate ping-pong on a stale cache
Do the review's fix list item 1 exactly: in one shared helper next to `writeMyDancerEdit`
(`src/modules/dancer-app/api/useMyDancerEdit.ts`), reset `['profile-completion']`; call it from
`OnboardingScreen.tsx` before it navigates to a gated `end` (any `end !== APP_HOME_PATH`), including the
`start === 'done'` branch. No second copy of the query key.
Test: `tests/journeys/gateCacheReset.test.ts`: cache says "incomplete", `my_dancer_edit` says "done", URL is
`/app/welcome?returnTo=/account/o`; assert the gate query is reset/refetched before the redirect. Run it RED on
4f0c8e2 first (stash the fix), paste the red output in the PR body.

## Step 2: F2: decision made = option (b)
The orchestrator chose (b) on the owner's behalf (it is the owner's failure shape; logged for the review pack so the
owner can overrule). In `signInLanding` (`src/lib/accountRouting.ts`): a single COMPLETE dancer side with
`organiserIntent`, no organisers and no open organiser request goes to `ORGANISER_HOME_PATH` (`/account/o`).
Leave the dancer side's `to` unchanged so the switcher's dancer entry still opens the dancer app.
- Add journey row `organiser-link-closed-tab-after-required` with END `/account/o` to
  `tests/journeys/publicEntryJourneys.ts` (+ its test), and update the journey map's "Decisions made by the worker"
  item 2 in `docs/review-packs/public-journeys/` to say the new behaviour.
- Add the negative rows: complete dancer WITHOUT organiser intent still lands on `/app/home`; complete dancer WITH
  intent but who already has an organiser (or an open request) does NOT go to the claim screen.
- Red-first: run the new rows against the unfixed code, paste the red.

## Optional hardening (only if trivial, same files)
- `Auth.tsx` signed-in redirect: skip when `user.is_anonymous`.

## Gates (CI without paying GitHub)
GitHub Actions may refuse jobs with a "payments have failed / spending limit" annotation: that is billing, not code.
Run EVERY job step in `.github/workflows/` that runs on pull_request for this repo that your sandbox can run
(at least: typecheck, unit tests incl. the 3 timezone runs, `npm run build` PRODUCTION build, the dancer-area-
isolation and integrity scripts) and put a per-job table (command, exit code) in the PR body. Say plainly what you
could not run (Docker, real phone, real inbox).

## Rules
- Plain git for read and push (`git fetch`, `git show`, `git push`). NEVER `gh api` (it stalls on a prompt).
  Edit the PR body with `gh pr edit 764 --body-file` only if `gh` works without a prompt; otherwise put the
  per-job table + red output in `docs/review-packs/public-journeys/FIX-HANDOVER.md` on the branch.
- Shell commands without variables, loops or `$(...)` where a plain command works.
- Never merge or approve. Never `--no-verify`. Supabase read-only.
- Do not touch anything outside the review's findings.
- Context: at 25% start nothing new; by 30% push + handover with `PARTIAL [worker-done <ticket>]`.

## Output
Last push carries `[worker-done <ticket>]` in the commit subject; it includes `FIX-HANDOVER.md` (done / red-first
output / per-job table / not verified).
