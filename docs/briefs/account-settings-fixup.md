# Brief: account settings fix-up (Phase F, Website repo 123constante/bachata-website)

Read first: CLAUDE.md in this repo and docs it points to. Never merge, never --no-verify. Stop after the push and the report.

## Branch
PR #743 (branch `claude/account-settings-screens`, bot-authored) is open and the previous worker is finished. You are now the only worker on that branch: push to it (one push at the end, deploys are limited to one per London window). Read `docs/briefs/account-settings-screens.md` (arc/briefs-account-lifecycle) and `docs/briefs/account-settings-handover.md` on the branch first.

## Fix these three CI failures on the PR head 8e2896f
1. Check `real-data-verified` fails: the PR body heading is `## Verified on real data (required)`; CI wants exactly `## Verified on real data` followed by Shapes surveyed / Checks run / NOT verified. Fix the PR description via gh api REST (PATCH the pull request body), keeping the existing content.
2. Check `e2e-smoke` (97 passed, 1 failed): `dancer-home-390x844 > a finished dancer gets the dancer home` expects the text "Your profile is complete. You can rate parties now." and the element is not found. Find out whether #743 changed the dancer home (then fix the code or the test deliberately) or whether the test is flaky; compare with the same spec on main's head. Do not weaken the assertion without saying why in the PR.
3. The same run shows `account-settings-flows-390 ... disabled hide still offered` failed once and passed on retry with `Expected: <= 0` (a horizontal-overflow style measure). Treat that as a real flake: find the cause (layout shift / async render before measuring) and make the test wait for the stable state or fix the layout.
Also: the e2e log is full of React Router RenderErrorBoundary stack traces from the web server; find which route throws and whether #743 introduced it (compare with main). Fix if it is ours, otherwise note it.

## Gates
Run the e2e-smoke job step locally exactly as the workflow does (read .github/workflows/*.yml) and every other CI job step. Show the full run, 0 failed, twice in a row. New or changed tests must be shown failing on the unfixed code first. Phone QA at 390x844.

## Output
Head SHA, checks per job (all green or the honest remaining red), honest Verified / Not verified, handover docs/briefs/account-settings-fixup-handover.md.
