# BRIEF: Live now, stale event pages after an organiser save (r1, 2026-11-02)

Lane: CAREFUL (admin migration + public cache path). Builder: Opus cloud worker, one per branch. Independent review by a DIFFERENT worker before any merge. Source of truth: `docs/design/live-now-lag/PLAN.md` + INVENTORY.md on main (merged #1260).
Owner choice 2026-11-02: event pages fresh within ~10 s. Organiser/venue pages keep their slower timing for now (G1/G2 emits are slice 3, optional). Open tabs (G6) stay queued; time-driven ended/on-now (G7) not in scope.

## Slice 1 (Website only, no migration): narrowed hard purge + warm `.data`
- `app/routes/api.revalidate.tsx`: when the webhook body says `stateChange: true`, hard-delete ONLY the `event-<id>` tag (`dangerouslyDeleteByTag`); keep soft `invalidateByTag` for city-<slug> / seo-landing / home-feed. NEVER hard-delete the full tag list (review F2: 11 cold renders on a Hobby team already over its CDN cap).
- `app/cloudflarePurge.ts`: warm the `/event/<slug>.data` twin in the CF sequence (G3).
- Webhook body without `stateChange` behaves exactly as today (back-compat, so Slice 1 can ship before the admin emit).
- Tests: table-driven per the PLAN acceptance matrix (cancelled, moved, time, venue moved, cancel-then-restore, slug change, hidden, untouched save). One shared status mapping. Pin `app/routes/api.revalidate.test.ts:136` unchanged.
- One live probe after deploy: save, then fetch the event page and `.data` at 5 s steps; record age / x-vercel-cache / cf-cache-status. (The r1 worker's network blocked this; run it from a session that can reach the public site.)

## Slice 2 (admin repo, migration, careful): emit `stateChange` + public `version`
- Admin: the event-write webhook emit gains `stateChange: true` on cancel / move / time / status changes. Migration: add a public `version` (or `updated_at`) to `event_view_p5`'s payload. Replay proof + independent review + Claude applies (owner rule); read-before / show-after; no destructive change; explicit GRANTs if any new object.
- Website: `app/routes/event.tsx` loader puts the version into the `.data` JSON; contract check `scripts/check-*.mjs` pins it.

## Slice 3 (Website, after 1+2): organiser "Live now" check on the Done screen
- `DoneState` carries slug + saved version (`useEventSend.ts:18`, `LifecycleActions.tsx:120`). Done screen polls `GET /event/<slug>.data` (canonical URL, no cache-busting query) every 5 s up to 5 min: "Live now" when public version >= saved version; else "Saved. The public page can take a few minutes." Version compare only (never content compare). Ships ONLY after Slice 1 lands (F5: the poll must not cause the lag it reports).
- Visible change: needs a design record `docs/design/<pr>.md`, 390x844 walk, no extra buttons on Done.

## Not in scope / stated limits
G1/G2 organiser + venue emits, G4 ICS/embed, G5 non-emitting writes, G6 open tabs, G7 ended/on-now. Residual ~310 s on city and SEO pages is accepted.

## Definition of done per slice
Shape survey (counts only), table-driven tests, every CI step, laptop 390x844 walk for Slice 3, Verified / Not verified block, review pack before any Merge line. Context cap 30%, early checkpoint push, handover file.
