# Brief: continue P1 organiser page, finish the checks and open the PR (Website, normal lane)

Brief-version: 2
Branch: claude/organiser-page-p1 (continue; head a2992d855). ONE push at the end (Vercel cap). Opus. The build is done; this is verification and the PR. Read docs/handover/organiser-page-p1.md section "PARTIAL -- what is left" FIRST; it is the task list.

## Goal (four lines)
1. Who: dancers visiting an organiser page.
2. After: the page branch passes every applicable CI step locally and has a real PR.
3. Worked if: bundle budget shows zero bytes added to /app first load; pre-ship green; per-job table in the PR body.
4. Limits: no new features, no hero change, no migrations; fix only what a check shows red and say so.

## Do
1. `npm run check:bundle-budget` on main and on the branch; record both numbers.
2. `npm run pre-ship` and each applicable CI job step in `.github/workflows` (read them); put a per-job table in the PR body.
3. Fold or keep OrganiserProfileEmpty.matrix.test.tsx as the handover item 7 says (smallest safe choice, say which).
4. Push once. The orchestrator opens the bot PR; do NOT use gh pr create. Do not run a Vercel preview (the lead walks it). Update docs/handover/organiser-page-p1.md with results. Last commit subject ends with [worker-done <ticket>].
5. Not yours: /code-review, the 390x844 walk, the independent critique (the lead runs them).

## What main lacks
- the P1 visitor page is unmerged on this branch -- grep: OrganiserGetInTouch in src/modules/profile (absent on main)

## Files
- docs/handover/organiser-page-p1.md
- src/modules/profile/__tests__/organiserPage.matrix.test.tsx
- any file a red check names (state it in the handover)
