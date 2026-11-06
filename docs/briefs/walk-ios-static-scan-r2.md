# Brief: static iOS-class scanner for the walk gate, REBUILD from main (replaces conflicting PR #1449)
Brief-version: 2
Branch: claude/walk-ios-static-scan-r2
Lane: careful, Opus. 123constante/bachata-website, scripts/lib and its test only; no workflow, no package.json, no src/**, nothing is wired into CI or the judge.
Serves: the owner and lead (iOS Safari bugs the Chromium walk cannot see are caught by a measured number instead of a phone check).

## What main lacks
- The judge rubric asks for three iOS numbers (iosInputFontSize >= 16, iosNoRawVh <= 0, iosFixedBarsSafeArea <= 0) but nothing produces them -- grep: scanIosClasses
- extends: the finished, reviewed implementation already exists on origin branch claude/walk-ios-static-scan (PR #1449, head bc16ff51, tests green there) but its merge with main has real overlapping changes in two files; reuse it, do not redesign -- scripts/lib/walk-judge.mjs

## Files
scripts/lib/walk-ios-static.mjs (new)
tests/walkIosStatic.test.ts (new)
docs/handover/walk-ios-static-scan.md (new)
docs/automation/judge-worker.md (one line: Part C static scan exists, not wired)
scripts/prove-entry-point-dispatch.mjs (add the new file to TARGETS the same way the other walk modules are)

## What to build
1. Cut the branch from current origin/main. Bring over scripts/lib/walk-ios-static.mjs, tests/walkIosStatic.test.ts and docs/handover/walk-ios-static-scan.md UNCHANGED from origin/claude/walk-ios-static-scan (`git checkout origin/claude/walk-ios-static-scan -- <path>` for those three; these three do not exist on main so there is no conflict).
2. For the two files that exist on main (docs/automation/judge-worker.md and scripts/prove-entry-point-dispatch.mjs) do NOT copy the old versions: re-apply only the old PR's small change (`git diff origin/main...origin/claude/walk-ios-static-scan -- <path>` shows it relative to the old merge base; apply that intent by hand onto main's current text): one line in judge-worker.md, and the TARGETS entry in prove-entry-point-dispatch.mjs in the style main now uses.
3. Re-run the existing tests of those files and the new test file; run `node scripts/prove-entry-point-dispatch.mjs` and the repo checks that apply to scripts/ changes. Everything green on the rebuilt branch.
4. Update the handover doc's head sha and the "not run against the real built site yet" note; one push, no force.

## Tests
No new test design: the old tests must pass unchanged; add nothing unless a main change broke one (then fix the minimum, say why).

## Done when
- The rebuilt branch is a clean fast-forward of main plus the five files, all checks the old PR had are green locally.
- PR body: Verified / Not verified (Not verified: not run against the real built site yet; hard-tier path, owner Approve at head). State in the body that this replaces #1449, which the lead will close.
- No screen or UI is built, so INVENTORY.md does not apply; report coverage as the three rubric classes covered / 3.
