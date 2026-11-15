# Brief: weekly defect-escape count in weekly-digest

Owner goal: measure whether faster merging lets more bugs reach production. One number a week, no new workflow.

Job (normal lane, Website repo, branch `claude/defect-escape-weekly` off `main`, one PR):
1. Add `scripts/defect-escape.mjs`, modelled on `scripts/rework-share.mjs` (same flags: `--markdown`, same style, same no-network git-only approach, `fetch-depth` already 150 in the digest checkout).
2. Metric over the trailing 7 days of `main` (git log first-parent, squash merges): `escaped` = commits whose subject starts with `fix`, `revert`, or `hotfix` (case-insensitive, conventional-commit prefix like `fix(scope):` counts) that landed within 7 days AFTER a non-fix commit touching the same top-level area (`src/`, `scripts/`, `.github/`, `supabase/`, other) ; `merged` = all first-parent commits in the window; print `escaped`, `merged`, `escape rate`, and the list of escaping commit subjects (max 10). Keep the recipe small and frozen in a header comment; do not over-engineer.
3. Unit test next to the other script tests with a fixture of commit subjects (positive, negative, empty window, non-vacuity: a mutated parser must fail the test).
4. Do NOT edit any file under `.github/` (your sandbox forbids it). Put the exact YAML step (modelled on the rework-share step in `.github/workflows/weekly-digest.yml`, calling the script with `--markdown`, appended to the issue body the same way) in the PR body under the heading `Workflow step to add`. The orchestrator adds it in a second PR.
5. Open the PR as the bot. Do not merge.

Out of scope: dashboards, Slack, alerts, any other workflow edits.
Done = PR open, unit gate green locally on the new test, short PR body: what it measures, Not verified.
