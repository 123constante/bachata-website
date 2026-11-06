# Continuation: door-no-access-dead-end (PR #1439)

Brief-version: 2

Branch: claude/door-no-access-dead-end. The first worker built the feature (commit 20c990323) and the handover. Two things are left. Read docs/briefs/door-no-access-dead-end.md on origin/brief/door-no-access-dead-end for the original intent.

## What main lacks
- The branch is DIRTY against main (stale base). Merge origin/main into the branch (git merge, no rebase, no force push), resolve conflicts keeping both sides' intent, run the door tests and tsc -- grep: door-act-recheck
- The PR #1439 body still says TO FILL. Fill it with the exact labels from the dispatch prompt, with real shapes surveyed (door states: allowed, not_allowed, offline, empty list) -- grep: door-notallowed-back

## Files
- src/modules/p3/**/door/** (merge conflicts only, no new scope)
- docs/handover/door-no-access-dead-end.md (add a line: merged main at <sha>)

## Done when
Branch merges cleanly with main, door tests and tsc show 0 errors in touched files, PR body passes both PR-body check scripts, final commit ends with the worker-done marker.
