# Brief: R1a REVIEW FIXES, continuation (Website, branch claude/dancer-app-r1a)

The fix worker (brief `briefs/dancer-rebuild-r1a-fix.md`, READ IT for context, decisions and boundaries) made every
code fix (B1, S1-S13, NOTEs) red-first in 73eeb948 and stopped at its context gate (PARTIAL, head 7129c2e5). Its
"What is left" list is in `docs/handover/dancer-rebuild-r1a.md` section "Review fixes" -> "What is left". Do ONLY
that list, quoted here:

1. `git fetch origin main` first (else the isolation check exits 2). Never commit a `chmod +x bin/*.sh` mode change.
2. Run the no-secret CI steps still NOT RUN (test:unit:offline with `NODE_PATH=`, test:unit:timing, workflow-lint,
   db-contract migration stamps, perf-budget canaries + build + bundle-budget + first-load-requests + chunk-cycles,
   `npm run lint`) and fill the table. After the unit run: `git status`; `git checkout -- '*.snap'` if any snapshot
   moved (never commit snapshot rewrites).
3. Perf: build with the perf-budget workflow env, `npm run check:bundle-budget`, then add the dancer-app row to
   `perf-budgets.json` `attribution.baseline.routes` (measured `firstLoadGzipKB`, `chunks`, `pullers`) with a note.
   Re-quote the event-route first-load bytes vs main (owner rule: <= +0.5 KB gz).
4. e2e: `npx playwright test tests/e2e/dancer-app` (the S12 picker and S13 font-size tests in `me-edit.spec.ts` are
   new and UNRUN: show S13 red with the `theme/dancer.css` S13 block removed, then green). Then the `test:e2e`
   list and phone-qa.
5. Regenerate the review pack (`REVIEW_PACK_DIR=docs/review-pack/r1a`, review-pack.spec.ts, chromium); the
   `*--no-photo.png` shots must now show the photo step; update `measurements.md`.
6. Finish the "Review fixes" section (table filled, Verified / Not verified). SKIP the "browser walk on prod-shaped
   data" and "/code-review" items of the old list: the orchestrator does those. Final commit subject ends
   `[worker-done <ticket>]`; push; stop.

Do NOT start background jobs that outlive your final push. Boundaries as in the fix brief; context: at 25% start
nothing new; by 30% push + handover with subject ending `PARTIAL [worker-done <ticket>]`.
