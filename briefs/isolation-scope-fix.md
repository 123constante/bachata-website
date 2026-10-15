# Brief: scope the dancer-area isolation check to dancer-area PRs (Website)

Repo `123constante/bachata-website`. Read `briefs/dancer-rebuild-COMMON.md` on `arc/briefs-dancer-rebuild`. Plain git
only, never `gh api`. Shell commands without variables, loops or `$(...)` where a plain command works. SMALL job.

BRANCH: `claude/isolation-check-scope` from `origin/main`. Open ONE bot PR (`gh pr create`, bot token per COMMON).

## Failure seen (2026-10-15, PR #762 Terms/Privacy)
`npm run check:dancer-area-isolation` -> "8 violation(s) (a) changed file is neither inside src/modules/dancer-app/, nor
a test, nor a seam: src/pages/Privacy.tsx ..." The rule (a) was written for dancer-app PRs while the area was being
built; since #759 merged it runs on EVERY PR, so any ordinary site change (legal pages, nav, routing) goes red.

## Decision (orchestrator, logged for the owner's pack)
Rule (a) "only dancer-app files + seams may change" applies ONLY when the PR changes at least one file under
`src/modules/dancer-app/`. Rules (b) protected files byte-identical? -> NO: (b) also only for dancer-area PRs (the
protected list exists to stop dancer work leaking into the public site). Rule (c) "nothing outside the seams imports
from src/modules/dancer-app" stays ALWAYS ON (it protects the boundary from both sides).
Print one line saying which mode ran: `dancer-area PR: rules a+b+c` or `not a dancer-area PR: rule c only`.

## Gates
- Red-first: extend the script's `--self-test` with a case "PR changes only src/pages/Privacy.tsx -> 0 violations"
  (fails on current main) and keep a case "PR changes src/modules/dancer-app/x.tsx + src/pages/Other.tsx -> (a)
  violation" and "src/pages/Other.tsx imports src/modules/dancer-app/x -> (c) violation" (must stay red). Show the
  new case failing before the change.
- Run every step of the workflow job that runs this check (`.github/workflows/unit-tests.yml`, job
  dancer-area-isolation) plus `npx tsc --noEmit`, `npm run lint`.
- PR body: summary, `## Verified on real data` (state: guard-only change, self-test cases + a run against the #762
  diff `DANCER_ISOLATION_BASE=origin/main` on a checkout of `origin/claude/site-legal-pages` merged with your branch:
  0 violations), `## Phone QA` (state: no UI change, N/A with reason), per-job table.
Never merge or approve; never `--no-verify`. Last commit subject ends `[worker-done <ticket>]`.
