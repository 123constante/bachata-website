# Account settings fix: handover (Phase F, Website)

Branch `claude/account-settings-fix`, created from 8e2896f (PR #743's original head). No PR opened; the orchestrator brings these commits into #743. NOTE: `claude/account-settings-screens` has since moved to dd8c130, which carries an earlier fix-up with the same `expectNoHorizontalScroll` change; expect that hunk to cherry-pick as already-applied or conflict trivially (keep either copy), and the other earlier handover is `account-settings-fixup-handover.md`.

## 1. Overflow (e2e-smoke red): not a settings layout bug
- Probe of all 8 states (home visible/hidden/no-persona, ownership, delete ok/sole-owner with a very long page name/admin, deleted) at 390x844 and 390x600: **settled overflow 0 in every one**. No element of the settings content is wider than the viewport (only decorative absolute circles and sr-only items sit outside, clipped by `body{overflow-x:hidden}`; they do not change scrollWidth).
- Right after the route renders, the old measure read 5, 8, 11, 12, 16 (varies by run). That is `PageTransition` (x 30px -> 0 over 0.25s, app-wide; `reducedMotion` does not turn it off). CI's 14 then 8 is the same decay on a slow runner.
- Fix: `tests/e2e/helpers/organiserFake.ts` `expectNoHorizontalScroll` polls until overflow <= 0, waits 300ms, measures again. The assertion stays in the spec and still fails for a page that is genuinely too wide. No app CSS changed (PageTransition is app-wide; changing it was out of scope).
- RED/GREEN, honestly: the spec test did NOT go red locally on 8e2896f (20 repeats at 4 workers all passed; the local machine is faster than the CI runner), so red is shown by the per-state probe above (old measure non-zero in 6 states, settled 0). Green: `npm run test:e2e` with CI env: 99 passed, 0 flaky on the second full run; the first full run was 97 passed, 2 flaky (names not captured), 1 skipped.

## 2. dancer-home "a finished dancer gets the dancer home": pre-existing flake, nothing changed
PR diff to `DancerHome.tsx` adds a static banner, a link and one non-blocking query (`useMyProfileVisibility`); `dancer-home-completeness` renders from `useProfileCompletion`/summary, not from it. Evidence: that test x10 per viewport (20 runs, retries off, 2 workers) = 20 passed on this branch and 20 passed on main (5e0ec4c). Not reproduced; cold-dev-server on the runner remains the unproven explanation.

## 3. PR-body sections
`docs/briefs/account-settings-pr-body.md`: `## Phone QA` and `## Verified on real data`; both pass `parse()` of the repo's check scripts. The orchestrator pastes them into #743. Read-only prod survey: `dancer_profiles.is_active` true 83, NULL 83, false 0 (hook treats NULL as visible).

## Gates
`test:e2e` as above; `npm run lint`: 15 of 16 links pass, `check:integrity` exit 126 (script not executable here; `bash bin/check-integrity.sh` = ok). Only a test helper and docs changed, so unit tests, bundle budget and build are unaffected and were not rerun.

## Not verified
Real RPCs and the account-erase edge function; real device/Safari; pixels (blank screenshots); a red run of the spec itself; the 2 flaky tests of the first full run; CI jobs needing secrets/network; `/code-review` not run.
