# F3 - rebase Website PR #851 onto main (one job, one push)

Repo 123constante/bachata-website. Branch you own: `claude/person-page-web` (PR #851, bot-authored, already open).

## Why
PR #854 (`claude/person-page-v2-embed`) was SQUASH-MERGED into main. #851's branch still contains the original #854 commits, so GitHub shows it as CONFLICTING and its `dancer-area-isolation` check is red only because of those duplicate files. Nothing about the feature changes.

## Task
1. `git fetch origin main claude/person-page-web claude/person-page-v2-embed` (plain git, never `gh api`).
2. Check out `origin/claude/person-page-web` detached, then `git rebase --onto origin/main origin/claude/person-page-v2-embed`. This replays only #851's own commits on top of main and drops the #854 commits and the merge commit.
3. Expected single conflict, in `src/pages/DancerProfile.tsx` (around the `<div className="container max-w-xl ...">` line). Resolve by keeping BOTH sides: use main's className `container max-w-xl mx-auto px-4 pt-3${embedded ? '' : ' pb-24'}` (template literal) AND keep the added line `<AlsoRoles current="dancer" id={id} slug={resolved.slug} />` directly under it. No other change. If other conflicts appear, resolve the same way (main's embedded changes + #851's additions) and list them in the handover.
4. Run the Website CI steps that apply (read `.github/workflows`): at least `npx tsc --noEmit`, `npm run lint` if present, the unit tests under `src/modules/person-page`, `app/routes`, `src/modules/dancer-app/public-page`, `src/lib/searchEntities*`, and `npm run check:dancer-area-isolation` (or the script the workflow calls; it must now report 0 violations). Put each command with its exit code in the PR comment/handover. A production `npm run build` too.
5. Push ONCE: `git push --force-with-lease=claude/person-page-web:0ee915a8a9d5bb7b3471e6e61ef54c9546ed0529 origin HEAD:claude/person-page-web`. The last commit subject must end with `[worker-done dt_<your ticket>]` (if no new commit is made, add an empty commit with that subject). Do not push anywhere else.
6. Stop after the push and report: new head sha, commands and exit codes, whether the PR now says MERGEABLE.

## Boundaries
Never merge or approve. Bot-authored PR only (it already exists; do not open another). Plain git only, no `gh api`. No variables, loops or `$(...)` in shell commands. Never `--no-verify`. Supabase read-only (you should not need it). If it cannot be finished, push nothing and write what happened in a handover note on a new branch `claude/done-<ticket>`.
Context limit 30%: at 25% start nothing new; commit subject `PARTIAL [worker-done <ticket>]` if cut short.

## CI rule
GitHub Actions may be billing-refused; run every relevant step in your sandbox and report per-job results. Do not run CI on the owner's PC.
