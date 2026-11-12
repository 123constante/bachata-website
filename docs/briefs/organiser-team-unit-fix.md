# Fix unit failures on claude/profile-dash-organiser-team-build (PR 1583)
Only touch what the 2 failing tests need. Branch only; no other branches.
Failing (CI job "unit (Europe/London, full)"):
- src/modules/organiser/__tests__/focusReturn.test.tsx: call-site list now has 10 entries vs 9 expected, and p3/dash/team/TeamDashView.tsx has a SheetView without returnFocusRef. Fix: pass returnFocusRef (opener focus returns) in TeamDashView, and add the new file to the test's known call sites list.
Checks: run those tests plus tsc and the mojibake check; refresh the PR body head; end with commit subject `[worker-done <ticket>]`.
