# Brief: red-PR root-cause sweep (#1493, child of #1492), repo bachata-admin, careful lane
Group currently red PRs by failing job; shared reds named: unit-build, workflow-artifact-policy, rpc-body-snapshots. Fix each shared cause ONCE on its own branch; then re-run or park the affected PRs with a reason.
Acceptance contract: Ricky x wakes to 11 red PRs x shared reds: each shared cause fixed once, PRs re-run green or parked.
Do not touch migrations' content; report if a red is a real defect in a PR.
Issue: https://github.com/123constante/bachata-admin/issues/1493
