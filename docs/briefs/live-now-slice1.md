# BRIEF: Live now, SLICE 1 (Website only, no migration, careful lane)

Branch: claude/live-now-s1. Builder: Opus. Context cap 30%; early checkpoint push; handover docs/handover/live-now-s1.md; end with `PARTIAL`/`DONE [worker-done <ticket>]`.
Read first: docs/design/live-now-lag/PLAN.md (option C, steps 1 and 2) and INVENTORY.md on main. Full arc brief: slices 2 (admin migration) and 3 (Done-screen check) come later; do NOT start them.

## Goal (owner 2026-11-02)
After an organiser cancels or moves an event, the public event page and its `.data` twin show the new state within ~10 s, not up to ~310 s. Event pages only. Organiser/venue/ICS/open tabs/ended-on-now are out of scope.

## Do
1. `app/routes/api.revalidate.tsx`: when the webhook body carries `stateChange: true`, hard-delete ONLY the `event-<id>` tag with `dangerouslyDeleteByTag([eventTag(id)])`; keep the soft `invalidateByTag` for the rest of `purgeTagsFor`'s list. NEVER hard-delete the whole list (11 cold renders per cancel on a Hobby team over its CDN cap). A body without `stateChange` behaves exactly as today (the admin emit arrives in slice 2).
2. `app/cloudflarePurge.ts`: add the event's `/event/<slug>.data` twin to the warm sequence (G3), on the canonical URL, no cache-busting query.
3. Table-driven tests for the PLAN acceptance matrix rows that apply (cancelled, moved, time changed, venue moved, cancel-then-restore, slug change, hidden/archived, untouched save = no webhook). Pin `app/routes/api.revalidate.test.ts:136` unchanged. Red first against current code.

## Standing lines
- Prove the data source first: read the live webhook body shape and `purgeTagsFor` read-only; say which fields exist today.
- Zero bytes to /app first load: `npm run check:bundle-budget` on main and branch; never edit perf-budgets.json or vite.config.ts.
- Run every CI job step that applies (read .github/workflows) and put a per-job table in the PR body; PR body via `node scripts/pr-body.mjs` style Verified / Not verified block.
- Hard limits: Supabase read-only, no migration, never merge/approve, never `--no-verify`.
- Stopping rule: one independent review, one fix round, then the orchestrator walk.

## Not verified (say so, do not guess)
The real response headers (age, x-vercel-cache, cf-cache-status) need network access to the public site; if blocked, say so and write the probe script (5 s steps, 2 min) for a session that can reach it.
