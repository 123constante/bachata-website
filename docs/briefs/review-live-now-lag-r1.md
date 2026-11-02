# Brief: review-live-now-lag-r1 (WEBSITE, READ-ONLY REVIEW, Opus; builder was Opus, so use fresh eyes). Branch claude/review-live-now-lag-r1 -> docs/review/live-now-lag-r1.md only.

Context line: stay under 35% of your context; push + handover by 50%. Never merge/approve/--no-verify. Plain git only. Supabase READ-ONLY (SELECT only). Docs only.

Review PR #1260 (branch claude/live-now-lag-r1: docs/design/live-now-lag/INVENTORY.md and PLAN.md). Brief it was built from: git show origin/brief/live-now-lag-r1:docs/briefs/live-now-lag-r1.md.
Check, with file:line evidence from the repo and read-only prod:
1. Is every public surface that shows event state in the inventory (event page, calendar, city lists, tonight, organiser page, OG/SEO, any RPC/edge cache)? Name any missing; coverage count honest?
2. Is the root cause per surface supported by the numbers (33 ms save-to-purge; which surface is not purged; TTLs read from vercel.json / app loaders)? Is anything stated as measured that was only inferred? (The worker could not read live headers: 403.)
3. The recommended option C and the "Live now" check: which RPC/field, race conditions (save, then read before the purge lands), false "Live now" when the page is stale, cancelled/moved/on-now events, zero bytes to /app first load.
4. Calendar protected files are read-only: does any option touch them?
5. Acceptance matrix (surface x state) complete?
Deliverable: verdict PASS / PASS WITH NITS / BLOCK, findings ranked with file:line and a failing scenario, honest Verified / Not verified. Commit subject ends [worker-done <ticket>].
