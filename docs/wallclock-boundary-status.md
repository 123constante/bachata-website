# WallClock/Instant time boundary — status & long-term direction

> Living record for the BST/timezone bug-class arc. The full history lives in the
> `project_bst_wallclock_type_boundary` memory and the plan files; this doc is the
> in-repo record of **what shipped, what it is, and what the real fix is.**

## The bug class (root cause)

Event/session times are stored **local-as-UTC**: a naive London wall clock tagged
`+00`. `"2026-07-17 20:00:00+00"` *means* London 20:00, **not** a UTC instant. So
`new Date(stamp).toLocaleTimeString()` renders +1h in BST, and `.getDate()` reads
the wrong day near midnight / for non-London visitors. The value looks like an
instant, isn't one, and has discarded the real timezone.

## What the brand is (and is not)

`src/lib/time/wallClock.ts` gives two opaque brands — `WallClock` (event/session
times) and `Instant` (`created_at`/`cutoff_at`/`drawn_at`) — so the compiler forbids
`new Date(wc)` and a CI gate (`check-wallclock-brand.mjs`) enforces it. **This is a
mitigation, not the cure.** It forces every consumer to *remember* the lie; it does
not remove it. That is why the arc spans 5+ phases and re-opens at every new RPC.

## Phases

- **Phase 0/1 (PR #106):** module + event-page boundary.
- **Phase 2 (PR #113, `aa06bf1`):** festival boundary + **regenerated the 10-week-stale
  `types.ts`** so the RPC schema is finally typed; `gen:types` + a drift guard.
- **Phase 3 (this branch) — the calendar boundary, shipped as a BRIDGE:**
  - **Made the schema real.** Dropped the obsolete `as never`/`as any` casts on
    `get_calendar_events_v2` (their only reason — "types file does not yet include" —
    was made false by Phase 2). `getCalendarEvents` now returns a **derived, branded**
    `CalendarEventRow` (`Omit<Raw, timefields> & {WallClock…}`) via a real codec
    `parseCalendarEventRow` — the compiler now verifies the wire shape instead of a
    hand-maintained fiction.
  - **One fetcher, seven consumers.** Collapsed the duplicate hooks/inline calls
    (`useCalendarEvents.tsx` deleted, dead `useEvents` deleted; `useEvents`/`Tonight`/
    `MoreEventsSection`/`Debug`/`EventCalendar`/`CalendarPanel` all route through
    `getCalendarEvents`). Added `enabled: Boolean(citySlug)` where the shared hook
    would otherwise fetch all cities into a city-scoped view.
  - **New CI guard** `check-calendar-rpc-typing.mjs` forbids re-laundering the calendar
    RPC through `as never`/`as any` — the hole a type-checker structurally cannot see.
  - **Fixed the live bugs** (as-stored rendering, convention-independent): organiser
    page `/organisers/cumbaye` 8:00pm→7:00pm; `LiveEventsSection`/`BachataWeekday`
    9:00pm→8:00pm; calendar grid unchanged (byte-equal).
  - **Home ItemList JSON-LD** now emits valid **per-day** ISO 8601 composed from
    `instance_date` + the stored time-of-day (fixes invalid-ISO + festival day-1 pin).

## Phase-Q hold (convention-dependent surface)

JSON-LD instant emission is **convention-dependent**: converting a stored wall clock
to a true instant requires knowing the zone, and the convention ("it's a London wall
clock") is **unverified for non-London rows** — the calendar feed carries ~5 live
`Africa/Tunis` rows (and Madrid festival rows exist). Owner decision (2026-07-15):
**London-only + documented.** `buildEventListJsonLd` emits instants only for
`city_timezone` null/`Europe/London`; non-London rows are **excluded** from the
ItemList until Phase Q resolves. Every other Phase-3 change renders as-stored and is
convention-independent.

## The north star (the actual fix — out of this repo's reach)

Stop storing local-as-UTC. Either store a true `starts_at_utc` instant **+ an IANA
`timezone` column**, or **convert to true instants server-side in the RPC** — the
pattern `get_public_festival_detail_v2` already proves (London 19:30→18:30Z, Tunis
18:00→17:00Z). Either makes `new Date()` correct, **deletes the brand**, and the
server-side route **resolves Phase Q at the source** (the zone is decided once,
authoritatively). It is walled off by **ADR-002 D10** (no tz column), **CI check #42**
(`check_occurrence_time_stamping_convention_v1` enforces local-as-UTC), and the
separate admin repo. `v3` is not a clean win on its own (v2 has 3 wrappers, can't be
retired, so v3 *adds* a dialect).

## Owner escalation (ready to send)

Two asks for the owner:

1. **Phase Q — advertised start times.** For the live non-London festivals
   (`Tunisia Bachata Festival 2026`, stored `2026-09-24 07:00:00+00`; the Madrid
   rows), what is the **advertised local start time**? This decides whether the
   stored clock is a London wall clock, a city-local clock, or a true instant — and
   therefore how (or whether) to emit their JSON-LD/ICS instants. Until answered,
   those rows are held out of structured data.
2. **Revisit ADR-002.** The mitigation cost has compounded across 5 phases, and Phase Q
   shows the stored convention may not be consistent across zones — cracking the
   premise ADR-002 rested on. Recommend re-evaluating a storage/RPC change (true-instant
   + IANA tz, or server-side-instant RPCs) that would delete the brand and resolve the
   zone ambiguity at the source. This is a cross-repo (admin) decision.

## Deferred / recorded (not in this PR)

- Density-exempt `CalendarGrid`/`CalendarListView`/`DayDetailModal` (confirmed
  unaffected — separate PR; show the today/past gating diff first).
- Now-in-schema `get_map_events_v1` / `get_latest_events_v2` still cast `as never`
  (trivial follow-up; their `MapEvent`/`LatestEventRow` shapes aren't in the bug set).
- Phase-5 leaf tail: `calendar_events_dto`/`VenueEntity`, `get_public_events_list_v2`,
  `FestivalHub`, `MyAttendance`, dashboards, `api.ics.calendar` dup.
