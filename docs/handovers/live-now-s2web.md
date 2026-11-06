# Handover: live-now slice 2, Website half -- BUILT

Brief: `brief/live-now-s2web:docs/briefs/live-now-s2web.md` (sha dd50ec2). Ticket
dt_1541618b21ee (continues dt_2a614767bef0, which stopped PARTIAL because the
`snapshot_compat` payload had no `version` on prod; admin #1280 fixed that).

## Re-check (prod `stsdtacfauprzrdebmzg`, read-only, 2026-11-06)

- `event_view_p5(snapshot_compat)`, 40 live series ids, series-only target:
  12 non-null, 12 with `version`, 12 JSON numbers. Keys now: `attendance,
  byline_organisers, event, event_id, location_default, occurrence_effective,
  occurrence_id, occurrences, organiser_byline, organiser_card, organisers, version`.
- 40 live occurrences, occurrence-pinned: 40/40 non-null, 40/40 number, 40/40
  integer, range 1790673796391298 .. 1793435959737933 (microsecond epoch, < 2^53).
- New contract check run against prod with the anon key over PostgREST (the
  Website's real path): 24 payloads over 12 live events, 0 violations, exit 0.

## Done (Build 1-4)

1. `EventPageSnapshot.version: number | null` (`src/modules/event-page/types.ts`),
   read by the one shared mapping `parseSnapshotVersion`
   (`src/modules/event-page/useEventPageQuery.ts`): non-negative safe integer,
   else null. Never throws.
2. `.data` shape: `tests/eventSnapshotVersion.test.ts` drives the real
   `app/routes/event.tsx` loader (DB mocked), JSON round-trips its
   `dehydratedState`, and pins `version` on the snapshot entry (number, and an
   explicit null when the RPC has none).
3. `scripts/check-event-snapshot-version.mjs` (main/deps seam, 23-case
   `--self-test`, 0/1/2 exits, 3-payload floor = exit 2), step added to
   `db-contract-check.yml` (#74), listed in `prove-entry-point-dispatch.mjs` TARGETS.
4. Table-driven tests (12 shapes + "rest of snapshot unchanged"). RED FIRST on
   unfixed code: 14 failed / 1 passed (loader returned `MISSING`).

No visible change; no Done-screen code; `api.revalidate.tsx` / `cloudflarePurge.ts`
untouched.

## Watch out

- The sandbox's `VITE_SUPABASE_URL` is NOT prod (a fixture/staging project). There
  the new check is RED (24/24 "no top-level version key") because that project
  lacks #1280. If the CI secret points at that project too, step #74 will be red
  until #1280 is applied there. On prod it is green.

## Next

Slice 3 (Done screen "Live now") can read `version` off `/event/<slug>.data`.
