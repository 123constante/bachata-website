# Brief: fix-f13-isolation (Website, one SMALL worker, ONE push, no new PR)

Branch: `claude/dancer-app-r1b` (PR #821 exists; do NOT open another). Head you start from: 74f07539. Read and push with PLAIN git
(never `gh api`). Shell commands without variables/loops/`$(...)`. Never merge, never approve, never `--no-verify`, Supabase read-only.
Cloud CI rule: GitHub Actions may refuse on billing; run the job steps yourself and list per-job results in your handover.

## Failure the orchestrator saw (red on PR #821, run 39083656918)
`dancer-area-isolation` fails: "(a) changed file is neither inside src/modules/dancer-app/, nor a test, nor a seam:
docs/dancer-page-f13.md". The check allows docs only under `docs/handover/`, `docs/journeys/`, `docs/review-pack/`, `docs/review-packs/`.

## Task
1. `git mv docs/dancer-page-f13.md docs/handover/dancer-page-f13-design.md`. Fix every reference to the old path
   (grep the repo, including docs/handover/dancer-page-f13.md and code comments). Do NOT edit the check script or its allow-list
   (fix the file, not the check).
2. Run `npm run check:dancer-area-isolation` against base origin/main: must exit 0. (It failed before your change: that is the red-first proof; show the before and after output lines.)
3. Run the other CI job steps listed in .github/workflows/unit-tests.yml that touch docs/paths (e.g. doc-weight, integrity, bom-check) and report exit codes.
4. Separately, ONLY REPORT (do not change anything in `src/modules/organiser/`): CI job `unit (Europe/London, full)` had 1 failure,
   `src/modules/organiser/profile/__tests__/ProfilePage.test.tsx > account and sign out > asks first, then calls signOut ... ` ("expected spy to be called 1 times, but got 0"). That file is not in this PR. Run that one test 5 times in your
   sandbox (`npx vitest run <file>`), and also once on a clean checkout of origin/main; write in the handover whether it is flaky or deterministic and whether main has it.
5. ONE commit, subject ending `[worker-done dt_<your ticket>]`, ONE push. Append a short "isolation fix" section to docs/handover/dancer-page-f13.md with the results above. Stop after the push.
