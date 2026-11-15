# Brief: triage the always-red "Live QA (daily)" workflow

Owner goal: no workflow stays red for days. Decide per failure: real product bug, stale baseline, or flaky test; then fix or delete. Normal lane, Website repo, branch `claude/live-qa-triage` off `main`, one PR. Brief-version: 2

Evidence (run 43160779724, schedule, 2026-11-12, job live-qa, step "Run live QA suite (read-only, 390px)"; failing daily since at least 2026-11-07; no scheduled run exists after 2026-11-12, find out why):
1. `tests/e2e/live/shape-matrix.spec.ts:87` event page, shape `live|multi|future|no_cancel|ticket`, `/event/50-50`: "new page-check findings (not in baseline.json)".
2. `tests/e2e/live/shape-matrix.spec.ts:143` organiser page `/organisers/ritmo-latino`, series `coco-loco`: expected the card to show next date 2026-11-18, card text was "WEDNESDAY 11 NOV Coco Loco Ritmo Latino Studio ... See all 7 dates" (a PAST date shown as the card date).

Do:
- Read the failure output (`gh` is not available to you: use the run logs if reachable, else re-run the spec files locally against the same live URL read-only per the test header comments).
- Classify each failure with evidence (query the live page, Supabase read-only SELECT to check the series' real next date). If it is a real product bug (item 2 looks like one: the organiser card shows a past date), do NOT fix product code in this PR; write the bug up in the PR body with the failing page and the repro, and make the test keep failing for the real reason only.
- Stale baseline (item 1): update `baseline.json` entry with the finding text and a one-line reason.
- Find why scheduled runs stopped after 2026-11-12. You may NOT edit `.github/` (sandbox forbids): put your finding and the exact workflow change needed in the PR body under `Workflow change needed`.
- Delete a test only if it can never pass on live data; say why in the PR.

Done = PR open as the bot, PR body: classification table, what changed, Not verified. Do not merge.
