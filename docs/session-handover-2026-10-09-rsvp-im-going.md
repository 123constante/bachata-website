# Session handover -- 2026-10-09 -- "I'm Going" RSVP rebuild (PR #609)

Branch `claude/rsvp-im-going-rebuild`, PR #609 (open, NOT merged; needs owner approval
plus a live signed-in check -- public UI on a write route).

## Done
- RSVP rebuilt on `set_/get_my_occurrence_attendance_p5_v1` (admin #634, migration
  `20261109360000`): `src/modules/event-page/bento/blocks/RsvpBlock.tsx`,
  `src/modules/event-page/hooks/useOccurrenceRsvp.ts`, mounted in `BentoPage.tsx`
  under the group-chat CTA; 21 tests in `tests/client/rsvpBlock.test.tsx`
  (mutation-checked). Sign-in modal lazy (`lazyWithRetry`) to hold the chunk ratchet.
- 2026-10-09: the owner merged main into the branch (`bbeb683`). This session then
  ported `src/integrations/supabase/types.ts` from the auto-heal PR #635
  (`bot/types-regen`, types-drift green there; contains both RSVP RPCs identically)
  to clear `types-drift`, which was also red on main daily since 2026-10-07.
- The Vercel preview incident is over: seo/og/doc-weight/lighthouse/synthetic-preview
  went green on `bbeb683`.

## Open (red on the PR)
1. **bundle-budget** -- RESOLVED BY THE OWNER: #695 raised the `/event/:id` budget
   375 -> 380 KB on main, and the owner merged main into this branch (`78974f2`, 11:10Z).
   Confirm it is green on the new head; nothing else to do.
2. **real-data-verified** -- a new check from main that needs a `## Verified on real
   data` section in the PR body (Shapes surveyed / Checks run / NOT verified). The PR
   body has not been updated with it yet; the facts are in the body's "Notable
   decisions" (read-only SELECTs on pg_proc, event_series_p5 -- 60 live series,
   public_event_id = legacy_event_id -- and event_view_p5 snapshot_compat output).

## Next
- Add the real-data section to the PR #609 body (no code change).
- Confirm CI on `78974f2` (or later): bundle-budget should now pass (380 KB budget).
- Owner decisions still open (in the PR body): allow clearing an RSVP on closed
  nights; going-count staleness after reload.

## Gotchas for the next session
- `.githooks/*` are not executable in the cloud checkout, so git skips them: run
  `node scripts/check-source-integrity.cjs` and `env -u NODE_PATH npm run
  test:unit:offline` by hand, and gate the push on them with `&&`.
- `NODE_PATH=/usr/local/lib/node_modules_global` breaks `integrityCouldNotRun.test.ts`
  in this sandbox (same on main) -- unset it for the unit gate.
- `tsc -p tsconfig.app.json` baseline on `bbeb683` is 95 errors (none in RSVP files).
