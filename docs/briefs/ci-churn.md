# Brief: cut CI churn (admin queue #1583)
Goal: fewer wasted CI runs on bachata-website. Add `concurrency: { group: ${{ github.workflow }}-${{ github.ref }}, cancel-in-progress: true }` to every `pull_request` workflow in `.github/workflows/` that lacks it (never on push-to-main or deploy/migration workflows). No required check may be lost or renamed.
Acceptance: Lead x PR workflows x last 100 runs: superseded runs cancelled; a short script or doc line reports runs per merged PR (now ~36 Website) so it can be tracked weekly.
Lane normal, Website only, no DB. One branch, one PR, one push. Check `check-script-conventions.mjs` rules if you add a guard. Verified / Not verified block in the PR.
