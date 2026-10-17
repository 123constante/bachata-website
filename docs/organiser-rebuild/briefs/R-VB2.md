# Review brief R-VB2 -- independent review of PR #806 (VB2: no deployments for claude/* slice branches)

Repo `123constante/bachata-website`. You are the REVIEWER, not the author. Work on branch `claude/review-vb2` (create from `claude/vercel-slice-budget`, PR #806, head 6338c777). You commit ONLY `docs/reviews/REVIEW-VB2.md` and change no other file.

## Stopping rule
Opus, xhigh. CI-guard change = ONE review round. Severity BLOCKING / SHOULD / NOTE. Plain git only (never `gh api`). Shell commands without variables, loops or `$(...)`. Stay under 30% context; at 25% start nothing new. ONE push; last commit subject ends `[worker-done <your ticket>]` (PARTIAL if cut short).

## Read first
`docs/handovers/vercel-slice-budget.md` and the brief `docs/organiser-rebuild/briefs/VB2-slice-branches.md` (fetch origin arc/briefs-organiser-r1 and `git show FETCH_HEAD:<path>`).

## Verify (command + output for each)
1. `vercel.json` git.deploymentEnabled: claude/* false, main and feat/* still true. The author found Vercel deploys if ANY matching key is true (not specific-beats-star): check no pattern ordering or overlap can still deploy a claude/* branch, and that main, feat/*, fix/*, dependabot/* and any other branch families used in `git branch -r` are NOT accidentally switched off.
2. Preview-dependent CI jobs (lighthouse, seo-preview, e2e against preview, check-og etc: read every `.github/workflows/*.yml` for jobs that wait for a Vercel preview URL) skip with an explicit reason on claude/* and still run on other branches. Any job that would now hang or go red on a claude/* PR is BLOCKING.
3. Required-status interaction: can a claude/* PR still be merged (are any required checks now "never reported")? Bot-authored worker PRs must stay mergeable by the owner.
4. The guard (37 self-test cases): run it, then MUTATE and paste each red, reverting after each: (a) flip claude/* to true, (b) remove the skip reason, (c) add an overlapping key that re-enables deploys, (d) drop feat/* keep-on.
5. Run the CI steps that apply (`npm run lint`, the guard's own script, `check:mojibake`, unit tests it touches). List what could not run.

## Output
`docs/reviews/REVIEW-VB2.md`: verdict (CLEAN / n BLOCKING / n SHOULD / n NOTE), findings with file:line and one-sentence fix, mutation evidence, CI table, Verified / Not verified.
