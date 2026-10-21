# ER-C10 handover: festival

Branch `claude/er-c10-festival` (from `claude/er-wave1`). Only `src/modules/organiser/events/festival/**` plus parked/handover docs.

## Pinned interface
`import { FestivalCreate, FestivalEdit, ... } from '@/modules/organiser/events/festival'`
- `<FestivalCreate onCreate(draft) busy? today? initial? />`: the entry C7 mounts from New event's format step. First day, days stepper, ticket link ONLY, every night with hours (tap to change, "Use these hours every night", Add a day / Remove this day). Create disabled with a reason.
- `<FestivalEdit original live deps search onOpenOther onSaved? />`: Edit bar with Party hours / Artists / Timetable / Flyer / Details / About; the first three open in place, the last three call `onOpenOther`. One Save ("Update live event" when `live`), disabled "No changes yet" when untouched.
- `festivalModel.ts` (pure): `newFestival, festivalFromStored, setNightHours, sameHoursEveryNight, addDay, removeDay, setDays, moveStart, startsAt, endsAt, nightInstant` (true UTC instants via `wallClockToInstant`; a start before 08:00 rolls to the next calendar day), `setDaySessions, copyDay` (timetable via the C4 `SessionSheet`), artists (`addArtist...`, `lineupLine`), `festivalCommands(draft, original)` (series.upsert default_start_date / default_ticket_url, series.set_program echoing stored rows; empty array when untouched).
- `festivalApi.ts`: `series_festival_artists_get_v1 / set_v1` (AS BUILT); `FestivalDeps {send, saveArtists, search}` injected.

## Verified on real data
Read-only survey of prod `stsdtacfauprzrdebmzg` (counts only): 12 festivals, 7 live. Live: days/items/parties = 4/12/4, 4/4/4, 6/6/6, 4/4/0, 3/6/3, 5/14/10, 4/4/1. So: parties per day vary 0..2 (handled: none = default hours shown and nothing written unless touched; several = first edited, rest echoed), existing timetables are echoed untouched when only party hours change (tested).
Tests (103, `events/festival/__tests__`): day counts 1,2,3,4,7,14 x timetable present/absent x six start dates around both 2026 clock changes (29 Mar, 25 Oct): `starts_at` exact UTC, untouched save sends nothing; 5-hour and 7-hour change nights; after-midnight start; move first day; remove middle day; add day; timetable added after Go live; Copy a day; artists; create/edit screens in jsdom.

## Phone QA (390x844)
NOT DONE. The components are not mounted on any route (C7 mounts Create; the event page mounts Edit) and this slice may touch only `festival/**`, so no browser walk. Sizes are explicit px (44/48/52).

## Checks (sandbox)
| Command | Exit |
|---|---|
| `npx vitest run src/modules/organiser` (127 files, 3741 tests) | 0 |
| `npx vitest run src/modules/organiser/events/festival` (103) | 0 |
| `npx eslint src/modules/organiser/events/festival` | 0 errors, 4 fast-refresh warnings |
| `npx tsc --noEmit -p tsconfig.app.json` | no errors in festival/ |
| `npm run build` | 0 |
Not run: full `npm run test:unit`, `npm run lint` chain, e2e, `check:og`.

## Not verified / server
Server NOT landed (artists RPCs, AD1): end-to-end unverified. Server still refuses owner create of `festival` (AS BUILT): Create returns a draft; do not offer it until the server accepts it. Public line-up does not read the artist list yet. Real phone, screenshots, `starts_at` write by the server (client sends `default_start_date`; the instant helpers `startsAt/endsAt` are ready but nothing sends them yet).
