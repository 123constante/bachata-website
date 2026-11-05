# Handover: organiser stats mapping (dt_627a61832551)

Brief: `docs/briefs/organiser-stats-mapping.md` on branch `brief/organiser-stats-mapping`.
Branch: `claude/organiser-stats-mapping`.

## Done
- `src/modules/profile/organiserStats.ts`: pure `organiserStats(input)` ->
  0-3 `{ key, value, label, title? }` in priority order (next/last night,
  tickets sold, dancers came, nights hosted, weekly rhythm, running since,
  one venue). Teaching line-up is deliberately absent. All thresholds are named
  constants at the top of the file.
- `src/modules/profile/__tests__/organiserStats.matrix.test.ts`: 25 cases over
  the brief's shapes, every case also asserting max 3, stable order, and no
  0 / empty / "--" / placeholder / non-ASCII value.
- Not imported by any screen: zero bytes to any first load.

## Date handling (existing helpers only)
- `londonDateKey`, `londonMinutesOfDay`, `addDaysToKey`, `londonDaysBetweenKeys`,
  `weekdayOfKey`, `isRealDateKey`, `keyToUtcNoon`, `parseUtcIso` from
  `src/lib/londonDate.ts`; `ROLLOVER_HOUR` from `src/lib/programDayRollover.ts`.
- A start before 08:00 is the previous night; `now` rolls the same way, so at
  01:00 Friday a Thursday night is still "Tonight".
- `getDisplayDay` itself was not used: it needs an (event, session) pair and only
  rolls a session back relative to its event's start date, which a single
  occurrence does not have.

## Inputs and where the page already has them (NOT wired)
Read from `src/pages/OrganiserProfile.tsx` on main (ba957d0):
- `nights`: the page's `futureOccs` (upcoming occurrence RPC rows) and
  `pastOccs` (past rows with the server `is_past` flag), both carrying
  `start_time ?? instance_date` and `is_cancelled`. The page builds
  `upcomingEvents` / `pastEvents` from them in the `useMemo` around line 846
  (cancelled skipped there, past deduped by event+date). Pass one entry per
  occurrence: `{ start: occ.start_time ?? occ.instance_date, cancelled: occ.is_cancelled, isPast: occ.is_past }`.
  Events with no occurrence row at all (fallback branch around line 886) can be
  passed with `start: e.start_time`.
- `foundedYear`: `ep.founded_year` (line ~1163).
- `ticketsSold`: NOT on the page today -- needs a source (tickets module /
  an organiser-level sold count RPC). Pass null until it exists.
- `dancersCame`: NOT on the page today (Going unique count). Pass null.
- `venueNames`: the page's event rows carry `location`; a venue NAME per night
  needs the COALESCE(co.venue_id, e.venue_id) venue join (data-contracts rule).
  Pass the per-night venue names once available, else omit.
- Today's strip (line ~1388) shows Upcoming dates / Past nights / a third stat
  (team count or years active, '--' fallback). That is what this replaces.

## Left / next steps
1. Wire into `OrganiserProfile.tsx` (separate slice; replace the strip at
   ~1383-1400; keep the failed-feed rule: if a feed failed, pass no nights from
   it rather than a false empty).
2. Source tickets sold and Going counts, then pass them.
3. Phone walk at 390x844 once wired.

## Survey (read-only, 2026-11-05, counts only)
The lead's survey file was not reachable from this cloud session, so a fresh
count was taken: 50 organisers; 2 with no nights; 0 cancelled-only; 31 with an
upcoming night; 17 past-only; 31 with 5+ past nights; max 262 dates on one
organiser; 8 with founded_year; 0 without founded_year whose first date is
over a year old (the inferred path has no live user today -- worth checking,
`occurrence_date` history may be shallower than the events'); weekly rhythm
over 12 months: 18 pass, 12 have 4+ dates on a weekday but fail the 60% share.

## Gates run in this session (2026-11-05)
- Matrix: 27/27 pass. The 2 tests added after /code-review (distinct nights
  hosted; grace window never says "Tonight") failed on the code before the fix.
- npm run check:mojibake: clean. eslint (scoped, 2 files): 0 errors.
- npm run pre-ship (after npm ci; the clone's node_modules lacked
  qrcode-generator): build:ship, check:bundle-budget, check:first-load-requests,
  check:chunk-cycles and every repo guard PASS. FAIL, none in this diff:
  test:unit, 15 tests in 4 files, all environment: the live contract specs
  (eventViewCompat, occurrenceProgram, publicEventPageLineup) get "Invalid API
  key" from this container, plus integrityCouldNotRun (a temp-repo
  TypeScript-resolution fixture). typecheck ratchet 109 vs baseline 106: no
  error is in the new files (tsc output filtered on organiserStats is empty),
  so the 3 are drift on main or this environment. test:e2e skipped by pre-ship
  as a result.
- Side effect to know: the unit run rewrites 12 .snap files CRLF -> LF
  (content identical); they were restored, not committed.
