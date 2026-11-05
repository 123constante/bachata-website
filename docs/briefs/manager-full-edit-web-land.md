# Brief: land finished work on claude/manager-full-edit-web (merge main, checks, PR)

Repo: 123constante/bachata-website. Branch: `claude/manager-full-edit-web` (finished 2026-11-04 by an earlier worker; never became a PR; now ahead of main by its commits and far behind). Normal lane, Sonnet, Brief-version 3.
No new screen: the screens exist on the branch; this is integration only, so no new INVENTORY.md; read the branch's own handover and the original brief `docs/briefs/manager-full-edit-web.md` (on main) first.

## What main lacks
The branch's feature commits are not on main and the branch is far behind main, so no PR or CI has run on current code.

## Do (3 deliverables)
1. Merge origin/main into the branch (merge, not rebase; resolve conflicts keeping BOTH sides' intent; for any conflict you cannot resolve with certainty stop and put it in the handover as PARTIAL). Do not touch the density-exempt calendar files.
2. Re-run on the merged tree: the branch's own tests plus every CI job step that applies (read .github/workflows; per-job table in the handover), `npm run check:mojibake`, lint chain, typecheck vs main. Any red that is also red on unchanged main is stated as such with evidence, not fixed.
3. ONE push (normal, not [skip preview]); the bot opens the PR; fill the PR body labels exactly (Verified on real data: Shapes surveyed / Checks run / NOT verified; Phone QA: Sizes checked 390x844 / Walked / Not verified) and run both check scripts before every gh pr edit; handover `docs/handover/manager-full-edit-web-land.md` with the per-job table.

## Rules
Never merge or approve; never --no-verify; source files over 2 KB through scripts/safe-edit.py / safe-write.py; HTML entities not raw Unicode punctuation. Last commit subject ends `[worker-done <ticket>]`.
